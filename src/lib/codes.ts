import { randomInt } from "node:crypto";
import { db, newId, nowIso, tx } from "./db";
import type { Activation } from "./activations";
import { formatDiscount } from "./discount";

// Promo codes generated here, for clients who want to go live before atVenu loads them.
// The alphabet leaves out 0/O and 1/I/L so codes survive being read out at a busy till.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MAX_GENERATE = 20_000;

export function cleanPrefix(prefix: string): string {
  return prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

/** A sensible default prefix, e.g. "OASIS27" or "OASISC27" for crew. */
export function suggestPrefix(a: Pick<Activation, "artist_name" | "kind">, year: number): string {
  const artist = cleanPrefix(a.artist_name).slice(0, 5) || "CODE";
  const kind = a.kind === "crew" ? "C" : a.kind === "comp" ? "V" : "";
  return `${artist}${kind}${String(year).slice(-2)}`;
}

function randomCode(prefix: string, length: number): string {
  let body = "";
  for (let i = 0; i < length; i++) body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return prefix ? `${prefix}-${body}` : body;
}

/**
 * Generates unique codes and adds them to the activation's pool as one batch.
 * Codes are unique across every activation on the platform, so a code can only ever
 * map to one person when sales come back from atVenu.
 */
export function generateCodes(activationId: string, opts: { quantity: number; prefix: string; length: number }) {
  const prefix = cleanPrefix(opts.prefix);
  // 31^6 ≈ 887M combinations; refuse settings that could run out of unique codes.
  if (CODE_ALPHABET.length ** opts.length < opts.quantity * 1000) throw new Error("Use a longer code length for that many codes");
  return tx((conn) => {
    const exists = conn.prepare("SELECT 1 FROM promo_codes WHERE code = ? COLLATE NOCASE");
    const fresh = new Set<string>();
    while (fresh.size < opts.quantity) {
      const code = randomCode(prefix, opts.length);
      if (!fresh.has(code) && !exists.get(code)) fresh.add(code);
    }
    const batchId = newId();
    const label = `Generated ${opts.quantity.toLocaleString("en-GB")} × ${prefix ? `${prefix}-` : ""}${"X".repeat(opts.length)}`;
    conn
      .prepare(
        `INSERT INTO import_batches (id, activation_id, kind, filename, rows_total, rows_imported, rows_skipped, source)
         VALUES (?,?,'codes',?,?,?,0,'generated')`,
      )
      .run(batchId, activationId, label, fresh.size, fresh.size);
    const insert = conn.prepare("INSERT INTO promo_codes (id, activation_id, code, import_batch_id) VALUES (?,?,?,?)");
    for (const code of fresh) insert.run(newId(), activationId, code, batchId);
    return { batchId, count: fresh.size, sample: [...fresh].slice(0, 3) };
  });
}

/** Rows for the file sent to atVenu: every code in the batch (or all generated batches) with its discount. */
export function codesForAtvenu(a: Activation, batchId: string | null) {
  const rows = db()
    .prepare(
      `SELECT c.code, c.status, b.id AS batch_id FROM promo_codes c JOIN import_batches b ON b.id = c.import_batch_id
       WHERE c.activation_id = ? AND b.source = 'generated' AND (? IS NULL OR b.id = ?)
       ORDER BY c.rowid`,
    )
    .all(a.id, batchId, batchId) as { code: string; status: string; batch_id: string }[];
  const description = `${a.artist_name} — ${a.tour_name} — ${a.kind === "fan" ? "fan offer" : a.kind === "crew" ? "crew discount" : "comp"}`;
  return {
    batchIds: [...new Set(rows.map((r) => r.batch_id))],
    rows: rows.map((r) => ({
      "Promo Code": r.code,
      "Discount Type": a.discount_type === "percent" ? "Percentage" : "Fixed amount",
      "Discount Value": a.discount_value ?? "",
      Currency: a.discount_type === "amount" ? (a.discount_currency ?? "") : "",
      Discount: formatDiscount(a) ?? "",
      "Max Uses": a.single_use ? 1 : "",
      "Valid Until": a.pass_expires_at ? a.pass_expires_at.slice(0, 10) : "",
      Description: description,
    })),
  };
}

export function markBatchesExported(batchIds: string[]): void {
  const stmt = db().prepare("UPDATE import_batches SET exported_at = COALESCE(exported_at, ?) WHERE id = ?");
  for (const id of batchIds) stmt.run(nowIso(), id);
}

export function setBatchLoaded(activationId: string, batchId: string, loaded: boolean): void {
  db()
    .prepare("UPDATE import_batches SET atvenu_loaded_at = ? WHERE id = ? AND activation_id = ? AND source = 'generated'")
    .run(loaded ? nowIso() : null, batchId, activationId);
}

/** Generated codes that atVenu hasn't confirmed loading: passes work, but the till won't accept them yet. */
export function pendingAtvenuCodes(activationId: string): { codes: number; batches: number; exported: number } {
  return db()
    .prepare(
      `SELECT COALESCE(SUM(rows_imported), 0) AS codes, COUNT(*) AS batches, COALESCE(SUM(exported_at IS NOT NULL), 0) AS exported
       FROM import_batches WHERE activation_id = ? AND source = 'generated' AND atvenu_loaded_at IS NULL`,
    )
    .get(activationId) as { codes: number; batches: number; exported: number };
}
