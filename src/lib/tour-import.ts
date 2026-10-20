import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import zlib from "node:zlib";
import { COUNTRIES } from "./countries";
import { findDateInText } from "./dates";

// Reads tour dates off an artist's or promoter's tour page so they don't have to be typed in.
// Structured data (schema.org Event, which most ticketing and artist sites publish for Google)
// is used when present; otherwise the page text is scanned for lines with a date in them.
// Nothing is saved here — the admin reviews the rows before adding them.

export interface FoundDate {
  show_date: string;
  venue: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ImportResult {
  dates: FoundDate[];
  source: "structured" | "text";
  title?: string;
}

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

// ---------------------------------------------------------------------------
// Fetching (only public web addresses — never the server's own network)
// ---------------------------------------------------------------------------

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("64:ff9b");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

// Test-only escape hatch so the import can be exercised against a local page.
const allowPrivate = () => process.env.TOUR_IMPORT_ALLOW_PRIVATE === "1" && process.env.NODE_ENV !== "production";

/** DNS lookup that refuses private addresses at connect time, so a redirect or DNS trick can't reach internal services. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true })
    .then((addrs) => {
      const ok = addrs.filter((x) => allowPrivate() || !isPrivateAddress(x.address));
      if (!ok.length) throw new Error("That address isn't on the public internet");
      if (options.all) (callback as (e: null, a: typeof ok) => void)(null, ok);
      else callback(null, ok[0].address, ok[0].family);
    })
    .catch((err) => callback(err, "", 0));
};

// Many artist and promoter sites sit behind security filters (ModSecurity, Cloudflare and the
// like) that refuse requests which don't look like a browser, typically with 403 or 406. The
// page is read once, as a person viewing it would, so send ordinary browser headers; if those
// are refused, try once more with a plainer set, which some filters prefer.
const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADER_SETS: Record<string, string>[] = [
  {
    "User-Agent": CHROME_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  },
  { "User-Agent": CHROME_UA, Accept: "*/*", "Accept-Language": "en-GB,en;q=0.9" },
];
const REFUSED = new Set([401, 403, 406, 429, 503]);

interface Got { status: number; location?: string; cookies: string[]; type: string; body: Buffer }

function get(url: URL, headers: Record<string, string>): Promise<Got> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.get(
      url,
      { lookup: safeLookup, timeout: TIMEOUT_MS, headers },
      (res) => {
        const status = res.statusCode ?? 0;
        // Cookies set along the way (e.g. a consent or bot-check cookie before a redirect) are sent back on the next hop.
        const cookies = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]);
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, cookies, type: "", body: Buffer.alloc(0) });
        }
        const enc = String(res.headers["content-encoding"] ?? "");
        const stream =
          enc.includes("br") ? res.pipe(zlib.createBrotliDecompress()) :
          enc.includes("gzip") ? res.pipe(zlib.createGunzip()) :
          enc.includes("deflate") ? res.pipe(zlib.createInflate()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new Error("That page is too large to read"));
          } else chunks.push(c);
        });
        stream.on("end", () => resolve({ status, cookies, type: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("The page took too long to respond")));
    req.on("error", reject);
  });
}

export async function fetchPage(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim().match(/^https?:\/\//i) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new Error("That doesn't look like a web address");
  }
  const jar = new Map<string, string>();
  let headerSet = 0;
  for (let hop = 0; hop <= MAX_REDIRECTS + 1; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http and https links can be read");
    if (url.username || url.password) throw new Error("Links with a username or password can't be read");
    if (!allowPrivate() && isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
      throw new Error("That address isn't on the public internet");
    }
    let res: Got;
    try {
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      res = await get(url, { ...HEADER_SETS[headerSet], ...(cookie && { Cookie: cookie }) });
    } catch (err) {
      const msg = (err as Error).message;
      throw new Error(msg.includes("public internet") || msg.includes("too") ? msg : "We couldn't open that page. Check the link, or copy the dates from the page and paste them instead.");
    }
    for (const c of res.cookies) {
      const i = c.indexOf("=");
      if (i > 0) jar.set(c.slice(0, i), c.slice(i + 1));
    }
    if (res.location) {
      const next = new URL(res.location, url);
      if (next.host !== url.host) jar.clear();
      url = next;
      continue;
    }
    if (REFUSED.has(res.status) && headerSet < HEADER_SETS.length - 1) {
      headerSet++;
      continue;
    }
    if (REFUSED.has(res.status)) {
      throw new Error(`That site doesn't allow its pages to be read automatically (error ${res.status}). Open the page, select the dates, copy them and paste them in the box below instead.`);
    }
    if (res.status === 404 || res.status === 410) throw new Error("That page wasn't found (404). Check the link.");
    if (res.status >= 400) throw new Error(`That page returned an error (${res.status}). Check the link, or copy the dates from the page and paste them instead.`);
    if (res.type && !/html|text|json|xml/.test(res.type)) throw new Error("That link isn't a web page");
    return res.body.toString("utf8");
  }
  throw new Error("That link redirects too many times");
}

// ---------------------------------------------------------------------------
// Countries and cities
// ---------------------------------------------------------------------------

const COUNTRY_ALIASES: Record<string, string> = {
  uk: "GB", "u.k.": "GB", "great britain": "GB", britain: "GB", england: "GB", scotland: "GB", wales: "GB",
  "northern ireland": "GB", "republic of ireland": "IE", eire: "IE", usa: "US", "u.s.a.": "US", "u.s.": "US",
  "united states of america": "US", america: "US", holland: "NL", "the netherlands": "NL", deutschland: "DE",
  "czech republic": "CZ", españa: "ES", espana: "ES", italia: "IT", "österreich": "AT", schweiz: "CH", suisse: "CH",
  belgique: "BE", belgië: "BE", danmark: "DK", sverige: "SE", norge: "NO", polska: "PL", suomi: "FI",
};

const CITY_COUNTRY: Record<string, string> = {
  london: "GB", manchester: "GB", cardiff: "GB", edinburgh: "GB", glasgow: "GB", birmingham: "GB", leeds: "GB",
  liverpool: "GB", newcastle: "GB", belfast: "GB", sheffield: "GB", nottingham: "GB", bristol: "GB", aberdeen: "GB",
  dublin: "IE", cork: "IE", slane: "IE", paris: "FR", lyon: "FR", marseille: "FR", nice: "FR", berlin: "DE",
  hamburg: "DE", munich: "DE", münchen: "DE", cologne: "DE", köln: "DE", frankfurt: "DE", düsseldorf: "DE",
  gelsenkirchen: "DE", amsterdam: "NL", rotterdam: "NL", arnhem: "NL", brussels: "BE", antwerp: "BE",
  madrid: "ES", barcelona: "ES", lisbon: "PT", porto: "PT", milan: "IT", rome: "IT", bologna: "IT",
  copenhagen: "DK", stockholm: "SE", gothenburg: "SE", oslo: "NO", helsinki: "FI", vienna: "AT", zurich: "CH",
  zürich: "CH", prague: "CZ", warsaw: "PL", kraków: "PL", krakow: "PL", budapest: "HU", athens: "GR",
  "new york": "US", "los angeles": "US", chicago: "US", toronto: "CA", montreal: "CA", sydney: "AU",
  melbourne: "AU", auckland: "NZ", tokyo: "JP", "mexico city": "MX", "são paulo": "BR",
};

/** A country name, alias or ISO code → ISO-2 code; null when the text isn't a country. */
export function countryCode(text: string | undefined | null): string | null {
  if (!text) return null;
  const t = text.trim().replace(/\.$/, "").toLowerCase();
  if (!t) return null;
  if (COUNTRY_ALIASES[t]) return COUNTRY_ALIASES[t];
  if (/^[a-z]{2}$/.test(t)) {
    const code = t.toUpperCase();
    return COUNTRIES.some(([c]) => c === code) ? code : null;
  }
  return COUNTRY_ALIASES[t] ?? COUNTRIES.find(([, name]) => name.toLowerCase() === t)?.[0] ?? null;
}

const cityCountry = (city: string) => CITY_COUNTRY[city.trim().toLowerCase()] ?? null;

// ---------------------------------------------------------------------------
// Structured data (schema.org Event in JSON-LD)
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

function isEvent(o: Json): boolean {
  const t = o["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && /Event$/.test(x));
}

function eventToDate(e: Json): FoundDate | null {
  const start = str(e.startDate);
  const m = start.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const loc = (first(e.location) ?? {}) as Json;
  const addr = (typeof loc.address === "string" ? { addressLocality: loc.address } : first(loc.address) ?? {}) as Json;
  const geo = (first(loc.geo) ?? {}) as Json;
  const country = first(addr.addressCountry);
  const countryText = typeof country === "object" && country ? str((country as Json).name) : str(country);
  const city = str(addr.addressLocality) || str(addr.addressRegion);
  const lat = Number(geo.latitude);
  const lng = Number(geo.longitude);
  return {
    show_date: m[1],
    venue: decodeEntities(str(loc.name)),
    city: decodeEntities(city),
    country: countryCode(countryText) ?? cityCountry(city) ?? "",
    latitude: str(geo.latitude) && Number.isFinite(lat) ? lat : null,
    longitude: str(geo.longitude) && Number.isFinite(lng) ? lng : null,
  };
}

export function datesFromStructuredData(html: string): FoundDate[] {
  const found: FoundDate[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const o = node as Json;
    if (isEvent(o)) {
      const d = eventToDate(o);
      if (d) found.push(d);
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, depth + 1);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim().replace(/^<!--|-->$/g, "")), 0);
    } catch {
      // Malformed JSON-LD is common; skip that block.
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Plain text (pasted from a tour page, or the page's visible text)
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|li|tr|h[1-6]|section|article|header|footer|ul|ol|table|tbody|dt|dd|time)\b[^>]*>/gi, "\n")
      .replace(/<\/?(td|th|span|a|strong|em|b)\b[^>]*>/gi, " | ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").replace(/(\s*\|\s*)+/g, " | ").replace(/^\s*\|\s*|\s*\|\s*$/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

const VENUE_WORDS =
  /\b(stadium|stadion|stade|estadio|arena|park|hall|centre|center|theatre|theater|field|bowl|dome|ground|club|academy|garden|gardens|o2|forum|pavilion|amphitheatre|amphitheater|ballroom|palace|palais|palau|olympia|apollo|hippodrome|coliseum|colosseum|festival|castle|racecourse|showground|halle|zentrum|kirche|church|room|rooms|house|barrowland|wembley|lido|warehouse)\b/i;
const NOISE =
  /^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|nesday|rsday|urday)?\.?$|^(tickets?|buy( tickets)?|sold out|on sale.*|more info|info|vip|rsvp|find tickets|get tickets|low tickets|limited|new date|rescheduled|cancelled|postponed|\d{1,2}[:.]\d{2}\s*(am|pm)?|doors.*|\d{4})$/i;

function cleanParts(text: string): string[] {
  return text
    .split(/\s*(?:\||—|–|\t|•|·|\s-\s|,|\/(?!\/))\s*/)
    .map((p) => p.trim().replace(/^[-:,.\s]+|[-:,\s]+$/g, ""))
    .filter((p) => p && !NOISE.test(p) && !/^\d+$/.test(p));
}

/** Turns the words around a date into venue / city / country. */
function interpret(parts: string[], defaultCountry: string): Pick<FoundDate, "venue" | "city" | "country"> {
  let country = "";
  const rest: string[] = [];
  for (const p of parts) {
    const c = !country ? countryCode(p) : null;
    if (c) country = c;
    else rest.push(p);
  }
  let venue = "";
  let city = "";
  const venueIdx = rest.findIndex((p) => VENUE_WORDS.test(p) && !cityCountry(p));
  if (venueIdx >= 0) {
    venue = rest[venueIdx];
    city = rest.find((p, i) => i !== venueIdx && !VENUE_WORDS.test(p)) ?? rest.find((_, i) => i !== venueIdx) ?? "";
  } else if (rest.length >= 2) {
    // "City, Venue" or "Venue, City": a known city decides; otherwise assume venue comes first.
    if (cityCountry(rest[0])) [city, venue] = [rest[0], rest[1]];
    else [venue, city] = [rest[0], rest[1]];
  } else if (rest.length === 1) {
    if (cityCountry(rest[0])) city = rest[0];
    else venue = rest[0];
  }
  return { venue, city, country: country || cityCountry(city) || defaultCountry };
}

export function datesFromText(text: string, defaultCountry = "", today = new Date()): FoundDate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: FoundDate[] = [];
  for (let i = 0; i < lines.length; i++) {
    const hit = findDateInText(lines[i], today);
    if (!hit) continue;
    let parts = cleanParts(lines[i].replace(hit.match, " | "));
    // Many tour pages put the date on its own line with venue and city on the next lines.
    for (let j = i + 1; parts.length < 2 && j < lines.length && j <= i + 3; j++) {
      if (findDateInText(lines[j], today)) break;
      parts = parts.concat(cleanParts(lines[j]));
    }
    const { venue, city, country } = interpret(parts.slice(0, 4), defaultCountry);
    if (!venue && !city) continue;
    out.push({ show_date: hit.date, venue, city, country, latitude: null, longitude: null });
  }
  return out;
}

// ---------------------------------------------------------------------------

function dedupe(dates: FoundDate[]): FoundDate[] {
  const seen = new Set<string>();
  return dates
    .filter((d) => {
      const key = `${d.show_date}|${d.city.toLowerCase() || d.venue.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.show_date.localeCompare(b.show_date));
}

/** Finds tour dates in a page's HTML: structured data first, the visible text as a fallback. */
export function datesFromHtml(html: string, defaultCountry = "", today = new Date()): ImportResult {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "") || undefined;
  const structured = dedupe(datesFromStructuredData(html)).map((d) => ({ ...d, country: d.country || defaultCountry }));
  if (structured.length) return { dates: structured, source: "structured", title };
  return { dates: dedupe(datesFromText(htmlToText(html), defaultCountry, today)), source: "text", title };
}

export async function importFromUrl(url: string, defaultCountry = ""): Promise<ImportResult> {
  return datesFromHtml(await fetchPage(url), defaultCountry);
}

export function importFromText(text: string, defaultCountry = ""): ImportResult {
  return { dates: dedupe(datesFromText(text, defaultCountry)), source: "text" };
}
