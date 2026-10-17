import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { db, newId } from "./db";
import { listTourCities, type TourCity } from "./tours";

// Per-city self sign-up URLs for crew (and comps), circulated by WhatsApp / text.
// Each link is protected by a 6-digit PIN; entering it sets a signed cookie for that link.

export interface SignupLink {
  id: string;
  activation_id: string;
  token: string;
  city: string;
  country: string;
  label: string | null;
  pin: string;
  pin_version: number;
  pass_scope: "city" | "tour";
  expires_at: string | null;
  max_signups: number | null;
  active: number;
  created_at: string;
}

export interface SignupLinkWithStats extends SignupLink {
  signups: number;
}

// No 0/O/1/l/I so a link read out or retyped from a screenshot still works.
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateToken(): string {
  for (;;) {
    const token = Array.from({ length: 8 }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join("");
    if (!db().prepare("SELECT 1 FROM signup_links WHERE token = ?").get(token)) return token;
  }
}

/** Random 6-digit PIN, avoiding easily guessed ones (111111, 123456, 654321…). */
export function generatePin(): string {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const digits = pin.split("").map(Number);
    const allSame = digits.every((d) => d === digits[0]);
    const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
    const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10);
    if (!allSame && !ascending && !descending) return pin;
  }
}

/** Passes and links for a city run until the morning after its last show (late merch sales). */
export const endOfCity = (lastDate: string) => new Date(`${lastDate}T06:00:00Z`).getTime() + 86_400_000;

export function createSignupLink(input: {
  activationId: string;
  city: TourCity;
  label: string | null;
  passScope: "city" | "tour";
  expiresAt: string | null;
  maxSignups: number | null;
}): SignupLink {
  const id = newId();
  const expires = input.expiresAt ?? new Date(endOfCity(input.city.last_date)).toISOString();
  db()
    .prepare(
      `INSERT INTO signup_links (id, activation_id, token, city, country, label, pin, pass_scope, expires_at, max_signups)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(id, input.activationId, generateToken(), input.city.city, input.city.country, input.label, generatePin(),
      input.passScope, expires, input.maxSignups);
  return getSignupLink(id)!;
}

export function getSignupLink(id: string): SignupLink | undefined {
  return db().prepare("SELECT * FROM signup_links WHERE id = ?").get(id) as unknown as SignupLink | undefined;
}

export function getSignupLinkByToken(token: string): SignupLink | undefined {
  return db().prepare("SELECT * FROM signup_links WHERE token = ?").get(token) as unknown as SignupLink | undefined;
}

export function listSignupLinks(activationId: string): SignupLinkWithStats[] {
  return db()
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM opt_ins o WHERE o.signup_link_id = l.id) AS signups
       FROM signup_links l WHERE l.activation_id = ? ORDER BY l.created_at`,
    )
    .all(activationId) as unknown as SignupLinkWithStats[];
}

export function countSignups(linkId: string): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM opt_ins WHERE signup_link_id = ?").get(linkId) as { n: number }).n;
}

/** New PIN; bumping the version signs out everyone who entered the old one. */
export function regeneratePin(linkId: string): void {
  db().prepare("UPDATE signup_links SET pin = ?, pin_version = pin_version + 1 WHERE id = ?").run(generatePin(), linkId);
}

export function setLinkActive(linkId: string, active: boolean): void {
  db().prepare("UPDATE signup_links SET active = ? WHERE id = ?").run(active ? 1 : 0, linkId);
}

export function deleteSignupLink(linkId: string): void {
  db().prepare("DELETE FROM signup_links WHERE id = ?").run(linkId);
}

export type LinkState = "open" | "disabled" | "expired" | "full";

export function linkState(link: SignupLink, signups: number): LinkState {
  if (!link.active) return "disabled";
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return "expired";
  if (link.max_signups != null && signups >= link.max_signups) return "full";
  return "open";
}

/** The city's dates on the activation's tour (the dates a link covers). */
export function linkCity(tourId: string | null, link: Pick<SignupLink, "city" | "country">): TourCity | undefined {
  if (!tourId) return undefined;
  return listTourCities(tourId).find((c) => c.city === link.city && c.country === link.country);
}

/** Pass validity for someone signing up through this link. */
export function passWindow(link: SignupLink, city: TourCity | undefined): { validFrom?: string; validUntil?: string } {
  if (link.pass_scope !== "city" || !city) return {};
  return {
    validFrom: new Date(`${city.first_date}T00:00:00Z`).toISOString(),
    validUntil: new Date(endOfCity(city.last_date)).toISOString(),
  };
}

export function checkPin(link: SignupLink, pin: string): boolean {
  const a = Buffer.from(pin.replace(/\D/g, ""));
  const b = Buffer.from(link.pin);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- access cookie --------------------------------------------------------

const ACCESS_HOURS = 12;
export const accessCookieName = (link: Pick<SignupLink, "id">) => `fa_link_${link.id.slice(0, 8)}`;

const sign = (link: SignupLink, expires: number) =>
  createHmac("sha256", config.sessionSecret).update(`link:${link.id}:${link.pin_version}:${expires}`).digest("base64url");

export function createAccessValue(link: SignupLink) {
  const expires = Math.floor(Date.now() / 1000) + ACCESS_HOURS * 3600;
  return { value: `${expires}.${sign(link, expires)}`, maxAge: ACCESS_HOURS * 3600 };
}

export function hasAccess(link: SignupLink, value: string | undefined): boolean {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  const expires = Number(exp);
  if (!expires || expires < Date.now() / 1000 || !sig) return false;
  const expected = Buffer.from(sign(link, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const signupUrl = (link: Pick<SignupLink, "token">) => `${config.baseUrl}/c/${link.token}`;
