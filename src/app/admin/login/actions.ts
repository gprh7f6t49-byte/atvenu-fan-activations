"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSessionValue, SESSION_COOKIE } from "@/lib/auth";
import { rateLimited } from "@/lib/rate-limit";

export async function login(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (rateLimited("admin-login", 20, 10 * 60_000)) return { error: "Too many attempts. Try again shortly." };
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: "Incorrect password" };
  const session = createSessionValue();
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: session.maxAge,
    path: "/",
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
