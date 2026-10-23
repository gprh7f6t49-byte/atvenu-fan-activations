import type { HeroLayout, HeroOverlay } from "./hero";
import { db, newId, nowIso, tx } from "./db";

export type ActivationStatus = "draft" | "live" | "ended";
export type ActivationKind = "fan" | "crew" | "comp";
export type DiscountType = "percent" | "amount";

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
  pass_image_url: string | null;
  hero_layout: HeroLayout;
  /** Focal point of the landing image, as % from the left / top. */
  hero_focus_x: number;
  hero_focus_y: number;
  hero_overlay: HeroOverlay;
  redeem_place: string;
  privacy_url: string | null;
  status: ActivationStatus;
  pass_expires_at: string | null;
  kind: ActivationKind;
  discount_type: DiscountType;
  discount_value: number | null;
  discount_currency: string | null;
  single_use: number;
  tour_id: string | null;
  organisation_id: string | null;
  /** Standalone event this activation belongs to (null on a tour, or for older standalone ones). */
  group_id: string | null;
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
  revoked: number;
  /** Estimated value of discounts given to matched recipients, per currency. */
  discount_given: { currency: string | null; total: number }[];
  /** Attributed sales, one entry per currency (EU tours mix GBP and EUR). */
  revenue: { currency: string | null; total: number }[];
}

export type ActivationInput = Omit<Activation, "id" | "created_at" | "updated_at" | "organisation_id" | "group_id">;

const KIND_SLUG_PREFIX: Record<ActivationKind, string> = { fan: "", crew: "crew-", comp: "comps-" };

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
  "pass_image_url",
  "hero_layout",
  "hero_focus_x",
  "hero_focus_y",
  "hero_overlay",
  "redeem_place",
  "privacy_url",
  "status",
  "pass_expires_at",
  "discount_type",
  "discount_value",
  "discount_currency",
  "single_use",
  "tour_id",
] as const satisfies readonly (keyof ActivationInput)[];

/** All activations for one organisation, or every organisation when orgId is null (atVenu admin). */
export function listActivations(orgId: string | null): (Activation & ActivationStats & { organisation_name: string | null })[] {
  const rows = db()
    .prepare(
      `SELECT a.*, o.name AS organisation_name FROM activations a LEFT JOIN organisations o ON o.id = a.organisation_id
       WHERE (? IS NULL OR a.organisation_id = ?) ORDER BY a.created_at DESC`,
    )
    .all(orgId, orgId) as unknown as (Activation & { organisation_name: string | null })[];
  return rows.map((a) => ({ ...a, ...getActivationStats(a.id) }));
}

export function getActivation(id: string): Activation | undefined {
  return db().prepare("SELECT * FROM activations WHERE id = ?").get(id) as unknown as Activation | undefined;
}

export function getActivationBySlug(slug: string): Activation | undefined {
  return db().prepare("SELECT * FROM activations WHERE slug = ?").get(slug) as unknown as Activation | undefined;
}

export function createActivation(input: ActivationInput, organisationId: string, groupId: string | null = null): string {
  const id = newId();
  const cols = ["id", "kind", "organisation_id", "group_id", ...EDITABLE_FIELDS];
  db()
    .prepare(`INSERT INTO activations (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
    .run(id, input.kind, organisationId, input.tour_id ? null : groupId, ...EDITABLE_FIELDS.map((f) => input[f] ?? null));
  return id;
}

/** Crew and comp activations have no public page, so their slug is generated rather than chosen. */
export function generateSlug(kind: ActivationKind, artist: string, tour: string): string {
  const base = `${KIND_SLUG_PREFIX[kind]}${artist}-${tour}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  let slug = base || "activation";
  for (let n = 2; getActivationBySlug(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function updateActivation(id: string, input: ActivationInput): void {
  db()
    .prepare(`UPDATE activations SET ${EDITABLE_FIELDS.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...EDITABLE_FIELDS.map((f) => input[f] ?? null), nowIso(), id);
}

/**
 * Deletes an activation with its codes, passes, sign-up links, emails and imported sales.
 * People left with no passes anywhere are removed too (their data was only held for this).
 */
export function deleteActivation(id: string): void {
  tx((conn) => {
    const fans = conn.prepare("SELECT DISTINCT fan_id FROM opt_ins WHERE activation_id = ?").all(id) as { fan_id: string }[];
    conn.prepare("DELETE FROM opt_ins WHERE activation_id = ?").run(id);
    conn.prepare("DELETE FROM redemptions WHERE activation_id = ?").run(id);
    conn.prepare("DELETE FROM activations WHERE id = ?").run(id);
    const orphan = conn.prepare("DELETE FROM fans WHERE id = ? AND NOT EXISTS (SELECT 1 FROM opt_ins WHERE fan_id = ?)");
    for (const f of fans) orphan.run(f.fan_id, f.fan_id);
  });
}

export function setActivationStatus(id: string, status: ActivationStatus): void {
  db().prepare("UPDATE activations SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
}

/** The activation's dates: its tour's dates when linked to a tour, otherwise its own list. */
export function listShows(activationId: string): Show[] {
  const tourId = (db().prepare("SELECT tour_id FROM activations WHERE id = ?").get(activationId) as { tour_id: string | null } | undefined)
    ?.tour_id;
  if (tourId) {
    return db()
      .prepare(
        `SELECT id, ? AS activation_id, show_date, venue, city, country, latitude, longitude
         FROM tour_dates WHERE tour_id = ? ORDER BY show_date`,
      )
      .all(activationId, tourId) as unknown as Show[];
  }
  return db()
    .prepare("SELECT * FROM shows WHERE activation_id = ? ORDER BY show_date")
    .all(activationId) as unknown as Show[];
}

export function listActivationsForTour(tourId: string): Activation[] {
  return db().prepare("SELECT * FROM activations WHERE tour_id = ? ORDER BY created_at").all(tourId) as unknown as Activation[];
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
              COALESCE(SUM(google_pass_at IS NOT NULL), 0) AS google,
              COALESCE(SUM(revoked_at IS NOT NULL), 0) AS revoked
       FROM opt_ins WHERE activation_id = ?`,
    )
    .get(activationId) as { n: number; apple: number; google: number; revoked: number };
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
  // Uses the export's discount column when present; otherwise estimates from the
  // activation's discount (a 100% comp can't be estimated from a £0 order total).
  const discount = conn
    .prepare(
      `SELECT CASE WHEN r.discount_amount IS NULL AND a.discount_type = 'amount'
                   THEN COALESCE(a.discount_currency, r.currency) ELSE r.currency END AS currency,
              SUM(COALESCE(r.discount_amount,
                CASE WHEN a.discount_type = 'amount' THEN a.discount_value
                     WHEN a.discount_type = 'percent' AND a.discount_value < 100
                       THEN r.order_total * a.discount_value / (100 - a.discount_value) END)) AS total
       FROM redemptions r
       JOIN opt_ins o ON o.promo_code_id = r.promo_code_id
       JOIN activations a ON a.id = r.activation_id
       WHERE r.activation_id = ?
       GROUP BY 1 HAVING total IS NOT NULL ORDER BY total DESC`,
    )
    .all(activationId) as unknown as { currency: string | null; total: number }[];
  return {
    codes_total: codes.total,
    codes_available: codes.available,
    opt_ins: optIns.n,
    apple_passes: optIns.apple,
    google_passes: optIns.google,
    revoked: optIns.revoked,
    discount_given: discount,
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

export interface GroupBreakdown {
  label: string;
  issued: number;
  used: number;
  orders: number;
  revenue: { currency: string | null; total: number }[];
}

/** Crew by department, comps by group + organisation (e.g. "Venue · Wembley Stadium"). */
export function getRecipientBreakdown(activationId: string): GroupBreakdown[] {
  const conn = db();
  const label = `COALESCE(NULLIF(TRIM(COALESCE(o.recipient_group, '') ||
      CASE WHEN o.organisation IS NOT NULL AND o.organisation <> '' THEN ' · ' || o.organisation ELSE '' END), ''),
    o.role, 'Unassigned')`;
  const groups = conn
    .prepare(
      `SELECT ${label} AS label, COUNT(DISTINCT o.id) AS issued,
              COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN o.id END) AS used, COUNT(r.id) AS orders
       FROM opt_ins o LEFT JOIN redemptions r ON r.promo_code_id = o.promo_code_id
       WHERE o.activation_id = ? GROUP BY 1 ORDER BY issued DESC, label`,
    )
    .all(activationId) as unknown as Omit<GroupBreakdown, "revenue">[];
  const money = conn
    .prepare(
      `SELECT ${label} AS label, r.currency, SUM(r.order_total) AS total
       FROM opt_ins o JOIN redemptions r ON r.promo_code_id = o.promo_code_id
       WHERE o.activation_id = ? AND r.order_total IS NOT NULL GROUP BY 1, 2 ORDER BY total DESC`,
    )
    .all(activationId) as unknown as { label: string; currency: string | null; total: number }[];
  return groups.map((g) => ({
    ...g,
    revenue: money.filter((m) => m.label === g.label).map(({ currency, total }) => ({ currency, total })),
  }));
}
