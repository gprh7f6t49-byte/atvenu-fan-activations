"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createActivation,
  getActivationBySlug,
  replaceShows,
  setActivationStatus,
  updateActivation,
  type ActivationInput,
  type ActivationStatus,
  type Show,
} from "@/lib/activations";
import { requireAdmin } from "@/lib/auth";
import { parseCodesCsv, parseRedemptionsCsv } from "@/lib/csv";
import { deleteFan, importCodes, importRedemptions } from "@/lib/fans";

export interface FormState {
  error?: string;
  ok?: string;
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #0B0B0C");
const optional = z.string().trim().transform((v) => v || null);

const activationSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and dashes only"),
  artist_name: z.string().trim().min(1, "Artist name is required"),
  tour_name: z.string().trim().min(1, "Tour name is required"),
  tagline: optional,
  description: optional,
  offer_headline: z.string().trim().min(1, "Offer headline is required"),
  offer_terms: optional,
  promoter_name: optional,
  primary_color: hex,
  accent_color: hex,
  text_color: hex,
  hero_image_url: optional.pipe(z.string().url("Hero image must be a full URL").nullable()),
  privacy_url: optional.pipe(z.string().url("Privacy URL must be a full URL").nullable()),
  status: z.enum(["draft", "live", "ended"]),
  pass_expires_at: optional,
});

/** One show per line: date | venue | city | country | lat | lng (lat/lng optional). */
function parseShows(text: string): Omit<Show, "id" | "activation_id">[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [date, venue, city, country, lat, lng] = line.split("|").map((p) => p.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !venue || !city) {
        throw new Error(`Show line ${i + 1} should look like "2027-06-12 | Wembley Stadium | London | GB"`);
      }
      return {
        show_date: date,
        venue,
        city,
        country: country || "",
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
      };
    });
}

function readActivationForm(form: FormData) {
  const parsed = activationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  try {
    const shows = parseShows(String(form.get("shows") ?? ""));
    const data = parsed.data as ActivationInput;
    if (data.pass_expires_at) data.pass_expires_at = new Date(data.pass_expires_at).toISOString();
    return { data, shows } as const;
  } catch (err) {
    return { error: (err as Error).message } as const;
  }
}

export async function createActivationAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const read = readActivationForm(form);
  if ("error" in read) return { error: read.error };
  if (getActivationBySlug(read.data.slug)) return { error: "That slug is already in use" };
  const id = createActivation(read.data);
  replaceShows(id, read.shows);
  redirect(`/admin/activations/${id}/imports?created=1`);
}

export async function updateActivationAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const read = readActivationForm(form);
  if ("error" in read) return { error: read.error };
  const clash = getActivationBySlug(read.data.slug);
  if (clash && clash.id !== id) return { error: "That slug is already in use" };
  updateActivation(id, read.data);
  replaceShows(id, read.shows);
  revalidatePath(`/admin/activations/${id}`, "layout");
  return { ok: "Saved" };
}

export async function setStatusAction(id: string, status: ActivationStatus) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email address" };
  if (form.get("confirm") !== email) return { error: "Type the email again in the confirmation box to delete" };
  return deleteFan(email) ? { ok: `All personal data for ${email} has been deleted.` } : { error: "No fan found with that email" };
}
