import { eventActivations, type GroupActivation } from "./groups";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getActivation, type Activation } from "./activations";
import { config } from "./config";
import { getTour, type Tour } from "./tours";
import { ensureBootstrapAdmin, getUser, type PublicUser } from "./users";

// Signed, stateless session cookie: userId.passwordVersion.expiry.signature.
// Changing a password or disabling a user bumps password_version, which ends their sessions.

export const SESSION_COOKIE = "fa_admin";
const MAX_AGE = 60 * 60 * 12;

const sign = (payload: string) => createHmac("sha256", config.sessionSecret).update(`session:${payload}`).digest("base64url");

export function createSessionValue(user: Pick<PublicUser, "id" | "password_version">) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${user.id}.${user.password_version}.${expires}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: MAX_AGE };
}

export async function setSession(user: Pick<PublicUser, "id" | "password_version">) {
  const session = createSessionValue(user);
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: session.maxAge,
    path: "/",
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

function parseSession(value: string | undefined): { userId: string; version: number } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [userId, version, exp, sig] = parts;
  if (!Number(exp) || Number(exp) < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(`${userId}.${version}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { userId, version: Number(version) };
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  await ensureBootstrapAdmin();
  const session = parseSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = getUser(session.userId);
  if (!user || user.disabled || user.password_version !== session.version) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = user;
  return rest;
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export const isPlatformAdmin = (user: Pick<PublicUser, "role">) => user.role === "platform_admin";

/** The organisation a user's lists are limited to; null means every organisation (atVenu admin). */
export const orgScope = (user: PublicUser): string | null => (isPlatformAdmin(user) ? null : user.organisation_id);

export const canAccessOrg = (user: PublicUser, orgId: string | null) =>
  isPlatformAdmin(user) || (orgId != null && user.organisation_id === orgId);

export async function requirePlatformAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (!isPlatformAdmin(user)) notFound();
  return user;
}

/** Client admins manage their own team; atVenu admins can manage any client's team. */
export async function requireOrgAdmin(orgId: string): Promise<PublicUser> {
  const user = await requireUser();
  if (!isPlatformAdmin(user) && !(user.role === "org_admin" && user.organisation_id === orgId)) notFound();
  return user;
}

/** Loads an activation the signed-in user may see, or 404s (never reveals other clients' data). */
export async function requireActivation(id: string): Promise<{ user: PublicUser; activation: Activation }> {
  const user = await requireUser();
  const activation = getActivation(id);
  if (!activation || !canAccessOrg(user, activation.organisation_id)) notFound();
  return { user, activation };
}

/** A standalone event (its activations), if this user may see it. */
export async function requireEvent(key: string): Promise<{ user: PublicUser; activations: GroupActivation[] }> {
  const user = await requireUser();
  const activations = eventActivations(key);
  if (!activations.length || !canAccessOrg(user, activations[0].organisation_id)) notFound();
  return { user, activations };
}

/** Deleting tours and activations is for client admins (and atVenu admins). */
export const canDelete = (user: Pick<PublicUser, "role" | "organisation_id">, orgId: string | null) =>
  isPlatformAdmin(user) || (user.role === "org_admin" && user.organisation_id === orgId);

export async function requireTour(id: string): Promise<{ user: PublicUser; tour: Tour }> {
  const user = await requireUser();
  const tour = getTour(id);
  if (!tour || !canAccessOrg(user, tour.organisation_id)) notFound();
  return { user, tour };
}

/** For API routes: the activation if the caller may access it, otherwise null (→ 401/404). */
export async function activationForApi(id: string): Promise<Activation | null> {
  const user = await getCurrentUser();
  const activation = getActivation(id);
  return user && activation && canAccessOrg(user, activation.organisation_id) ? activation : null;
}
