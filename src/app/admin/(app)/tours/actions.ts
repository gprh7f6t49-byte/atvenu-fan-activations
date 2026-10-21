"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isPlatformAdmin, requireTour, requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { parseUkDate, formatUkDate } from "@/lib/dates";
import { addTourDates, createTour, deleteTourDate, listTourDates, parseDateLines, updateTour } from "@/lib/tours";
import { countryCode, importFromText, importFromUrl, type FoundDate } from "@/lib/tour-import";
import {
  createActivation,
  generateSlug,
  getActivation,
  getActivationBySlug,
  listActivationsForTour,
  replaceShows,
  type ActivationInput,
  type ActivationKind,
  type Show,
} from "@/lib/activations";
import { generateCodes, MAX_GENERATE, suggestPrefix } from "@/lib/codes";
import { defaultHeadline, defaultTerms, KIND_LABELS, placeFromForm } from "@/lib/discount";
import { imageFromForm } from "@/lib/uploads";
import { heroFromForm } from "@/lib/hero";
import type { FormState } from "../actions";

const tourSchema = z.object({
  artist_name: z.string().trim().min(1, "Artist is required").max(120),
  name: z.string().trim().min(1, "Tour name is required").max(160),
  notes: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export async function createTourAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const orgId = isPlatformAdmin(user) ? String(form.get("organisation_id") ?? "") : user.organisation_id;
  if (!orgId || !getOrganisation(orgId)) return { error: "Choose which client this tour is for" };
  const parsed = tourSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let dates;
  try {
    dates = parseDateLines(String(form.get("dates") ?? ""));
  } catch (err) {
    return { error: (err as Error).message };
  }
  const id = createTour(parsed.data, orgId);
  if (dates.length) addTourDates(id, dates);
  redirect(`/admin/tours/${id}?new=1`);
}

export async function updateTourAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTour(id);
  const parsed = tourSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  updateTour(id, parsed.data);
  revalidatePath("/admin", "layout");
  return { ok: "Saved" };
}

const dateSchema = z.object({
  show_date: z.string().transform((v) => parseUkDate(v) ?? "").pipe(z.string().min(1, "Enter the date as DD-MM-YYYY, e.g. 12-06-2027")),
  venue: z.string().trim().min(1, "Venue is required").max(160),
  city: z.string().trim().min(1, "City is required").max(120),
  country: z.string().trim().toUpperCase().length(2, "Use a 2-letter country code, e.g. GB"),
  latitude: z.string().trim().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().min(-90).max(90).nullable()),
  longitude: z.string().trim().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().min(-180).max(180).nullable()),
});

export async function addTourDateAction(tourId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTour(tourId);
  const parsed = dateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  addTourDates(tourId, [parsed.data]);
  revalidatePath("/admin", "layout");
  return { ok: `Added ${parsed.data.city} · ${formatUkDate(parsed.data.show_date)}` };
}

export async function deleteTourDateAction(tourId: string, dateId: string) {
  await requireTour(tourId);
  deleteTourDate(tourId, dateId);
  revalidatePath("/admin", "layout");
}

export interface ImportState {
  error?: string;
  ok?: string;
  dates?: (FoundDate & { duplicate: boolean })[];
  note?: string;
}

/** Reads dates from a tour web page or pasted text, for the admin to review before adding. */
export async function findTourDatesAction(tourId: string, _prev: ImportState, form: FormData): Promise<ImportState> {
  await requireTour(tourId);
  const url = String(form.get("url") ?? "").trim();
  const text = String(form.get("text") ?? "").trim();
  const country = countryCode(String(form.get("default_country") ?? "")) ?? "";
  if (!url && !text) return { error: "Paste a link to the tour page, or the dates themselves" };
  if (text.length > 200_000) return { error: "That's too much text — paste just the tour dates" };
  let result;
  try {
    // Pasted text wins: it's what the person can see and is never blocked.
    result = text ? importFromText(text, country) : await importFromUrl(url, country);
  } catch (err) {
    return { error: (err as Error).message };
  }
  if (!result.dates.length) {
    return {
      error: !text
        ? "We couldn't find any dates on that page (some sites load dates with scripts we can't read). Select the dates on the page, copy them and paste them in the box instead."
        : "We couldn't find any dates in that text. Each show needs a date with a day and month, e.g. 11-06-2027, Fri 11 June 2027 or Jun 11, 2027.",
    };
  }
  const existing = new Set(listTourDates(tourId).map((d) => `${d.show_date}|${d.city.toLowerCase()}`));
  const dates = result.dates.slice(0, 300).map((d) => ({ ...d, duplicate: existing.has(`${d.show_date}|${d.city.toLowerCase()}`) }));
  const how = result.source === "structured" ? "from the page's event listings" : "from the text";
  return { dates, note: `Found ${dates.length} date(s) ${how}. Check venue, city and country, then add the ones you want.` };
}

const importedRow = z.object({
  show_date: z.string(),
  venue: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().toUpperCase().length(2),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});

export async function addImportedDatesAction(tourId: string, rows: unknown): Promise<{ error?: string; ok?: string }> {
  await requireTour(tourId);
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Tick at least one date to add" };
  if (rows.length > 300) return { error: "Add at most 300 dates at a time" };
  const clean = [];
  for (const [i, r] of rows.entries()) {
    const parsed = importedRow.safeParse(r);
    const show_date = parsed.success ? parseUkDate(parsed.data.show_date) : null;
    if (!parsed.success || !show_date) {
      return { error: `Row ${i + 1}: needs a date (DD-MM-YYYY), venue, city and 2-letter country code` };
    }
    clean.push({ ...parsed.data, show_date });
  }
  const n = addTourDates(tourId, clean);
  revalidatePath("/admin", "layout");
  return { ok: `Added ${n} date(s) to the tour` };
}

const KINDS: ActivationKind[] = ["fan", "crew", "comp"];
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #0B0B0C");

const kindSchema = z.object({
  discount_type: z.enum(["percent", "amount"]),
  discount_value: z.coerce.number({ message: "Enter the discount as a number" }).positive("Discount must be more than 0"),
  discount_currency: z.string().trim().toUpperCase().transform((v) => v || null),
  single_use: z.enum(["1", "0"]).transform(Number),
  codes: z.coerce.number().int("Codes must be a whole number").min(0).max(MAX_GENERATE, `Generate at most ${MAX_GENERATE.toLocaleString("en-GB")} codes at a time`),
});

const sharedSchema = z.object({
  primary_color: hex,
  accent_color: hex,
  text_color: hex,
  status: z.enum(["draft", "live"]),
  // Only sent when the fan activation is ticked.
  slug: z.string().optional().default("").transform((v) => v.trim().toLowerCase()).pipe(z.string().regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Landing page URL: lowercase letters, numbers and dashes only")),
});

/**
 * Creates the ticked activation types for a tour in one go. They all use the tour's dates,
 * share the branding and images, and can each get a batch of generated codes straight away.
 */
interface SetupContext {
  organisationId: string;
  /** null for a standalone activation (one-off show, pop-up, food & drink). */
  tourId: string | null;
  artist: string;
  eventName: string;
  /** Types already set up (tour only), which are skipped. */
  existing: Set<ActivationKind>;
  /** A standalone activation's own dates and locations. */
  dates: Omit<Show, "id" | "activation_id">[];
  firstDate: string | undefined;
}

/**
 * Creates the ticked activation types in one go, from the setup form. They share the dates,
 * branding, images and wording, and each can get a batch of generated codes straight away.
 */
async function createFromSetup(form: FormData, ctx: SetupContext): Promise<{ error: string } | { created: { kind: ActivationKind; id: string }[] }> {
  const kinds = KINDS.filter((k) => form.getAll("kinds").includes(k) && !ctx.existing.has(k));
  if (!kinds.length) return { error: "Tick at least one activation to set up" };

  const shared = sharedSchema.safeParse(Object.fromEntries(form));
  if (!shared.success) return { error: shared.error.issues[0].message };
  const { status, primary_color, accent_color, text_color } = shared.data;
  const colours = { primary_color, accent_color, text_color };
  let { slug } = shared.data;

  const plans = [];
  for (const kind of kinds) {
    const fields = Object.fromEntries(
      ["discount_type", "discount_value", "discount_currency", "single_use", "codes"].map((f) => [f, form.get(`${kind}_${f}`) ?? ""]),
    );
    const parsed = kindSchema.safeParse(fields);
    const label = KIND_LABELS[kind].name;
    if (!parsed.success) return { error: `${label}: ${parsed.error.issues[0].message}` };
    const d = parsed.data;
    if (d.discount_type === "percent" && d.discount_value > 100) return { error: `${label}: a percentage discount can't be more than 100%` };
    if (d.discount_type === "amount" && !d.discount_currency) return { error: `${label}: choose the currency for a fixed-amount discount` };
    if (d.discount_type === "percent") d.discount_currency = null;
    if (status === "live" && d.codes === 0) {
      return { error: `${label}: it can't go live without codes. Generate some here, or leave everything as Draft and import codes later.` };
    }
    plans.push({ kind, ...d });
  }
  if (kinds.includes("fan")) {
    slug ||= generateSlug("fan", ctx.artist, ctx.eventName);
    if (getActivationBySlug(slug)) return { error: "That landing page URL is already in use — try another" };
  }

  let heroImage: string | null = null;
  let passImage: string | null = null;
  try {
    heroImage = kinds.includes("fan") ? await imageFromForm(form, "hero_image", null) : null;
    passImage = await imageFromForm(form, "pass_image", null);
  } catch (err) {
    return { error: (err as Error).message };
  }

  const place = placeFromForm(form);
  const onTour = Boolean(ctx.tourId);
  const year = ctx.firstDate ? Number(ctx.firstDate.slice(0, 4)) : new Date().getFullYear();
  const created: { kind: ActivationKind; id: string }[] = [];
  for (const p of plans) {
    const input: ActivationInput = {
      kind: p.kind,
      tour_id: ctx.tourId,
      slug: p.kind === "fan" ? slug : generateSlug(p.kind, ctx.artist, ctx.eventName),
      artist_name: ctx.artist,
      tour_name: ctx.eventName,
      tagline: null,
      description: null,
      offer_headline: defaultHeadline({ ...p, redeem_place: place, tour_id: ctx.tourId }),
      offer_terms: defaultTerms(p.kind, place, onTour),
      redeem_place: place,
      promoter_name: null,
      ...colours,
      hero_image_url: p.kind === "fan" ? heroImage : null,
      ...heroFromForm(form),
      pass_image_url: passImage,
      privacy_url: null,
      status,
      pass_expires_at: null,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      discount_currency: p.discount_currency,
      single_use: p.single_use,
    };
    const id = createActivation(input, ctx.organisationId);
    if (!onTour && ctx.dates.length) replaceShows(id, ctx.dates);
    if (p.codes > 0) generateCodes(id, { quantity: p.codes, prefix: suggestPrefix(getActivation(id)!, year), length: 6 });
    created.push({ kind: p.kind, id });
  }
  revalidatePath("/admin", "layout");
  return { created };
}

export async function setupActivationsAction(tourId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { tour } = await requireTour(tourId);
  const result = await createFromSetup(form, {
    organisationId: tour.organisation_id!,
    tourId,
    artist: tour.artist_name,
    eventName: tour.name,
    existing: new Set(listActivationsForTour(tourId).map((a) => a.kind)),
    dates: [],
    firstDate: listTourDates(tourId)[0]?.show_date,
  });
  if ("error" in result) return result;
  redirect(`/admin/tours/${tourId}?created=${result.created.map((c) => c.kind).join(",")}`);
}

const standaloneSchema = z.object({
  artist_name: z.string().trim().min(1, "Enter the artist, brand or venue").max(120),
  tour_name: z.string().trim().min(1, "Enter the event or campaign name").max(160),
});

/** Activations without a tour: a one-off show or two, a pop-up shop, food & drink. */
export async function createStandaloneAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const orgId = isPlatformAdmin(user) ? String(form.get("organisation_id") ?? "") : user.organisation_id;
  if (!orgId || !getOrganisation(orgId)) return { error: "Choose which client this is for" };
  const details = standaloneSchema.safeParse(Object.fromEntries(form));
  if (!details.success) return { error: details.error.issues[0].message };

  // Date rows: d_date / d_venue / d_city / d_country, in order. Blank rows are ignored.
  const col = (k: string) => form.getAll(k).map((v) => String(v).trim());
  const [dd, dv, dc, dn] = [col("d_date"), col("d_venue"), col("d_city"), col("d_country")];
  const dates: Omit<Show, "id" | "activation_id">[] = [];
  for (let i = 0; i < dd.length; i++) {
    if (!dd[i] && !dv[i] && !dc[i]) continue;
    const show_date = parseUkDate(dd[i] ?? "");
    if (!show_date) return { error: `Date ${i + 1}: enter it as DD-MM-YYYY, e.g. 12-06-2027` };
    if (!dv[i]) return { error: `Date ${i + 1}: enter where it is (venue or location)` };
    dates.push({ show_date, venue: dv[i], city: dc[i] || dv[i], country: (dn[i] || "").toUpperCase().slice(0, 2), latitude: null, longitude: null });
  }
  dates.sort((x, y) => x.show_date.localeCompare(y.show_date));

  const result = await createFromSetup(form, {
    organisationId: orgId,
    tourId: null,
    artist: details.data.artist_name,
    eventName: details.data.tour_name,
    existing: new Set(),
    dates,
    firstDate: dates[0]?.show_date,
  });
  if ("error" in result) return result;
  const first = result.created[0];
  redirect(result.created.length === 1
    ? `/admin/activations/${first.id}/imports?created=1`
    : `/admin?created=${result.created.map((c) => c.kind).join(",")}`);
}
