"use server";

import { parseUkDate } from "@/lib/dates";
import { activationGroup, activationName, recordChange, type ChangeAction } from "@/lib/audit";
import type { Activation } from "@/lib/activations";
import type { PublicUser } from "@/lib/users";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActivation } from "@/lib/auth";
import { createSignupLink, deleteSignupLink, getSignupLink, regeneratePin, setLinkActive } from "@/lib/signup-links";
import { activationCities } from "@/lib/signup-links";
import type { FormState } from "../../../actions";

const schema = z.object({
  city: z.string().min(1, "Choose a city"),
  label: z.string().trim().max(80).optional().transform((v) => v || null),
  pass_scope: z.enum(["city", "tour"]),
  expires_at: z.string().trim().optional().transform((v) => v || null),
  max_signups: z.string().trim().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().int().positive().nullable()),
});

export async function createLinkAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, activation: a } = await requireActivation(activationId);
  if (a.kind === "fan") return { error: "Fan activations use their landing page instead" };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const closes = parsed.data.expires_at ? parseUkDate(parsed.data.expires_at) : null;
  if (parsed.data.expires_at && !closes) return { error: "Enter the closing date as DD-MM-YYYY, e.g. 13-06-2027" };
  const city = activationCities(a.id).find((c) => `${c.city}|${c.country}` === parsed.data.city);
  if (!city) return { error: "That city isn't on the tour" };
  const link = createSignupLink({
    activationId,
    city,
    label: parsed.data.label,
    passScope: parsed.data.pass_scope,
    // A chosen expiry date runs to the end of that day (UTC).
    expiresAt: closes ? `${closes}T23:59:59.000Z` : null,
    maxSignups: parsed.data.max_signups,
  });
  logLink(user, a, "created", `${city.city} link`);
  revalidatePath(`/admin/activations/${activationId}`, "layout");
  return { ok: `${city.city} link created — PIN ${link.pin}` };
}

async function forLink(activationId: string, linkId: string, fn: () => void, change?: { action: ChangeAction; what: string }) {
  const { user, activation } = await requireActivation(activationId);
  const link = getSignupLink(linkId);
  if (link?.activation_id !== activationId) return;
  fn();
  if (change) logLink(user, activation, change.action, `${link.city} link: ${change.what}`);
  revalidatePath(`/admin/activations/${activationId}`, "layout");
}

export async function newPinAction(activationId: string, linkId: string) {
  await forLink(activationId, linkId, () => regeneratePin(linkId), { action: "edited", what: "new PIN" });
}

export async function setLinkActiveAction(activationId: string, linkId: string, active: boolean) {
  await forLink(activationId, linkId, () => setLinkActive(linkId, active), { action: "edited", what: active ? "enabled" : "disabled" });
}

export async function deleteLinkAction(activationId: string, linkId: string) {
  await forLink(activationId, linkId, () => deleteSignupLink(linkId), { action: "deleted", what: "deleted" });
}

function logLink(user: PublicUser, a: Activation, action: ChangeAction, details: string) {
  recordChange(user, { action, entityType: "sign-up link", entityId: a.id, entityName: activationName(a), organisationId: a.organisation_id, group: activationGroup(a), details });
}
