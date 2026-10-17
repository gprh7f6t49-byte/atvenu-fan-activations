import { db, newId, nowIso, tx } from "./db";

export type ActivationStatus = "draft" | "live" | "ended";

export interface Activation {
  id: string;
  slug: string;
  artist_name: string;
  tour_name: string;
  tagline: string | null;
  description: string | null;
  offer_headline: string;
  offer_terms: string | null;
  promoter_name: string | null;
  primary_color: string;
  accent_color: string;
  text_color: string;
  hero_image_url: string | null;
  privacy_url: string | null;
  status: ActivationStatus;
  pass_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Show {
  id: string;
  activation_id: string;
  show_date: string;
  venue: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ActivationStats {
  codes_total: number;
  codes_available: number;
  opt_ins: number;
  apple_passes: number;
  google_passes: number;
  redeemed_fans: number;
  redemptions: number;
  unmatched_redemptions: number;
  /** Attributed sales, one entry per currency (EU tours mix GBP and EUR). */
  revenue: { currency: string | null; total: number }[];
}

export type ActivationInput = Omit<Activation, "id" | "created_at" | "updated_at">;

const EDITABLE_FIELDS = [
  "slug",
  "artist_name",
  "tour_name",
  "tagline",
  "description",
  "offer_headline",
  "offer_terms",
  "promoter_name",
  "primary_color",
  "accent_color",
  "text_color",
  "hero_image_url",
  "privacy_url",
  "status",
  "pass_expires_at",
] as const satisfies readonly (keyof ActivationInput)[];

export function listActivations(): (Activation & ActivationStats)[] {
  const rows = db().prepare("SELECT * FROM activations ORDER BY created_at DESC").all() as unknown as Activation[];
  return rows.map((a) => ({ ...a, ...getActivationStats(a.id) }));
}

export function getActivation(id: string): Activation | undefined {
  return db().prepare("SELECT * FROM activations WHERE id = ?").get(id) as unknown as Activation | undefined;
}

export function getActivationBySlug(slug: string): Activation | undefined {
  return db().prepare("SELECT * FROM activations WHERE slug = ?").get(slug) as unknown as Activation | undefined;
}

export function createActivation(input: ActivationInput): string {
  const id = newId();
  const cols = ["id", ...EDITABLE_FIELDS];
  db()
    .prepare(`INSERT INTO activations (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
    .run(id, ...EDITABLE_FIELDS.map((f) => input[f] ?? null));
  return id;
}

export function updateActivation(id: string, input: ActivationInput): void {
  db()
    .prepare(`UPDATE activations SET ${EDITABLE_FIELDS.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...EDITABLE_FIELDS.map((f) => input[f] ?? null), nowIso(), id);
}

export function setActivationStatus(id: string, status: ActivationStatus): void {
  db().prepare("UPDATE activations SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
}

export function listShows(activationId: string): Show[] {
  return db()
    .prepare("SELECT * FROM shows WHERE activation_id = ? ORDER BY show_date")
    .all(activationId) as unknown as Show[];
}

export function replaceShows(activationId: string, shows: Omit<Show, "id" | "activation_id">[]): void {
  tx((conn) => {
    conn.prepare("DELETE FROM shows WHERE activation_id = ?").run(activationId);
    const insert = conn.prepare(
      "INSERT INTO shows (id, activation_id, show_date, venue, city, country, latitude, longitude) VALUES (?,?,?,?,?,?,?,?)",
    );
    for (const s of shows) {
      insert.run(newId(), activationId, s.show_date, s.venue, s.city, s.country, s.latitude, s.longitude);
    }
  });
}

export function getActivationStats(activationId: string): ActivationStats {
  const conn = db();
  const codes = conn
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'available'), 0) AS available
       FROM promo_codes WHERE activation_id = ?`,
    )
    .get(activationId) as { total: number; available: number };
  const optIns = conn
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(apple_pass_at IS NOT NULL), 0) AS apple,
              COALESCE(SUM(google_pass_at IS NOT NULL), 0) AS google
       FROM opt_ins WHERE activation_id = ?`,
    )
    .get(activationId) as { n: number; apple: number; google: number };
  const red = conn
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(r.promo_code_id IS NULL OR o.id IS NULL), 0) AS unmatched,
              COUNT(DISTINCT o.fan_id) AS fans
       FROM redemptions r
       LEFT JOIN opt_ins o ON o.promo_code_id = r.promo_code_id
       WHERE r.activation_id = ?`,
    )
    .get(activationId) as { n: number; unmatched: number; fans: number };
  const revenue = conn
    .prepare(
      `SELECT r.currency, SUM(r.order_total) AS total
       FROM redemptions r JOIN opt_ins o ON o.promo_code_id = r.promo_code_id
       WHERE r.activation_id = ? AND r.order_total IS NOT NULL
       GROUP BY r.currency ORDER BY total DESC`,
    )
    .all(activationId) as unknown as { currency: string | null; total: number }[];
  return {
    codes_total: codes.total,
    codes_available: codes.available,
    opt_ins: optIns.n,
    apple_passes: optIns.apple,
    google_passes: optIns.google,
    redemptions: red.n,
    unmatched_redemptions: red.unmatched,
    redeemed_fans: red.fans,
    revenue,
  };
}

export interface DailyPoint {
  day: string;
  opt_ins: number;
  redemptions: number;
}

export function getDailySeries(activationId: string): DailyPoint[] {
  const rows = db()
    .prepare(
      `WITH o AS (SELECT substr(created_at,1,10) AS day, COUNT(*) AS n FROM opt_ins WHERE activation_id = ? GROUP BY 1),
            r AS (SELECT substr(COALESCE(redeemed_at, created_at),1,10) AS day, COUNT(*) AS n FROM redemptions
                  WHERE activation_id = ? AND promo_code_id IS NOT NULL GROUP BY 1),
            d AS (SELECT day FROM o UNION SELECT day FROM r)
       SELECT d.day, COALESCE(o.n,0) AS opt_ins, COALESCE(r.n,0) AS redemptions
       FROM d LEFT JOIN o USING(day) LEFT JOIN r USING(day) ORDER BY d.day`,
    )
    .all(activationId, activationId) as unknown as DailyPoint[];
  return rows;
}

export interface ShowBreakdown {
  venue: string;
  city: string | null;
  redemptions: number;
  revenue: number;
  currency: string | null;
}

export function getRedemptionsByVenue(activationId: string): ShowBreakdown[] {
  return db()
    .prepare(
      `SELECT COALESCE(r.venue, 'Unknown venue') AS venue, MAX(r.city) AS city,
              COUNT(*) AS redemptions, COALESCE(SUM(r.order_total),0) AS revenue,
              MAX(r.currency) AS currency
       FROM redemptions r JOIN opt_ins o ON o.promo_code_id = r.promo_code_id
       WHERE r.activation_id = ?
       GROUP BY COALESCE(r.venue, 'Unknown venue') ORDER BY redemptions DESC`,
    )
    .all(activationId) as unknown as ShowBreakdown[];
}
