import type { Activation, ActivationKind } from "./activations";

export const KIND_LABELS: Record<ActivationKind, { name: string; short: string; people: string; person: string; blurb: string }> = {
  fan: {
    name: "Fan activation",
    short: "Fan",
    people: "Fans",
    person: "fan",
    blurb: "Public landing page. Fans opt in and get a unique code as a wallet pass, and their merch purchases are tracked back to them.",
  },
  crew: {
    name: "Crew sales",
    short: "Crew",
    people: "Crew",
    person: "crew member",
    blurb: "Issue named QR passes to touring crew for a crew discount. Reusable all tour by default.",
  },
  comp: {
    name: "Venue & management comps",
    short: "Comps",
    people: "Recipients",
    person: "recipient",
    blurb: "Issue venue staff, management, label or promoter reps a QR pass with a set comp discount.",
  },
};

/** Starting values for each activation type; all editable. */
export const KIND_DEFAULTS: Record<ActivationKind, { discount: number; singleUse: boolean; codes: number }> = {
  fan: { discount: 15, singleUse: false, codes: 500 },
  crew: { discount: 25, singleUse: false, codes: 100 },
  comp: { discount: 100, singleUse: true, codes: 50 },
};

export const COMP_GROUPS = ["Venue", "Management", "Label", "Promoter", "Artist guest", "Other"] as const;

export function formatDiscount(a: Pick<Activation, "discount_type" | "discount_value" | "discount_currency">): string | null {
  if (a.discount_value == null) return null;
  if (a.discount_type === "percent") {
    return a.discount_value >= 100 ? "100% off" : `${Number(a.discount_value.toFixed(2))}% off`;
  }
  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: a.discount_currency || "GBP",
    maximumFractionDigits: Number.isInteger(a.discount_value) ? 0 : 2,
  }).format(a.discount_value);
  return `${money} off`;
}

/** Where passes are shown and the discount applied. Free text, with these suggestions. */
export const REDEEM_PLACES = ["merch stand", "pop-up shop", "bar", "food & drink stalls"] as const;
export const DEFAULT_PLACE = "merch stand";

type Wording = Pick<Activation, "artist_name" | "tour_name"> & { redeem_place?: string | null; tour_id?: string | null };

export const placeOf = (a: { redeem_place?: string | null }) => a.redeem_place?.trim() || DEFAULT_PLACE;

/** What the discount is on, for headlines: "merch", "drinks", "food & drink"… */
function goods(place: string): string {
  const p = place.toLowerCase();
  if (p.includes("merch")) return "merch";
  if (p === "bar" || p.includes("drink") || p.includes("food")) return p === "bar" ? "drinks" : "food & drink";
  return "";
}

/** "any Oasis merch stand on the Live '27 Tour" for a tour; "the bar at Summer Party" for a one-off. */
export function wherePhrase(a: Wording): string {
  const place = placeOf(a);
  if (a.tour_id) return `any ${a.artist_name} ${place} on the ${a.tour_name}`;
  // "Parklife Pop-up Shop" already says where; don't repeat it.
  return a.tour_name.toLowerCase().includes(place.toLowerCase()) ? `the ${a.tour_name}` : `the ${place} at ${a.tour_name}`;
}

/** Offer headline used when the admin leaves it blank. */
export function defaultHeadline(a: Pick<Activation, "kind" | "discount_type" | "discount_value" | "discount_currency"> & { redeem_place?: string | null; tour_id?: string | null }): string {
  const what = goods(placeOf(a));
  if (a.discount_type === "percent" && (a.discount_value ?? 0) >= 100) return what ? `Complimentary ${what}` : `Complimentary at the ${placeOf(a)}`;
  const d = formatDiscount(a) ?? "Discount";
  if (!what) return `${d} at the ${placeOf(a)}`;
  return a.kind === "fan" && a.tour_id && what === "merch" ? `${d} tour merch` : `${d} ${what}`;
}

/** Default small print for each type, worded for where the pass is used and whether it's a tour. */
export function defaultTerms(kind: ActivationKind, place: string = DEFAULT_PLACE, onTour = true): string {
  if (kind === "fan") {
    return `Use at the ${place}${onTour ? " at each show you've chosen" : ""}. Personal to you. Not exchangeable for cash.`;
  }
  if (kind === "crew") return `Crew discount for ${onTour ? "touring personnel" : "event staff"} only. Personal to the named holder — not transferable.`;
  return "Comp issued by the organiser. Personal to the named holder — not transferable or exchangeable for cash.";
}

/** Badge shown on passes, e.g. "CREW", "VENUE COMP", "MANAGEMENT COMP". */
export function passBadge(kind: ActivationKind, group?: string | null): string | null {
  if (kind === "crew") return "CREW";
  if (kind === "comp") return `${(group || "Guest").toUpperCase()} COMP`;
  return null;
}

export const CREW_DEPARTMENTS = [
  "Production", "Stage management", "Audio", "Lighting", "Video", "Backline", "Rigging", "Carpentry",
  "Wardrobe", "Hair & make-up", "Catering", "Security", "Merch", "Transport / drivers", "Local crew", "Other",
] as const;

/** Reads the "Where is the pass used?" choice (a suggestion, or "other" plus free text). */
export function placeFromForm(form: FormData): string {
  const choice = String(form.get("redeem_place") ?? "").trim();
  const text = choice === "other" ? String(form.get("redeem_place_other") ?? "").trim() : choice;
  return text.replace(/\s+/g, " ").slice(0, 40) || DEFAULT_PLACE;
}
