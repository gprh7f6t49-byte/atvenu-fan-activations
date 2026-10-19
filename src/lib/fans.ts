import { db, newId, newToken, nowIso, tx } from "./db";
import { listShows, type Activation, type Show } from "./activations";
import type { RedemptionRow } from "./csv";

export class CodePoolExhaustedError extends Error {
  constructor() {
    super("No promo codes left for this activation");
  }
}

export interface OptInInput {
  email: string;
  firstName: string;
  lastName?: string;
  country?: string;
  consentArtist: boolean;
  consentPromoter: boolean;
  consentAtvenu: boolean;
  consentSnapshot: string;
  source?: string;
  ip?: string;
  userAgent?: string;
  /** Crew department / comp recipient details (admin-issued passes). */
  role?: string;
  recipientGroup?: string;
  organisation?: string;
  issuedByAdmin?: boolean;
  /** Set when the person signed up through a city sign-up link. */
  signupLinkId?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface OptInResult {
  optInId: string;
  passToken: string;
  code: string;
  existing: boolean;
}

/**
 * Registers a person (fan opt-in, or an admin-issued crew/comp pass) for an activation
 * and hands them the next unused promo code. Registering the same email twice returns
 * the original code rather than burning another.
 */
export function optInFan(activation: Activation, input: OptInInput): OptInResult {
  return tx((conn) => {
    const email = input.email.trim().toLowerCase();
    let fan = conn.prepare("SELECT id FROM fans WHERE email = ?").get(email) as { id: string } | undefined;
    if (fan) {
      conn
        .prepare(
          `UPDATE fans SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
           country = COALESCE(?, country), updated_at = ? WHERE id = ?`,
        )
        .run(input.firstName || null, input.lastName || null, input.country || null, nowIso(), fan.id);
    } else {
      fan = { id: newId() };
      conn
        .prepare("INSERT INTO fans (id, email, first_name, last_name, country) VALUES (?,?,?,?,?)")
        .run(fan.id, email, input.firstName || null, input.lastName || null, input.country || null);
    }

    const existing = conn
      .prepare(
        `SELECT o.id, o.pass_token, c.code FROM opt_ins o JOIN promo_codes c ON c.id = o.promo_code_id
         WHERE o.activation_id = ? AND o.fan_id = ?`,
      )
      .get(activation.id, fan.id) as { id: string; pass_token: string; code: string } | undefined;
    if (existing) {
      return { optInId: existing.id, passToken: existing.pass_token, code: existing.code, existing: true };
    }

    const code = conn
      .prepare(
        "SELECT id, code FROM promo_codes WHERE activation_id = ? AND status = 'available' ORDER BY rowid LIMIT 1",
      )
      .get(activation.id) as { id: string; code: string } | undefined;
    if (!code) throw new CodePoolExhaustedError();

    const now = nowIso();
    conn.prepare("UPDATE promo_codes SET status = 'assigned', assigned_at = ? WHERE id = ?").run(now, code.id);
    const optInId = newId();
    const passToken = newToken();
    conn
      .prepare(
        `INSERT INTO opt_ins (id, activation_id, fan_id, promo_code_id, pass_token, consent_artist, consent_promoter,
           consent_atvenu, consent_snapshot, source, ip, user_agent, created_at,
           role, recipient_group, organisation, issued_by_admin, signup_link_id, valid_from, valid_until)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        optInId,
        activation.id,
        fan.id,
        code.id,
        passToken,
        input.consentArtist ? 1 : 0,
        input.consentPromoter ? 1 : 0,
        input.consentAtvenu ? 1 : 0,
        input.consentSnapshot,
        input.source ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
        now,
        input.role || null,
        input.recipientGroup || null,
        input.organisation || null,
        input.issuedByAdmin ? 1 : 0,
        input.signupLinkId ?? null,
        input.validFrom ?? null,
        input.validUntil ?? null,
      );
    return { optInId, passToken, code: code.code, existing: false };
  });
}

export interface PassRecord {
  opt_in_id: string;
  pass_token: string;
  activation_id: string;
  code: string;
  code_status: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  recipient_group: string | null;
  organisation: string | null;
  revoked_at: string | null;
  email_sent_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  link_city: string | null;
  link_country: string | null;
  pass_scope: "city" | "tour" | null;
  created_at: string;
}

export function getPassByToken(token: string): PassRecord | undefined {
  return db()
    .prepare(
      `SELECT o.id AS opt_in_id, o.pass_token, o.activation_id, c.code, c.status AS code_status,
              f.email, f.first_name, f.last_name, o.role, o.recipient_group, o.organisation,
              o.revoked_at, o.email_sent_at, o.valid_from, o.valid_until, o.created_at,
              l.city AS link_city, l.country AS link_country, l.pass_scope
       FROM opt_ins o JOIN promo_codes c ON c.id = o.promo_code_id JOIN fans f ON f.id = o.fan_id
       LEFT JOIN signup_links l ON l.id = o.signup_link_id
       WHERE o.pass_token = ?`,
    )
    .get(token) as unknown as PassRecord | undefined;
}

/** Dates shown on a pass: only the holder's city when their pass is limited to it. */
export function passShows(a: Activation, pass: PassRecord): Show[] {
  const shows = listShows(a.id);
  if (pass.pass_scope !== "city" || !pass.link_city) return shows;
  return shows.filter((s) => s.city === pass.link_city && s.country === pass.link_country);
}

export const passExpired = (pass: Pick<PassRecord, "valid_until">) =>
  Boolean(pass.valid_until && new Date(pass.valid_until).getTime() < Date.now());

export function markPassEvent(optInId: string, kind: "apple" | "google" | "email"): void {
  const col = { apple: "apple_pass_at", google: "google_pass_at", email: "email_sent_at" }[kind];
  db().prepare(`UPDATE opt_ins SET ${col} = COALESCE(${col}, ?) WHERE id = ?`).run(nowIso(), optInId);
}

export function importCodes(activationId: string, codes: string[], filename: string | null) {
  return tx((conn) => {
    const batchId = newId();
    conn
      .prepare("INSERT INTO import_batches (id, activation_id, kind, filename, rows_total) VALUES (?,?,?,?,?)")
      .run(batchId, activationId, "codes", filename, codes.length);
    const insert = conn.prepare(
      "INSERT OR IGNORE INTO promo_codes (id, activation_id, code, import_batch_id) VALUES (?,?,?,?)",
    );
    let imported = 0;
    for (const code of codes) {
      imported += Number(insert.run(newId(), activationId, code, batchId).changes);
    }
    const skipped = codes.length - imported;
    conn
      .prepare("UPDATE import_batches SET rows_imported = ?, rows_skipped = ?, notes = ? WHERE id = ?")
      .run(imported, skipped, skipped ? `${skipped} duplicate code(s) ignored` : null, batchId);
    return { imported, skipped };
  });
}

export function importRedemptions(activationId: string, rows: RedemptionRow[], filename: string | null, blankRows: number) {
  return tx((conn) => {
    const batchId = newId();
    conn
      .prepare("INSERT INTO import_batches (id, activation_id, kind, filename, rows_total) VALUES (?,?,?,?,?)")
      .run(batchId, activationId, "redemptions", filename, rows.length + blankRows);
    const findCode = conn.prepare(
      "SELECT id FROM promo_codes WHERE activation_id = ? AND code = ? COLLATE NOCASE",
    );
    const insert = conn.prepare(
      `INSERT OR IGNORE INTO redemptions (id, activation_id, code, promo_code_id, order_ref, order_total, currency,
         item_count, discount_amount, redeemed_at, venue, city, import_batch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const markRedeemed = conn.prepare(
      "UPDATE promo_codes SET status = 'redeemed', redeemed_at = COALESCE(redeemed_at, ?) WHERE id = ?",
    );
    let imported = 0;
    let matched = 0;
    for (const r of rows) {
      const code = findCode.get(activationId, r.code) as { id: string } | undefined;
      const changes = Number(
        insert.run(newId(), activationId, r.code, code?.id ?? null, r.orderRef, r.total, r.currency, r.items,
          r.discount, r.redeemedAt, r.venue, r.city, batchId).changes,
      );
      if (!changes) continue;
      imported++;
      if (code) {
        matched++;
        markRedeemed.run(r.redeemedAt ?? nowIso(), code.id);
      }
    }
    const duplicates = rows.length - imported;
    const notes = [
      `${matched} matched to activation codes`,
      imported - matched ? `${imported - matched} code(s) not from this activation` : null,
      duplicates ? `${duplicates} already imported` : null,
      blankRows ? `${blankRows} row(s) without a code` : null,
    ].filter(Boolean).join(" · ");
    conn
      .prepare("UPDATE import_batches SET rows_imported = ?, rows_skipped = ?, notes = ? WHERE id = ?")
      .run(imported, duplicates + blankRows, notes, batchId);
    return { imported, matched, duplicates };
  });
}

export interface ImportBatch {
  id: string;
  kind: "codes" | "redemptions";
  filename: string | null;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  notes: string | null;
  created_at: string;
}

export function listImports(activationId: string): ImportBatch[] {
  return db()
    .prepare("SELECT * FROM import_batches WHERE activation_id = ? ORDER BY created_at DESC")
    .all(activationId) as unknown as ImportBatch[];
}

export interface FanRow {
  opt_in_id: string;
  pass_token: string;
  role: string | null;
  recipient_group: string | null;
  organisation: string | null;
  revoked_at: string | null;
  link_city: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  code: string;
  code_status: string;
  consent_artist: number;
  consent_promoter: number;
  consent_atvenu: number;
  source: string | null;
  apple_pass_at: string | null;
  google_pass_at: string | null;
  email_sent_at: string | null;
  opted_in_at: string;
  orders: number;
  /** Spend per currency — a crew member may buy at UK and EU shows. */
  spend: { currency: string | null; total: number }[];
  last_purchase_at: string | null;
}

export function listFans(activationId: string, search?: string): FanRow[] {
  const like = search ? `%${search.trim()}%` : null;
  const rows = db()
    .prepare(
      `SELECT o.id AS opt_in_id, o.pass_token, o.role, o.recipient_group, o.organisation, o.revoked_at,
              (SELECT city FROM signup_links l WHERE l.id = o.signup_link_id) AS link_city, f.email, f.first_name, f.last_name, f.country, c.code, c.status AS code_status,
              o.consent_artist, o.consent_promoter, o.consent_atvenu, o.source,
              o.apple_pass_at, o.google_pass_at, o.email_sent_at, o.created_at AS opted_in_at,
              COUNT(r.id) AS orders, MAX(r.redeemed_at) AS last_purchase_at,
              (SELECT json_group_array(json_object('currency', currency, 'total', total))
                 FROM (SELECT currency, SUM(order_total) AS total FROM redemptions
                       WHERE promo_code_id = c.id AND order_total IS NOT NULL GROUP BY currency)) AS spend_json
       FROM opt_ins o
       JOIN fans f ON f.id = o.fan_id
       JOIN promo_codes c ON c.id = o.promo_code_id
       LEFT JOIN redemptions r ON r.promo_code_id = c.id
       WHERE o.activation_id = ?
         AND (? IS NULL OR f.email LIKE ? OR c.code LIKE ? OR f.first_name LIKE ? OR f.last_name LIKE ?
              OR o.role LIKE ? OR o.organisation LIKE ?
              OR EXISTS (SELECT 1 FROM signup_links l WHERE l.id = o.signup_link_id AND l.city LIKE ?))
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
    )
    .all(activationId, like, like, like, like, like, like, like, like) as unknown as (Omit<FanRow, "spend"> & { spend_json: string })[];
  return rows.map(({ spend_json, ...row }) => ({ ...row, spend: JSON.parse(spend_json) }));
}

/** Everything held about one fan — used for GDPR subject access requests. */
export function exportFanData(email: string, organisationId: string | null = null) {
  const conn = db();
  const fan = conn.prepare("SELECT * FROM fans WHERE email = ?").get(email.trim().toLowerCase()) as
    | Record<string, unknown>
    | undefined;
  if (!fan) return null;
  const optIns = conn
    .prepare(
      `SELECT a.artist_name, a.tour_name, a.kind, o.created_at AS opted_in_at, c.code, o.role, o.recipient_group,
              o.organisation, o.revoked_at, o.consent_artist, o.consent_promoter,
              o.consent_atvenu, o.consent_snapshot, o.source, o.ip, o.user_agent, o.apple_pass_at, o.google_pass_at,
              o.email_sent_at
       FROM opt_ins o JOIN activations a ON a.id = o.activation_id JOIN promo_codes c ON c.id = o.promo_code_id
       WHERE o.fan_id = ? AND (? IS NULL OR a.organisation_id = ?)`,
    )
    .all(fan.id as string, organisationId, organisationId);
  if (organisationId && optIns.length === 0) return null;
  const purchases = conn
    .prepare(
      `SELECT r.code, r.order_ref, r.order_total, r.currency, r.item_count, r.redeemed_at, r.venue, r.city
       FROM redemptions r JOIN opt_ins o ON o.promo_code_id = r.promo_code_id
       JOIN activations a ON a.id = o.activation_id
       WHERE o.fan_id = ? AND (? IS NULL OR a.organisation_id = ?)`,
    )
    .all(fan.id as string, organisationId, organisationId);
  return { fan, opt_ins: optIns, purchases };
}

/**
 * Erasure for one client: removes this person's opt-ins (and emails) in that organisation's
 * activations. The person record itself is only deleted once no organisation holds an opt-in.
 */
export function deleteFanForOrg(email: string, organisationId: string): boolean {
  return tx((conn) => {
    const fan = conn.prepare("SELECT id FROM fans WHERE email = ?").get(email.trim().toLowerCase()) as { id: string } | undefined;
    if (!fan) return false;
    const removed = Number(
      conn
        .prepare("DELETE FROM opt_ins WHERE fan_id = ? AND activation_id IN (SELECT id FROM activations WHERE organisation_id = ?)")
        .run(fan.id, organisationId).changes,
    );
    if (!removed) return false;
    const remaining = conn.prepare("SELECT 1 FROM opt_ins WHERE fan_id = ? LIMIT 1").get(fan.id);
    if (!remaining) conn.prepare("DELETE FROM fans WHERE id = ?").run(fan.id);
    return true;
  });
}

/**
 * GDPR erasure (all organisations — atVenu admin only). Removes the fan, their opt-ins and emails. Their promo codes stay
 * "assigned" (never reissued — the code may still be in someone's wallet) and any
 * redemption rows remain as anonymous, unmatched sales.
 */
export function deleteFan(email: string): boolean {
  return tx((conn) => {
    const fan = conn.prepare("SELECT id FROM fans WHERE email = ?").get(email.trim().toLowerCase()) as
      | { id: string }
      | undefined;
    if (!fan) return false;
    conn.prepare("DELETE FROM fans WHERE id = ?").run(fan.id);
    return true;
  });
}

/**
 * Marks an admin-issued pass as revoked (or reinstates it). The pass page and wallet
 * downloads stop working; the code itself must also be disabled in atVenu.
 */
export function setRevoked(optInId: string, revoked: boolean, activationId: string): void {
  db()
    .prepare("UPDATE opt_ins SET revoked_at = ? WHERE id = ? AND activation_id = ?")
    .run(revoked ? nowIso() : null, optInId, activationId);
}
