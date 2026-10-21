"use server";

import { parseUkDate } from "@/lib/dates";
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
  const { activation: a } = await requireActivation(activationId);
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
  revalidatePath(`/admin/activations/${activationId}`, "layout");
  return { ok: `${city.city} link created — PIN ${link.pin}` };
}

async function forLink(activationId: string, linkId: string, fn: () => void) {
  await requireActivation(activationId);
  if (getSignupLink(linkId)?.activation_id !== activationId) return;
  fn();
  revalidatePath(`/admin/activations/${activationId}`, "layout");
}

export async function newPinAction(activationId: string, linkId: string) {
  await forLink(activationId, linkId, () => regeneratePin(linkId));
}

export async function setLinkActiveAction(activationId: string, linkId: string, active: boolean) {
  await forLink(activationId, linkId, () => setLinkActive(linkId, active));
}

export async function deleteLinkAction(activationId: string, linkId: string) {
  await forLink(activationId, linkId, () => deleteSignupLink(linkId));
}
