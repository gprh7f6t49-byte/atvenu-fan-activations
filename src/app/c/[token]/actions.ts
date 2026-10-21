"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActivation } from "@/lib/activations";
import { sendPassEmail } from "@/lib/email";
import { CodePoolExhaustedError, getPassByToken, optInFan, passShows } from "@/lib/fans";
import { isLimited, rateLimited, recordHit } from "@/lib/rate-limit";
import {
  accessCookieName,
  checkPin,
  countSignups,
  createAccessValue,
  getSignupLinkByToken,
  hasAccess,
  linkCity,
  linkState,
  passWindow,
} from "@/lib/signup-links";

export interface CrewFormState {
  error?: string;
  resent?: string;
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function submitPin(token: string, _prev: CrewFormState, form: FormData): Promise<CrewFormState> {
  const link = getSignupLinkByToken(token);
  if (!link) return { error: "This link isn't valid." };
  // 6 digits = 1,000,000 combinations. Only wrong PINs count, so crew sharing venue
  // Wi-Fi (one IP) aren't locked out by each other's successful sign-ins.
  const ipKey = `pin:${link.id}:${await clientIp()}`;
  const linkKey = `pin:${link.id}`;
  if (isLimited(ipKey, 10) || isLimited(linkKey, 100)) {
    return { error: "Too many wrong PINs. Wait 15 minutes, or ask your tour manager for help." };
  }
  if (!checkPin(link, String(form.get("pin") ?? ""))) {
    recordHit(ipKey, 15 * 60_000);
    recordHit(linkKey, 60 * 60_000);
    return { error: "That PIN isn't right. Check the message you were sent." };
  }
  const access = createAccessValue(link);
  (await cookies()).set(accessCookieName(link), access.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: access.maxAge,
    path: `/c/${link.token}`,
  });
  redirect(`/c/${link.token}`);
}

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().min(1, "Enter your last name").max(80),
  email: z.string().trim().email("Enter a valid email address").max(254),
  department: z.string().trim().min(1, "Choose your department").max(80),
  departmentOther: z.string().trim().max(80).optional(),
  organisation: z.string().trim().max(120).optional(),
  terms: z.literal("on", { message: "Please confirm you're working on this tour" }),
});

export async function submitCrewSignup(token: string, _prev: CrewFormState, form: FormData): Promise<CrewFormState> {
  if (form.get("website")) return { error: "Something went wrong. Please try again." };
  const link = getSignupLinkByToken(token);
  if (!link) return { error: "This link isn't valid." };
  if (!hasAccess(link, (await cookies()).get(accessCookieName(link))?.value)) {
    return { error: "Your session has timed out. Reload the page and enter the PIN again." };
  }
  const state = linkState(link, countSignups(link.id));
  if (state !== "open") return { error: state === "full" ? "Sign-ups for this link are full." : "This sign-up link has closed." };
  const activation = getActivation(link.activation_id);
  if (!activation || activation.status !== "live") return { error: "Sign-ups aren't open right now." };
  if (rateLimited(`crew-signup:${await clientIp()}`, 15, 10 * 60_000)) {
    return { error: "Too many sign-ups from this connection. Please wait a few minutes." };
  }

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const role = d.department === "Other" && d.departmentOther ? d.departmentOther : d.department;

  let result;
  try {
    result = optInFan(activation, {
      email: d.email,
      firstName: d.firstName,
      lastName: d.lastName,
      role,
      recipientGroup: activation.kind === "comp" ? "Venue" : undefined,
      organisation: d.organisation || (activation.kind === "crew" ? undefined : link.city),
      consentArtist: false,
      consentPromoter: false,
      consentSnapshot: JSON.stringify({
        at: new Date().toISOString(),
        self_signup: true,
        link: { city: link.city, token: link.token },
        confirmed: "I confirm I'm working on this tour. The pass is personal to me.",
      }),
      source: `${link.city} sign-up link`,
      signupLinkId: link.id,
      ...passWindow(link, linkCity(activation.id, link)),
    });
  } catch (err) {
    if (err instanceof CodePoolExhaustedError) return { error: "Sorry — there are no passes left. Let the merch team know." };
    throw err;
  }

  const pass = getPassByToken(result.passToken);
  if (pass) {
    try {
      await sendPassEmail(activation, passShows(activation, pass), pass);
    } catch (err) {
      console.error("Failed to send pass email", err);
    }
  }
  if (result.existing) {
    return { resent: `You already have a pass. We've re-sent it to ${d.email.toLowerCase()}.` };
  }
  redirect(`/p/${result.passToken}`);
}
