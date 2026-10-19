"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, setSession } from "@/lib/auth";
import { config, emailProvider } from "@/lib/config";
import { sendSystemEmail } from "@/lib/email";
import { isLimited, recordHit } from "@/lib/rate-limit";
import {
  consumePasswordToken,
  createPasswordToken,
  ensureBootstrapAdmin,
  findPasswordToken,
  getUserByEmail,
  passwordProblem,
  recordLogin,
  setPassword,
  setUserName,
  verifyPassword,
  getUser,
} from "@/lib/users";

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function login(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  await ensureBootstrapAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const keys = [`login:${email}`, `login-ip:${await ip()}`];
  if (isLimited(keys[0], 10) || isLimited(keys[1], 30)) return { error: "Too many attempts. Try again in 15 minutes." };

  const user = getUserByEmail(email);
  if (!user || user.disabled || !(await verifyPassword(password, user.password_hash))) {
    keys.forEach((k) => recordHit(k, 15 * 60_000));
    return { error: "Email or password is incorrect" };
  }
  recordLogin(user.id);
  await setSession(user);
  redirect("/admin");
}

export async function logout() {
  await clearSession();
  redirect("/admin/login");
}

const setPasswordSchema = z.object({
  name: z.string().trim().max(80).optional(),
  password: z.string(),
  confirm: z.string(),
});

/** Completes an invite or reset link: sets the password and signs the user in. */
export async function acceptToken(token: string, _prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const found = findPasswordToken(token);
  if (!found) return { error: "This link has expired or has already been used. Ask for a new one." };
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please fill in the form" };
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem };
  if (parsed.data.password !== parsed.data.confirm) return { error: "The passwords don't match" };

  await setPassword(found.user.id, parsed.data.password);
  if (parsed.data.name) setUserName(found.user.id, parsed.data.name);
  consumePasswordToken(token);
  const user = getUser(found.user.id)!;
  recordLogin(user.id);
  await setSession(user);
  redirect("/admin");
}

/** Always answers the same way, so it can't be used to find out who has an account. */
export async function forgotPassword(_prev: { ok?: string; error?: string }, form: FormData): Promise<{ ok?: string; error?: string }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const key = `forgot:${await ip()}`;
  if (isLimited(key, 5)) return { error: "Too many requests. Try again later." };
  recordHit(key, 60 * 60_000);
  const user = getUserByEmail(email);
  if (user && !user.disabled) {
    const link = `${config.baseUrl}/admin/accept/${createPasswordToken(user.id, "reset")}`;
    await sendSystemEmail(user.email, "Reset your password", `<p>Someone asked to reset the password for your ${config.orgName} Activations account.</p>
      <p><a href="${link}">Choose a new password</a> (this link works for 24 hours).</p><p>If this wasn't you, you can ignore this email.</p>`);
  }
  return {
    ok: emailProvider()
      ? "If that email has an account, we've sent a link to reset the password."
      : "Email isn't set up yet, so ask your atVenu contact to send you a reset link.",
  };
}
