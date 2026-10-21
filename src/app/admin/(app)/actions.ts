"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getActivationBySlug,
  replaceShows,
  setActivationStatus,
  updateActivation,
  type Activation,
  type ActivationInput,
  type ActivationStatus,
  type Show,
} from "@/lib/activations";
import { isPlatformAdmin, requireActivation, requireUser } from "@/lib/auth";
import { getTour } from "@/lib/tours";
import { parseUkDate } from "@/lib/dates";
import { imageFromForm } from "@/lib/uploads";
import { heroFromForm } from "@/lib/hero";
import { generateCodes, MAX_GENERATE, setBatchLoaded } from "@/lib/codes";
import { parseCodesCsv, parseRecipientsCsv, parseRedemptionsCsv } from "@/lib/csv";
import { defaultHeadline, placeFromForm } from "@/lib/discount";
import { sendPassEmail } from "@/lib/email";
import {
  CodePoolExhaustedError,
  deleteFan,
  deleteFanForOrg,
  getPassByToken,
  importCodes,
  importRedemptions,
  optInFan,
  passShows,
  setRevoked,
} from "@/lib/fans";

export interface FormState {
  error?: string;
  ok?: string;
  /** A link to show with a copy button (invites, password resets). */
  link?: string;
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #0B0B0C");
// Fields hidden for crew / comp activations are simply absent from the form.
const optional = z.string().trim().optional().transform((v) => v || null);

const activationSchema = z.object({
  kind: z.enum(["fan", "crew", "comp"]),
  slug: z.string().trim().toLowerCase().regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Slug: lowercase letters, numbers and dashes only"),
  tour_id: z.string().trim().optional().transform((v) => v || null),
  artist_name: z.string().trim().optional().transform((v) => v ?? ""),
  tour_name: z.string().trim().optional().transform((v) => v ?? ""),
  tagline: optional,
  description: optional,
  offer_headline: z.string().trim(),
  discount_type: z.enum(["percent", "amount"]),
  discount_value: z.coerce.number({ message: "Enter the discount as a number" }).positive("Discount must be more than 0"),
  discount_currency: z.string().trim().toUpperCase().transform((v) => v || null),
  single_use: z.enum(["1", "0"]).transform(Number),
  offer_terms: optional,
  promoter_name: optional,
  primary_color: hex,
  accent_color: hex,
  text_color: hex,
  privacy_url: optional.pipe(z.string().url("Privacy URL must be a full URL").nullable()),
  status: z.enum(["draft", "live", "ended"]),
  pass_expires_at: optional,
});

/** One show per line: DD-MM-YYYY | venue | city | country | lat | lng (lat/lng optional). */
function parseShows(text: string): Omit<Show, "id" | "activation_id">[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [date, venue, city, country, lat, lng] = line.split("|").map((p) => p.trim());
      const showDate = parseUkDate(date ?? "");
      if (!showDate || !venue || !city) {
        throw new Error(`Show line ${i + 1} should look like "12-06-2027 | Wembley Stadium | London | GB"`);
      }
      return {
        show_date: showDate,
        venue,
        city,
        country: country || "",
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
      };
    });
}

/** Reads the activation form; `existing` keeps current images when no new file is chosen. */
async function readActivationForm(form: FormData, existing?: Activation) {
  const parsed = activationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  if (d.discount_type === "percent" && d.discount_value > 100) return { error: "A percentage discount can't be more than 100%" } as const;
  if (d.discount_type === "amount" && !d.discount_currency) return { error: "Choose the currency for a fixed-amount discount" } as const;
  if (d.kind === "fan" && !d.slug) return { error: "Choose a landing page URL slug" } as const;
  if (d.tour_id) {
    const tour = getTour(d.tour_id);
    if (!tour) return { error: "That tour no longer exists" } as const;
    d.artist_name = tour.artist_name;
    d.tour_name = tour.name;
  }
  if (!d.artist_name || !d.tour_name) return { error: "Enter the artist and tour name, or pick a tour" } as const;
  let passExpires: string | null = null;
  if (d.pass_expires_at) {
    const day = parseUkDate(d.pass_expires_at);
    if (!day) return { error: "Enter the pass expiry as DD-MM-YYYY, e.g. 30-09-2027" } as const;
    passExpires = `${day}T23:59:59.000Z`; // valid to the end of that day
  }
  try {
    const shows = parseShows(String(form.get("shows") ?? ""));
    const redeem_place = placeFromForm(form);
    const data = { ...d, redeem_place, offer_headline: d.offer_headline || defaultHeadline({ ...d, redeem_place }), pass_expires_at: passExpires } as ActivationInput;
    if (data.discount_type === "percent") data.discount_currency = null;
    // Crew and comp activations have no landing page, so no landing image field.
    data.hero_image_url = d.kind === "fan" ? await imageFromForm(form, "hero_image", existing?.hero_image_url ?? null) : (existing?.hero_image_url ?? null);
    data.pass_image_url = await imageFromForm(form, "pass_image", existing?.pass_image_url ?? null);
    // Only fan activations have a landing page (and so the image editor).
    Object.assign(data, d.kind === "fan" ? heroFromForm(form) : {
      hero_layout: existing?.hero_layout ?? "background", hero_focus_x: existing?.hero_focus_x ?? 50,
      hero_focus_y: existing?.hero_focus_y ?? 50, hero_overlay: existing?.hero_overlay ?? "medium",
    });
    return { data, shows } as const;
  } catch (err) {
    return { error: (err as Error).message } as const;
  }
}

export async function updateActivationAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { activation: existing } = await requireActivation(id);
  // The activation type is fixed at creation.
  form.set("kind", existing.kind);
  if (!form.get("slug")) form.set("slug", existing.slug);
  const read = await readActivationForm(form, existing);
  if ("error" in read) return { error: read.error };
  if (read.data.tour_id && getTour(read.data.tour_id)?.organisation_id !== existing.organisation_id) {
    return { error: "That tour belongs to a different client" };
  }
  const clash = getActivationBySlug(read.data.slug);
  if (clash && clash.id !== id) return { error: "That slug is already in use" };
  updateActivation(id, read.data);
  if (!read.data.tour_id) replaceShows(id, read.shows);
  revalidatePath(`/admin/activations/${id}`, "layout");
  return { ok: "Saved" };
}

export async function setStatusAction(id: string, status: ActivationStatus) {
  await requireActivation(id);
  setActivationStatus(id, status);
  revalidatePath(`/admin/activations/${id}`, "layout");
}

async function readUpload(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV file to upload");
  if (file.size > 20 * 1024 * 1024) throw new Error("File is larger than 20 MB");
  return { text: await file.text(), name: file.name };
}

export async function importCodesAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireActivation(activationId);
  try {
    const { text, name } = await readUpload(form);
    const { codes, column } = parseCodesCsv(text);
    if (codes.length === 0) return { error: "No codes found in that file" };
    const { imported, skipped } = importCodes(activationId, codes, name);
    revalidatePath(`/admin/activations/${activationId}`, "layout");
    return {
      ok: `Imported ${imported.toLocaleString()} code(s)${column ? ` from column "${column}"` : ""}${skipped ? ` · ${skipped} duplicate(s) skipped` : ""}.`,
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function importRedemptionsAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireActivation(activationId);
  try {
    const { text, name } = await readUpload(form);
    const { rows, columns, skipped } = parseRedemptionsCsv(text);
    if (rows.length === 0) return { error: "No redemption rows with a promo code found in that file" };
    const r = importRedemptions(activationId, rows, name, skipped);
    revalidatePath(`/admin/activations/${activationId}`, "layout");
    const mapped = Object.entries(columns).map(([k, v]) => `${k}→"${v}"`).join(", ");
    return {
      ok: `Imported ${r.imported} sale(s): ${r.matched} matched to fans${r.duplicates ? `, ${r.duplicates} already imported` : ""}. Columns used: ${mapped}.`,
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function deleteFanAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email address" };
  if (form.get("confirm") !== email) return { error: "Type the email again in the confirmation box to delete" };
  // A client can only erase what their own activations hold about this person.
  const deleted = isPlatformAdmin(user) ? deleteFan(email) : deleteFanForOrg(email, user.organisation_id!);
  return deleted ? { ok: `Personal data for ${email} has been deleted.` } : { error: "No one found with that email" };
}

const recipientSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  firstName: z.string().trim().min(1, "Enter a first name"),
  lastName: z.string().trim().optional(),
  role: z.string().trim().max(80).optional(),
  group: z.string().trim().max(40).optional(),
  organisation: z.string().trim().max(120).optional(),
});

type RecipientInput = z.infer<typeof recipientSchema>;

/** Issues one crew / comp pass. Returns null if the person already had one. */
async function issueOne(activation: Activation, r: RecipientInput, sendEmail: boolean) {
  const result = optInFan(activation, {
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.role,
    recipientGroup: activation.kind === "comp" ? r.group || "Other" : undefined,
    organisation: r.organisation,
    issuedByAdmin: true,
    consentArtist: false,
    consentPromoter: false,
    consentSnapshot: JSON.stringify({ at: new Date().toISOString(), issued_by_admin: true }),
  });
  if (result.existing) return null;
  if (sendEmail) {
    const pass = getPassByToken(result.passToken);
    if (pass) await sendPassEmail(activation, passShows(activation, pass), pass);
  }
  return result;
}

export async function issueRecipientAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { activation } = await requireActivation(activationId);
  if (activation.kind === "fan") return { error: "Passes can only be issued for crew or comp activations" };
  const parsed = recipientSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const result = await issueOne(activation, parsed.data, form.get("send_email") === "on");
    revalidatePath(`/admin/activations/${activationId}`, "layout");
    return result
      ? { ok: `Pass issued to ${parsed.data.firstName} with code ${result.code}.` }
      : { error: `${parsed.data.email} already has a pass for this activation.` };
  } catch (err) {
    if (err instanceof CodePoolExhaustedError) return { error: "No codes left — generate or import more codes first." };
    throw err;
  }
}

export async function bulkIssueAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { activation } = await requireActivation(activationId);
  if (activation.kind === "fan") return { error: "Passes can only be issued for crew or comp activations" };
  try {
    const { text } = await readUpload(form);
    const rows = parseRecipientsCsv(text);
    const sendEmail = form.get("send_email") === "on";
    let issued = 0;
    let existing = 0;
    const invalid: number[] = [];
    for (const [i, row] of rows.entries()) {
      const parsed = recipientSchema.safeParse(row);
      if (!parsed.success) {
        invalid.push(i + 2); // +2 = header row + 1-based
        continue;
      }
      const result = await issueOne(activation, parsed.data, sendEmail);
      if (result) issued++;
      else existing++;
    }
    revalidatePath(`/admin/activations/${activationId}`, "layout");
    return {
      ok: [
        `Issued ${issued} pass(es)${sendEmail ? " and emailed them" : ""}.`,
        existing ? `${existing} already had a pass.` : null,
        invalid.length ? `Skipped row(s) ${invalid.slice(0, 10).join(", ")}${invalid.length > 10 ? "…" : ""} (missing name or valid email).` : null,
      ].filter(Boolean).join(" "),
    };
  } catch (err) {
    if (err instanceof CodePoolExhaustedError) {
      revalidatePath(`/admin/activations/${activationId}`, "layout");
      return { error: "Ran out of codes part-way through — generate or import more codes, then re-upload (people already issued are skipped)." };
    }
    return { error: (err as Error).message };
  }
}

export async function setRevokedAction(activationId: string, optInId: string, revoked: boolean) {
  await requireActivation(activationId);
  setRevoked(optInId, revoked, activationId);
  revalidatePath(`/admin/activations/${activationId}`, "layout");
}

export async function resendPassEmailAction(activationId: string, passToken: string) {
  const { activation } = await requireActivation(activationId);
  const pass = getPassByToken(passToken);
  if (pass && pass.activation_id === activation.id && !pass.revoked_at) await sendPassEmail(activation, passShows(activation, pass), pass);
  revalidatePath(`/admin/activations/${activationId}`, "layout");
}

const generateSchema = z.object({
  quantity: z.coerce.number().int("Enter a whole number").min(1, "Generate at least 1 code").max(MAX_GENERATE, `Up to ${MAX_GENERATE.toLocaleString("en-GB")} codes at a time`),
  prefix: z.string().trim().max(12).optional().transform((v) => v ?? ""),
  length: z.coerce.number().int().min(5).max(12),
});

export async function generateCodesAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireActivation(activationId);
  const parsed = generateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { count, sample } = generateCodes(activationId, parsed.data);
    revalidatePath(`/admin/activations/${activationId}`, "layout");
    return { ok: `Generated ${count.toLocaleString("en-GB")} codes (e.g. ${sample.join(", ")}). Download them for atVenu below.` };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function setBatchLoadedAction(activationId: string, batchId: string, loaded: boolean) {
  await requireActivation(activationId);
  setBatchLoaded(activationId, batchId, loaded);
  revalidatePath(`/admin/activations/${activationId}`, "layout");
}
