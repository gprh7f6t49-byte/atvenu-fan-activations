import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "./config";

// Single shared admin password for the pilot. Replace with SSO / per-user accounts
// before handing the admin to customers.

export const SESSION_COOKIE = "fa_admin";
const MAX_AGE = 60 * 60 * 12;

function sign(expires: number) {
  return createHmac("sha256", config.sessionSecret).update(`admin:${expires}`).digest("base64url");
}

export function createSessionValue() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  return { value: `${expires}.${sign(expires)}`, maxAge: MAX_AGE };
}

function isValid(value: string | undefined) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  const expires = Number(exp);
  if (!expires || expires < Date.now() / 1000 || !sig) return false;
  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function checkPassword(password: string) {
  if (!config.adminPassword) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(config.adminPassword);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin() {
  return isValid((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
