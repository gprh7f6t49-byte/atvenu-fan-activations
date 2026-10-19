"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrgAdmin, requirePlatformAdmin, requireUser } from "@/lib/auth";
import { config, emailProvider } from "@/lib/config";
import { lastEmailTo, sendSystemEmail } from "@/lib/email";
import { createOrganisation, getOrganisation, getOrganisationByName, renameOrganisation } from "@/lib/orgs";
import {
  createPasswordToken,
  createUser,
  getUser,
  getUserByEmail,
  passwordProblem,
  setPassword,
  setUserDisabled,
  setUserName,
  setUserRole,
  verifyPassword,
  type UserRole,
} from "@/lib/users";
import type { FormState } from "../actions";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const optionalText = z.string().trim().max(120).optional().transform((v) => v || null);

async function sendInvite(userId: string, inviterName: string, orgName: string | null): Promise<string> {
  const user = getUser(userId)!;
  const link = `${config.baseUrl}/admin/accept/${createPasswordToken(userId, "invite")}`;
  await sendSystemEmail(
    user.email,
    `You're invited to ${config.orgName} Fan Activations`,
    `<p>${inviterName} has invited you to manage fan activations${orgName ? ` for <b>${orgName}</b>` : ""}.</p>
     <p><a href="${link}">Accept the invite and choose a password</a> (link valid for 14 days).</p>`,
  );
  return link;
}

const inviteNote = () =>
  emailProvider() ? "We've emailed them an invite. You can also send them this link:" : "Email isn't set up yet, so send them this link yourself:";

// ---- clients (atVenu admin) -------------------------------------------------

const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client's name").max(120),
  contact_email: z.string().trim().toLowerCase().email().optional().or(z.literal("")).transform((v) => v || null),
  user_name: optionalText,
  user_email: email,
});

export async function createClientAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePlatformAdmin();
  const parsed = clientSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (getOrganisationByName(d.name)) return { error: "A client with that name already exists" };
  if (getUserByEmail(d.user_email)) return { error: `${d.user_email} already has an account` };
  const orgId = createOrganisation(d.name, d.contact_email ?? d.user_email);
  const userId = createUser({ email: d.user_email, name: d.user_name, role: "org_admin", organisationId: orgId });
  const link = await sendInvite(userId, me.name ?? "atVenu", d.name);
  revalidatePath("/admin/clients");
  return { ok: `${d.name} created. ${inviteNote()}`, link };
}

export async function updateClientAction(orgId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const name = String(form.get("name") ?? "").trim();
  const contact = String(form.get("contact_email") ?? "").trim() || null;
  if (!name) return { error: "Enter a name" };
  const clash = getOrganisationByName(name);
  if (clash && clash.id !== orgId) return { error: "Another client already has that name" };
  renameOrganisation(orgId, name, contact);
  revalidatePath("/admin", "layout");
  return { ok: "Saved" };
}

// ---- team members -----------------------------------------------------------

const inviteSchema = z.object({ email, name: optionalText, role: z.enum(["org_admin", "org_member", "platform_admin"]) });

/** orgId null = invite another atVenu admin (atVenu admins only). */
export async function inviteUserAction(orgId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const me = orgId ? await requireOrgAdmin(orgId) : await requirePlatformAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const role: UserRole = orgId ? (parsed.data.role === "org_admin" ? "org_admin" : "org_member") : "platform_admin";
  if (getUserByEmail(parsed.data.email)) return { error: `${parsed.data.email} already has an account` };
  const userId = createUser({ email: parsed.data.email, name: parsed.data.name, role, organisationId: orgId });
  const link = await sendInvite(userId, me.name ?? me.email, orgId ? getOrganisation(orgId)?.name ?? null : null);
  revalidatePath("/admin", "layout");
  return { ok: `Invited ${parsed.data.email}. ${inviteNote()}`, link };
}

/** Loads a user the caller may manage (same client, or any user for atVenu admins). */
async function manageable(userId: string) {
  const target = getUser(userId);
  if (!target) throw new Error("User not found");
  const me = target.organisation_id ? await requireOrgAdmin(target.organisation_id) : await requirePlatformAdmin();
  return { me, target };
}

export async function passwordLinkAction(userId: string): Promise<FormState> {
  const { me, target } = await manageable(userId);
  if (!target.password_hash) {
    const link = await sendInvite(target.id, me.name ?? me.email, target.organisation_id ? getOrganisation(target.organisation_id)?.name ?? null : null);
    return { ok: "New invite link:", link };
  }
  const link = `${config.baseUrl}/admin/accept/${createPasswordToken(target.id, "reset")}`;
  await sendSystemEmail(target.email, "Reset your password", `<p><a href="${link}">Choose a new password</a> (valid for 24 hours).</p>`);
  return { ok: "Password reset link (valid 24 hours):", link };
}

export async function setUserDisabledAction(userId: string, disabled: boolean) {
  const { me, target } = await manageable(userId);
  if (target.id === me.id) return; // can't lock yourself out
  setUserDisabled(target.id, disabled);
  revalidatePath("/admin", "layout");
}

export async function setUserRoleAction(userId: string, role: "org_admin" | "org_member") {
  const { me, target } = await manageable(userId);
  if (target.id === me.id || target.role === "platform_admin") return;
  setUserRole(target.id, role);
  revalidatePath("/admin", "layout");
}

// ---- own account ------------------------------------------------------------

export async function updateProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  setUserName(me.id, String(form.get("name") ?? "").trim() || null);
  revalidatePath("/admin", "layout");
  return { ok: "Saved" };
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const user = getUser(me.id)!;
  if (!(await verifyPassword(String(form.get("current") ?? ""), user.password_hash))) return { error: "Your current password is wrong" };
  const next = String(form.get("password") ?? "");
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== form.get("confirm")) return { error: "The new passwords don't match" };
  await setPassword(me.id, next);
  // Changing the password ends every session, including this one.
  redirect("/admin/login");
}


export async function sendTestEmailAction(): Promise<FormState> {
  const me = await requirePlatformAdmin();
  const provider = emailProvider();
  if (!provider) return { error: "No email service is connected yet. Add POSTMARK_SERVER_TOKEN or RESEND_API_KEY in Railway." };
  await sendSystemEmail(me.email, "Test email from Fan Activations", `<p>It works! Emails from ${config.baseUrl} are being delivered via ${provider}.</p>`);
  const last = lastEmailTo(me.email);
  return last?.status === "sent"
    ? { ok: `Sent via ${provider} to ${me.email}. Check your inbox (and spam folder).` }
    : { error: `Sending failed: ${last?.error ?? "unknown error"}` };
}
