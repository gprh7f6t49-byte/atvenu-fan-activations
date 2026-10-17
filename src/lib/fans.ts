import { db, newId, newToken, nowIso, tx } from "./db";
import type { Activation } from "./activations";
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
}

export interface OptInResult {
  optInId: string;
  passToken: string;
  code: string;
  existing: boolean;
}

/**
 * Registers a fan for an activation and hands them the next unused promo code.
 * A fan who signs up twice gets their original code back rather than burning another.
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
           consent_atvenu, consent_snapshot, source, ip, user_agent, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
  created_at: string;
}

export function getPassByToken(token: string): PassRecord | undefined {
  return db()
    .prepare(
      `SELECT o.id AS opt_in_id, o.pass_token, o.activation_id, c.code, c.status AS code_status,
              f.email, f.first_name, f.last_name, o.created_at
       FROM opt_ins o JOIN promo_codes c ON c.id = o.promo_code_id JOIN fans f ON f.id = o.fan_id
       WHERE o.pass_token = ?`,
    )
    .get(token) as unknown as PassRecord | undefined;
}

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
         item_count, redeemed_at, venue, city, import_batch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
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
          r.redeemedAt, r.venue, r.city, batchId).changes,
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
  spend: number;
  currency: string | null;
  last_purchase_at: string | null;
}

export function listFans(activationId: string, search?: string): FanRow[] {
  const like = search ? `%${search.trim()}%` : null;
  return db()
    .prepare(
      `SELECT o.id AS opt_in_id, f.email, f.first_name, f.last_name, f.country, c.code, c.status AS code_status,
              o.consent_artist, o.consent_promoter, o.consent_atvenu, o.source,
              o.apple_pass_at, o.google_pass_at, o.email_sent_at, o.created_at AS opted_in_at,
              COUNT(r.id) AS orders, COALESCE(SUM(r.order_total), 0) AS spend, MAX(r.currency) AS currency, MAX(r.redeemed_at) AS last_purchase_at
       FROM opt_ins o
       JOIN fans f ON f.id = o.fan_id
       JOIN promo_codes c ON c.id = o.promo_code_id
       LEFT JOIN redemptions r ON r.promo_code_id = c.id
       WHERE o.activation_id = ?
         AND (? IS NULL OR f.email LIKE ? OR c.code LIKE ? OR f.first_name LIKE ? OR f.last_name LIKE ?)
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
    )
    .all(activationId, like, like, like, like, like) as unknown as FanRow[];
}

/** Everything held about one fan — used for GDPR subject access requests. */
export function exportFanData(email: string) {
  const conn = db();
  const fan = conn.prepare("SELECT * FROM fans WHERE email = ?").get(email.trim().toLowerCase()) as
    | Record<string, unknown>
    | undefined;
  if (!fan) return null;
  const optIns = conn
    .prepare(
      `SELECT a.artist_name, a.tour_name, o.created_at AS opted_in_at, c.code, o.consent_artist, o.consent_promoter,
              o.consent_atvenu, o.consent_snapshot, o.source, o.ip, o.user_agent, o.apple_pass_at, o.google_pass_at,
              o.email_sent_at
       FROM opt_ins o JOIN activations a ON a.id = o.activation_id JOIN promo_codes c ON c.id = o.promo_code_id
       WHERE o.fan_id = ?`,
    )
    .all(fan.id as string);
  const purchases = conn
    .prepare(
      `SELECT r.code, r.order_ref, r.order_total, r.currency, r.item_count, r.redeemed_at, r.venue, r.city
       FROM redemptions r JOIN opt_ins o ON o.promo_code_id = r.promo_code_id WHERE o.fan_id = ?`,
    )
    .all(fan.id as string);
  return { fan, opt_ins: optIns, purchases };
}

/**
 * GDPR erasure. Removes the fan, their opt-ins and emails. Their promo codes stay
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
