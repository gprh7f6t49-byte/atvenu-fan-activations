import Papa from "papaparse";
import { createHash } from "node:crypto";

// atVenu exports vary by report, so columns are matched by common header names
// rather than fixed positions. Unknown columns are ignored.

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES = {
  code: ["code", "promocode", "promo", "promotioncode", "discountcode", "discount", "couponcode", "coupon", "voucher", "vouchercode"],
  orderRef: ["orderid", "ordernumber", "orderno", "order", "orderref", "transactionid", "transaction", "receipt", "receiptnumber", "saleid", "ticketid"],
  total: ["total", "ordertotal", "amount", "grosssales", "gross", "saletotal", "net", "netsales", "subtotal"],
  currency: ["currency", "currencycode"],
  items: ["items", "itemcount", "quantity", "qty", "units", "unitssold"],
  date: ["date", "redeemedat", "orderdate", "datetime", "timestamp", "saledate", "createdat", "showdate"],
  venue: ["venue", "venuename", "location", "show"],
  city: ["city", "town"],
} as const;

type Field = keyof typeof ALIASES;

function buildColumnMap(headers: string[]): Partial<Record<Field, string>> {
  const map: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    const aliases = ALIASES[field] as readonly string[];
    // exact alias match first, then "contains" (e.g. "Promo Code Used")
    const exact = headers.find((h) => aliases.includes(norm(h)));
    const fuzzy = exact ?? headers.find((h) => aliases.some((a) => a.length > 3 && norm(h).includes(a)));
    if (fuzzy) map[field] = fuzzy;
  }
  return map;
}

export function parseCodesCsv(text: string): { codes: string[]; column: string | null } {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = parsed.data.map((r) => r.map((c) => String(c ?? "").trim()));
  if (rows.length === 0) return { codes: [], column: null };

  const header = rows[0];
  const map = buildColumnMap(header);
  let colIndex = 0;
  let body = rows;
  let column: string | null = null;
  if (map.code) {
    colIndex = header.indexOf(map.code);
    body = rows.slice(1);
    column = map.code;
  } else if (header.length > 1) {
    throw new Error(`Couldn't find a promo code column. Headers found: ${header.join(", ")}. Rename the code column to "code".`);
  }
  const codes = body.map((r) => r[colIndex]).filter((c): c is string => Boolean(c));
  return { codes: Array.from(new Set(codes)), column };
}

export interface RedemptionRow {
  code: string;
  orderRef: string;
  total: number | null;
  currency: string | null;
  items: number | null;
  redeemedAt: string | null;
  venue: string | null;
  city: string | null;
}

const toNumber = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const toIsoDate = (v: string | undefined) => {
  if (!v) return null;
  // DD/MM/YYYY (UK/EU exports) — Date() would read this as MM/DD.
  const dmy = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(.*)$/);
  const candidate = dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}${dmy[4]}` : v;
  const d = new Date(candidate.trim());
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
};

export function parseRedemptionsCsv(text: string): { rows: RedemptionRow[]; columns: Partial<Record<Field, string>>; skipped: number } {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const columns = buildColumnMap(headers);
  if (!columns.code) {
    throw new Error(`Couldn't find a promo code column. Headers found: ${headers.join(", ")}.`);
  }
  let skipped = 0;
  const rows: RedemptionRow[] = [];
  for (const raw of parsed.data) {
    const get = (f: Field) => (columns[f] ? String(raw[columns[f]!] ?? "").trim() : undefined);
    const code = get("code");
    if (!code) {
      skipped++;
      continue;
    }
    rows.push({
      code,
      // Without an order reference, a hash of the row keeps re-imports idempotent.
      orderRef: get("orderRef") || `row-${createHash("sha1").update(JSON.stringify(raw)).digest("hex").slice(0, 12)}`,
      total: toNumber(get("total")),
      currency: get("currency") || null,
      items: toNumber(get("items")),
      redeemedAt: toIsoDate(get("date")),
      venue: get("venue") || null,
      city: get("city") || null,
    });
  }
  return { rows, columns, skipped };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows);
}
