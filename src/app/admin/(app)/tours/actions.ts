"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isPlatformAdmin, requireTour, requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { addTourDates, createTour, deleteTourDate, parseDateLines, updateTour } from "@/lib/tours";
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
  redirect(`/admin/tours/${id}`);
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
  show_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
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
  return { ok: `Added ${parsed.data.city} · ${parsed.data.show_date}` };
}

export async function pasteTourDatesAction(tourId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTour(tourId);
  try {
    const n = addTourDates(tourId, parseDateLines(String(form.get("dates") ?? "")));
    revalidatePath("/admin", "layout");
    return n ? { ok: `Added ${n} date(s)` } : { error: "Paste at least one date" };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function deleteTourDateAction(tourId: string, dateId: string) {
  await requireTour(tourId);
  deleteTourDate(tourId, dateId);
  revalidatePath("/admin", "layout");
}
