// Dates are typed and shown as DD-MM-YYYY (UK/EU style) and stored as ISO YYYY-MM-DD.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const pad = (n: number) => String(n).padStart(2, "0");

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // e.g. 31-02
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** DD-MM-YYYY (also / or . separators) or ISO YYYY-MM-DD → YYYY-MM-DD, or null if invalid. */
export function parseUkDate(input: string): string | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

/** YYYY-MM-DD (or a full ISO timestamp) → DD-MM-YYYY for form fields. */
export function formatUkDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return y && m && d ? `${d}-${m}-${y}` : "";
}

/**
 * Finds a date anywhere in free text, as written on tour pages: "11-06-2027", "11/06/27",
 * "2027-06-11", "Fri 11 June 2027", "11 Jun", "June 11, 2027". Without a year, the next
 * occurrence on or after `today` is used. Returns the ISO date and the matched text.
 */
export function findDateInText(text: string, today = new Date()): { date: string; match: string } | null {
  const numeric = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/) ?? null;
  if (numeric) {
    const d = iso(+numeric[1], +numeric[2], +numeric[3]);
    if (d) return { date: d, match: numeric[0] };
  }
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/);
  if (dmy) {
    const d = iso(+dmy[3], +dmy[2], +dmy[1]);
    if (d) return { date: d, match: dmy[0] };
  }
  const mon = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const dayFirst = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${mon}\\.?(?:,?\\s+(\\d{4}))?\\b`, "i"));
  const monthFirst = text.match(new RegExp(`\\b${mon}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"));
  const hit = dayFirst
    ? { day: +dayFirst[1], month: dayFirst[2], year: dayFirst[3], match: dayFirst[0] }
    : monthFirst
      ? { day: +monthFirst[2], month: monthFirst[1], year: monthFirst[3], match: monthFirst[0] }
      : null;
  if (!hit) return null;
  const month = MONTHS.indexOf(hit.month.slice(0, 3).toLowerCase()) + 1;
  let year = hit.year ? +hit.year : today.getUTCFullYear();
  let d = iso(year, month, hit.day);
  if (d && !hit.year && d < today.toISOString().slice(0, 10)) d = iso(++year, month, hit.day);
  return d ? { date: d, match: hit.match } : null;
}
