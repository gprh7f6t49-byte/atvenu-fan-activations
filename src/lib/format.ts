export const fmtInt = (n: number) => n.toLocaleString("en-GB");

export const fmtMoney = (n: number, currency: string | null) =>
  currency
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
    : n.toLocaleString("en-GB", { maximumFractionDigits: 0 });

export const fmtPct = (num: number, den: number) => (den ? `${((num / den) * 100).toFixed(1)}%` : "—");

export const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

/** "£1,240 · €860" — totals are never summed across currencies. */
export const fmtRevenue = (rows: { currency: string | null; total: number }[]) =>
  rows.length ? rows.map((r) => fmtMoney(r.total, r.currency)).join(" · ") : fmtMoney(0, null);
