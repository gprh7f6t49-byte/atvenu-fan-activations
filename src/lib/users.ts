import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, newId, nowIso } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export type UserRole = "platform_admin" | "org_admin" | "org_member";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organisation_id: string | null;
  password_hash: string | null;
  password_version: number;
  disabled: number;
  last_login_at: string | null;
  created_at: string;
}

export type PublicUser = Omit<User, "password_hash">;

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: "atVenu admin",
  org_admin: "Client admin",
  org_member: "Client member",
};

// ---- passwords (scrypt, built into Node) ----------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p });
  return timingSafeEqual(expected, actual);
}

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters";
  if (password.length > 200) return "That password is too long";
  return null;
}

// ---- users ------------------------------------------------------------------

export function getUser(id: string): User | undefined {
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User | undefined;
}

export function getUserByEmail(email: string): User | undefined {
  return db().prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()) as unknown as User | undefined;
}

export function listUsers(organisationId: string | null): PublicUser[] {
  const cols = "id, email, name, role, organisation_id, password_version, disabled, last_login_at, created_at";
  return (organisationId
    ? db().prepare(`SELECT ${cols} FROM users WHERE organisation_id = ? ORDER BY created_at`).all(organisationId)
    : db().prepare(`SELECT ${cols} FROM users WHERE role = 'platform_admin' ORDER BY created_at`).all()) as unknown as PublicUser[];
}

export function createUser(input: { email: string; name?: string | null; role: UserRole; organisationId: string | null; passwordHash?: string | null }): string {
  const id = newId();
  db()
    .prepare("INSERT INTO users (id, email, name, role, organisation_id, password_hash) VALUES (?,?,?,?,?,?)")
    .run(id, input.email.trim().toLowerCase(), input.name ?? null, input.role, input.organisationId, input.passwordHash ?? null);
  return id;
}

export async function setPassword(userId: string, password: string): Promise<void> {
  // Bumping the version signs out every existing session for this user.
  db()
    .prepare("UPDATE users SET password_hash = ?, password_version = password_version + 1 WHERE id = ?")
    .run(await hashPassword(password), userId);
}

export function setUserName(userId: string, name: string | null): void {
  db().prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
}

export function setUserRole(userId: string, role: UserRole): void {
  db().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export function setUserDisabled(userId: string, disabled: boolean): void {
  db().prepare("UPDATE users SET disabled = ?, password_version = password_version + 1 WHERE id = ?").run(disabled ? 1 : 0, userId);
}

export function recordLogin(userId: string): void {
  db().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(nowIso(), userId);
}

// ---- invite / reset links -------------------------------------------------

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const TOKEN_DAYS = { invite: 14, reset: 1 } as const;

/** Creates a one-time set-password link token (the raw token is only returned, never stored). */
export function createPasswordToken(userId: string, purpose: "invite" | "reset"): string {
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + TOKEN_DAYS[purpose] * 86_400_000).toISOString();
  db().prepare("UPDATE password_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(nowIso(), userId);
  db()
    .prepare("INSERT INTO password_tokens (token_hash, user_id, purpose, expires_at) VALUES (?,?,?,?)")
    .run(hashToken(token), userId, purpose, expires);
  return token;
}

export function findPasswordToken(token: string): { user: User; purpose: "invite" | "reset" } | null {
  const row = db()
    .prepare("SELECT * FROM password_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .get(hashToken(token), nowIso()) as { user_id: string; purpose: "invite" | "reset" } | undefined;
  if (!row) return null;
  const user = getUser(row.user_id);
  return user && !user.disabled ? { user, purpose: row.purpose } : null;
}

export function consumePasswordToken(token: string): void {
  db().prepare("UPDATE password_tokens SET used_at = ? WHERE token_hash = ?").run(nowIso(), hashToken(token));
}

export function hasPendingInvite(userId: string): boolean {
  return Boolean(
    db()
      .prepare("SELECT 1 FROM password_tokens WHERE user_id = ? AND purpose = 'invite' AND used_at IS NULL AND expires_at > ?")
      .get(userId, nowIso()),
  );
}

/**
 * Makes sure there is an atVenu admin to sign in with. On first start the account is
 * created from ADMIN_EMAIL (default "admin") and ADMIN_PASSWORD; after that the
 * password is managed in the app (Account page).
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return;
  const exists = db().prepare("SELECT 1 FROM users WHERE role = 'platform_admin' LIMIT 1").get();
  if (exists) return;
  const email = (process.env.ADMIN_EMAIL || "admin").trim().toLowerCase();
  if (getUserByEmail(email)) return;
  createUser({ email, name: "atVenu admin", role: "platform_admin", organisationId: null, passwordHash: await hashPassword(password) });
}
