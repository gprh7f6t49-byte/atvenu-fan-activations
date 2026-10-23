"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canDelete, isPlatformAdmin, requireEvent, requireTour, requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { parseUkDate, formatUkDate } from "@/lib/dates";
import { addTourDates, createTour, deleteTour, deleteTourDate, listTourDates, parseDateLines, updateTour } from "@/lib/tours";
import { countryCode, importFromText, importFromUrl, type FoundDate } from "@/lib/tour-import";
import {
  createActivation,
  generateSlug,
  getActivation,
  getActivationBySlug,
  listActivationsForTour,
  listShows,
  replaceShows,
  type ActivationInput,
  type ActivationKind,
  type Show,
} from "@/lib/activations";
import { generateCodes, MAX_GENERATE, suggestPrefix } from "@/lib/codes";
import { defaultHeadline, defaultTerms, KIND_LABELS, placeFromForm } from "@/lib/discount";
import { imageFromForm } from "@/lib/uploads";
import { heroFromForm } from "@/lib/hero";
import { db, newId, tx } from "@/lib/db";
import { eventKey } from "@/lib/groups";
import type { FormState } from "../actions";
import { describeChanges, recordActivationChange, recordChange, type ChangeAction, type EntityType } from "@/lib/audit";
import type { Tour } from "@/lib/tours";
import type { PublicUser } from "@/lib/users";

function logTour(user: PublicUser, tour: Pick<Tour, "id" | "artist_name" | "name" | "organisation_id">, action: ChangeAction, entityType: EntityType = "tour", details?: string) {
  recordChange(user, {
    action, entityType, entityId: tour.id, entityName: `${tour.artist_name} · ${tour.name}`,
    organisationId: tour.organisation_id, group: { type: "tour", id: tour.id }, details,
  });
}

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
  logTour(user, { id, ...parsed.data, organisation_id: orgId }, "created", "tour", dates.length ? `${dates.length} date(s)` : undefined);
  redirect(`/admin/tours/${id}?new=1`);
}

export async function updateTourAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, tour } = await requireTour(id);
  const parsed = tourSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  updateTour(id, parsed.data);
  const details = describeChanges(tour, parsed.data, { artist_name: "Artist", name: "Tour name", notes: "Notes" });
  if (details) logTour(user, { ...tour, ...parsed.data }, tour.artist_name !== parsed.data.artist_name || tour.name !== parsed.data.name ? "renamed" : "edited", "tour", details);
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
  const { user, tour } = await requireTour(tourId);
  const parsed = dateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  addTourDates(tourId, [parsed.data]);
  logTour(user, tour, "created", "tour dates", `${formatUkDate(parsed.data.show_date)} ${parsed.data.venue}, ${parsed.data.city}`);
  revalidatePath("/admin", "layout");
  return { ok: `Added ${parsed.data.city} · ${formatUkDate(parsed.data.show_date)}` };
}

export async function deleteTourDateAction(tourId: string, dateId: string) {
  const { user, tour } = await requireTour(tourId);
  const d = listTourDates(tourId).find((x) => x.id === dateId);
  deleteTourDate(tourId, dateId);
  if (d) logTour(user, tour, "deleted", "tour dates", `${formatUkDate(d.show_date)} ${d.venue}, ${d.city}`);
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
  const { user, tour } = await requireTour(tourId);
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
  logTour(user, tour, "created", "tour dates", `${n} date(s) added from pasted text / tour page`);
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
  user: PublicUser;
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
  /** Standalone event these join (adding activations to an existing event). */
  groupId?: string;
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
  const groupId = ctx.groupId ?? newId();
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
    const id = createActivation(input, ctx.organisationId, groupId);
    if (!onTour && ctx.dates.length) replaceShows(id, ctx.dates);
    if (p.codes > 0) generateCodes(id, { quantity: p.codes, prefix: suggestPrefix(getActivation(id)!, year), length: 6 });
    recordActivationChange(ctx.user, getActivation(id)!, "created",
      [input.offer_headline, status === "live" ? "live" : "draft", p.codes ? `${p.codes} codes generated` : null].filter(Boolean).join(" · "));
    created.push({ kind: p.kind, id });
  }
  revalidatePath("/admin", "layout");
  return { created };
}

export async function setupActivationsAction(tourId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, tour } = await requireTour(tourId);
  const result = await createFromSetup(form, {
    user,
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
    user,
    organisationId: orgId,
    tourId: null,
    artist: details.data.artist_name,
    eventName: details.data.tour_name,
    existing: new Set(),
    dates,
    firstDate: dates[0]?.show_date,
  });
  if ("error" in result) return result;
  redirect(`/admin/events/${eventKey(getActivation(result.created[0].id)!)}?created=${result.created.map((c) => c.kind).join(",")}`);
}

/** Adds more activation types to a standalone event; they join its group and copy its dates. */
export async function addToEventAction(key: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, activations } = await requireEvent(key);
  const first = activations[0];
  const dates = listShows(first.id).map(({ show_date, venue, city, country, latitude, longitude }) => ({ show_date, venue, city, country, latitude, longitude }));
  // A lone older activation becomes the event's anchor: its id is the group id.
  if (!first.group_id) db().prepare("UPDATE activations SET group_id = ? WHERE id = ?").run(key, first.id);
  const result = await createFromSetup(form, {
    user,
    organisationId: first.organisation_id!,
    tourId: null,
    artist: first.artist_name,
    eventName: first.tour_name,
    existing: new Set(activations.map((a) => a.kind)),
    dates,
    firstDate: dates[0]?.show_date,
    groupId: key,
  });
  if ("error" in result) return result;
  redirect(`/admin/events/${key}?created=${result.created.map((c) => c.kind).join(",")}`);
}

/** Renames an event and/or replaces its dates, for every activation in it. */
export async function updateEventAction(key: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, activations } = await requireEvent(key);
  const details = standaloneSchema.safeParse(Object.fromEntries(form));
  if (!details.success) return { error: details.error.issues[0].message };
  let dates;
  try {
    dates = parseDateLines(String(form.get("dates") ?? ""));
  } catch (err) {
    return { error: (err as Error).message };
  }
  tx((conn) => {
    for (const a of activations) {
      conn.prepare("UPDATE activations SET artist_name = ?, tour_name = ?, updated_at = ? WHERE id = ?")
        .run(details.data.artist_name, details.data.tour_name, new Date().toISOString(), a.id);
    }
  });
  const before = activations[0];
  const beforeDates = listShows(before.id).map((s) => `${s.show_date} ${s.venue} ${s.city}`).join("|");
  for (const a of activations) replaceShows(a.id, dates);
  const changed = [
    describeChanges(before, details.data, { artist_name: "Name", tour_name: "Event" }),
    beforeDates !== dates.map((s) => `${s.show_date} ${s.venue} ${s.city}`).join("|") ? `Dates: ${dates.length} date(s)` : null,
  ].filter(Boolean).join("; ");
  if (changed) {
    recordChange(user, {
      action: before.artist_name !== details.data.artist_name || before.tour_name !== details.data.tour_name ? "renamed" : "edited",
      entityType: "event", entityId: key, entityName: `${details.data.artist_name} · ${details.data.tour_name}`,
      organisationId: before.organisation_id, group: { type: "event", id: key }, details: changed,
    });
  }
  revalidatePath("/admin", "layout");
  return { ok: "Saved for all activations in this event" };
}

/** Deletes a tour once all its activations have been deleted. */
export async function deleteTourAction(tourId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, tour } = await requireTour(tourId);
  if (!canDelete(user, tour.organisation_id)) return { error: "Only client admins can delete tours" };
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== tour.name.trim().toLowerCase()) {
    return { error: `Type the tour name (${tour.name}) to confirm` };
  }
  const dates = listTourDates(tourId).length;
  const result = deleteTour(tourId);
  if (result.error) return { error: result.error };
  logTour(user, tour, "deleted", "tour", `${dates} date(s) removed`);
  revalidatePath("/admin", "layout");
  redirect("/admin?deleted=tour");
}
