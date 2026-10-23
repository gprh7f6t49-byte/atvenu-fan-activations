"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  deleteActivation,
  getActivationBySlug,
  getActivationStats,
  setActivationStatus,
  updateActivation,
  type Activation,
  type ActivationInput,
  type ActivationStatus,
} from "@/lib/activations";
import { canDelete, isPlatformAdmin, requireActivation, requireUser } from "@/lib/auth";
import { activationGroup, activationName, describeChanges, recordActivationChange, recordChange } from "@/lib/audit";
import { groupHref, siblingActivations } from "@/lib/groups";
import { KIND_LABELS } from "@/lib/discount";
import { getTour } from "@/lib/tours";
import { parseUkDate } from "@/lib/dates";
import { imageFromForm } from "@/lib/uploads";
import { heroFromForm } from "@/lib/hero";
import { generateCodes, MAX_GENERATE, setBatchLoaded } from "@/lib/codes";
import { parseCodesCsv, parseRecipientsCsv, parseRedemptionsCsv } from "@/lib/csv";
import { coverFromForm, defaultHeadline, defaultTerms } from "@/lib/discount";
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

/**
 * Reads the activation settings form. The campaign supplies the name and dates; `existing` keeps
 * current images when no new file is chosen.
 */
async function readActivationForm(form: FormData, existing: Activation) {
  const parsed = activationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  if (d.discount_type === "percent" && d.discount_value > 100) return { error: "A percentage discount can't be more than 100%" } as const;
  if (d.discount_type === "amount" && !d.discount_currency) return { error: "Choose the currency for a fixed-amount discount" } as const;
  if (d.kind === "fan" && !d.slug) return { error: "Choose a landing page URL slug" } as const;
  const campaign = existing.tour_id ? getTour(existing.tour_id) : undefined;
  const cover = coverFromForm(form);
  if ("error" in cover) return cover;
  let passExpires: string | null = null;
  if (d.pass_expires_at) {
    const day = parseUkDate(d.pass_expires_at);
    if (!day) return { error: "Enter the pass expiry as DD-MM-YYYY, e.g. 30-09-2027" } as const;
    passExpires = `${day}T23:59:59.000Z`; // valid to the end of that day
  }
  try {
    const data = {
      ...d,
      ...cover,
      tour_id: existing.tour_id,
      artist_name: campaign?.artist_name ?? existing.artist_name,
      tour_name: campaign?.name ?? existing.tour_name,
      // Headline and terms that were still the automatic wording follow changes (e.g. adding food & drink).
      offer_headline: !d.offer_headline || d.offer_headline === defaultHeadline(existing)
        ? defaultHeadline({ ...d, ...cover, campaign_type: existing.campaign_type })
        : d.offer_headline,
      offer_terms: d.offer_terms === defaultTerms(existing.kind, existing.redeem_place, existing.campaign_type)
        ? defaultTerms(existing.kind, cover.redeem_place, existing.campaign_type)
        : d.offer_terms,
      pass_expires_at: passExpires,
    } as ActivationInput;
    if (data.discount_type === "percent") data.discount_currency = null;
    // Crew and comp activations have no landing page, so no landing image field.
    data.hero_image_url = d.kind === "fan" ? await imageFromForm(form, "hero_image", existing.hero_image_url) : existing.hero_image_url;
    data.pass_image_url = await imageFromForm(form, "pass_image", existing.pass_image_url);
    // Only fan activations have a landing page (and so the image editor).
    Object.assign(data, d.kind === "fan" ? heroFromForm(form) : {
      hero_layout: existing.hero_layout, hero_focus_x: existing.hero_focus_x, hero_focus_y: existing.hero_focus_y, hero_overlay: existing.hero_overlay,
    });
    return { data } as const;
  } catch (err) {
    return { error: (err as Error).message } as const;
  }
}

const ACTIVATION_FIELDS: Partial<Record<keyof Activation, string>> = {
  slug: "Landing page URL", offer_headline: "Headline", applies_to: "Covers",
  discount_type: "Discount type", discount_value: "Discount", discount_currency: "Currency", single_use: "Code use",
  redeem_place: "Where used", offer_terms: "Terms", tagline: "Tagline", description: "Description", promoter_name: "Promoter",
  privacy_url: "Privacy URL", primary_color: "Background colour", accent_color: "Accent colour", text_color: "Text colour",
  hero_image_url: "Landing image", pass_image_url: "Pass image", hero_layout: "Image layout", hero_overlay: "Image tint",
  status: "Status", pass_expires_at: "Pass expiry",
};

export async function updateActivationAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, activation: existing } = await requireActivation(id);
  // The activation type is fixed at creation.
  form.set("kind", existing.kind);
  if (!form.get("slug")) form.set("slug", existing.slug);
  const read = await readActivationForm(form, existing);
  if ("error" in read) return { error: read.error };
  const clash = getActivationBySlug(read.data.slug);
  if (clash && clash.id !== id) return { error: "That slug is already in use" };
  updateActivation(id, read.data);
  const details = describeChanges(existing, read.data, ACTIVATION_FIELDS);
  if (details) recordActivationChange(user, { ...existing, ...read.data }, "edited", details);
  revalidatePath(`/admin/activations/${id}`, "layout");
  return { ok: "Saved" };
}

export async function setStatusAction(id: string, status: ActivationStatus) {
  const { user, activation } = await requireActivation(id);
  setActivationStatus(id, status);
  if (activation.status !== status) recordActivationChange(user, activation, status === "live" ? "went live" : status === "ended" ? "ended" : "set to draft");
  revalidatePath(`/admin/activations/${id}`, "layout");
}

async function readUpload(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV file to upload");
  if (file.size > 20 * 1024 * 1024) throw new Error("File is larger than 20 MB");
  return { text: await file.text(), name: file.name };
}

export async function importCodesAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, activation } = await requireActivation(activationId);
  try {
    const { text, name } = await readUpload(form);
    const { codes, column } = parseCodesCsv(text);
    if (codes.length === 0) return { error: "No codes found in that file" };
    const { imported, skipped } = importCodes(activationId, codes, name);
    recordChange(user, { ...activationChange(activation), action: "created", entityType: "codes", details: `${imported} code(s) imported from ${name}` });
    revalidatePath(`/admin/activations/${activationId}`, "layout");
    return {
      ok: `Imported ${imported.toLocaleString()} code(s)${column ? ` from column "${column}"` : ""}${skipped ? ` · ${skipped} duplicate(s) skipped` : ""}.`,
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function importRedemptionsAction(activationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, activation } = await requireActivation(activationId);
  try {
    const { text, name } = await readUpload(form);
    const { rows, columns, skipped } = parseRedemptionsCsv(text);
    if (rows.length === 0) return { error: "No redemption rows with a promo code found in that file" };
    const r = importRedemptions(activationId, rows, name, skipped);
    recordChange(user, { ...activationChange(activation), action: "created", entityType: "sales", details: `${r.imported} sale(s) imported from ${name}, ${r.matched} matched` });
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
  const { user, activation } = await requireActivation(activationId);
  const parsed = generateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { count, sample } = generateCodes(activationId, parsed.data);
    recordChange(user, { ...activationChange(activation), action: "created", entityType: "codes", details: `${count} code(s) generated` });
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

/** Permanently deletes an activation (client admins only; the name must be typed to confirm). */
export async function deleteActivationAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, activation: a } = await requireActivation(id);
  if (!canDelete(user, a.organisation_id)) return { error: "Only client admins can delete activations" };
  const expected = KIND_LABELS[a.kind].name.toLowerCase();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== expected) {
    return { error: `Type "${KIND_LABELS[a.kind].name}" to confirm` };
  }
  const s = getActivationStats(id);
  const back = groupHref(a);
  deleteActivation(id);
  recordActivationChange(user, a, "deleted", `${s.opt_ins} ${a.kind === "fan" ? "sign-up(s)" : "pass(es)"}, ${s.codes_total} code(s), ${s.redemptions} sale(s) removed`);
  revalidatePath("/admin", "layout");
  // A standalone event disappears with its last activation.
  redirect(siblingCount(a) ? back : "/admin?deleted=activation");
}

/** Activations left alongside this one (same tour or event). */
function siblingCount(a: Activation) {
  // The campaign stays (even with no activations left), so go back to its overview.
  return siblingActivations(a).filter((x) => x.id !== a.id).length || 1;
}

const activationChange = (a: Activation) => ({
  entityId: a.id, entityName: activationName(a), organisationId: a.organisation_id, group: activationGroup(a),
});
