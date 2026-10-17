"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActivationBySlug, listShows } from "@/lib/activations";
import { CodePoolExhaustedError, getPassByToken, optInFan } from "@/lib/fans";
import { sendPassEmail } from "@/lib/email";
import { consentCopy } from "@/lib/consent";
import { rateLimited } from "@/lib/rate-limit";

export interface OptInState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "firstName" | "terms", string>>;
}

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().max(80).optional(),
  country: z.string().trim().max(2).optional(),
  terms: z.literal("on", { message: "Please accept the offer terms to get your code" }),
});

export async function submitOptIn(slug: string, _prev: OptInState, form: FormData): Promise<OptInState> {
  // Honeypot: real fans never see this field.
  if (form.get("website")) return { error: "Something went wrong. Please try again." };

  const activation = getActivationBySlug(slug);
  if (!activation || activation.kind !== "fan" || activation.status !== "live") return { error: "This offer isn't available right now." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
  if (rateLimited(`optin:${ip ?? "unknown"}`, 10, 10 * 60_000)) {
    return { error: "Too many attempts from this connection. Please wait a few minutes." };
  }

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: OptInState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<OptInState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const copy = consentCopy(activation);
  const consents = {
    artist: form.get("consent_artist") === "on",
    promoter: form.get("consent_promoter") === "on",
    atvenu: form.get("consent_atvenu") === "on",
  };

  let result;
  try {
    result = optInFan(activation, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      country: parsed.data.country,
      consentArtist: consents.artist,
      consentPromoter: consents.promoter,
      consentAtvenu: consents.atvenu,
      // Exact wording shown to the fan, kept as the record of consent.
      consentSnapshot: JSON.stringify({ at: new Date().toISOString(), copy, given: consents, privacy_url: activation.privacy_url }),
      source: String(form.get("source") ?? "") || undefined,
      ip,
      userAgent: h.get("user-agent") ?? undefined,
    });
  } catch (err) {
    if (err instanceof CodePoolExhaustedError) {
      return { error: "Sorry — all codes for this offer have been claimed." };
    }
    throw err;
  }

  if (!result.existing) {
    const pass = getPassByToken(result.passToken);
    if (pass) {
      try {
        await sendPassEmail(activation, listShows(activation.id), pass);
      } catch (err) {
        console.error("Failed to send pass email", err);
      }
    }
  }

  redirect(`/p/${result.passToken}${result.existing ? "?returning=1" : ""}`);
}
