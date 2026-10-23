import type { Activation, ActivationKind } from "./activations";
import { CAMPAIGN_TYPES, type CampaignType } from "./campaigns";

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

/** What a discount covers: merch, food & drink, or both on one pass. */
export type AppliesTo = "merch" | "fnb" | "both";
export const APPLIES_LABELS: Record<AppliesTo, string> = { merch: "Merch", fnb: "Food & drink", both: "Merch + food & drink" };
export const DEFAULT_PLACE = "merch stand";
const DEFAULT_PLACES: Record<AppliesTo, string> = { merch: "merch stand", fnb: "bars & food stalls", both: "merch stands, bars & food stalls" };
const GOODS: Record<AppliesTo, string> = { merch: "merch", fnb: "food & drink", both: "merch, food & drink" };

export const isAppliesTo = (v: unknown): v is AppliesTo => v === "merch" || v === "fnb" || v === "both";

type Wording = Pick<Activation, "artist_name" | "tour_name"> & {
  redeem_place?: string | null;
  applies_to?: AppliesTo | null;
  campaign_type?: CampaignType | null;
};

/** Where the pass is shown: the activation's own wording, or the default for what it covers. */
export const placeOf = (a: { redeem_place?: string | null; applies_to?: AppliesTo | null }) =>
  a.redeem_place?.trim() || DEFAULT_PLACES[a.applies_to ?? "merch"];

export const defaultPlaceFor = (appliesTo: AppliesTo) => DEFAULT_PLACES[appliesTo];

/**
 * "any Oasis merch stand on the Live '27 Tour" (tour), "the bars & food stalls at Parklife 2027"
 * (festival), "the Parklife Pop-up Shop" (an event whose name already says where).
 */
export function wherePhrase(a: Wording): string {
  const place = placeOf(a);
  if ((a.campaign_type ?? "tour") === "tour") return `any ${a.artist_name} ${place} on the ${a.tour_name}`;
  const name = a.campaign_type === "festival" ? `${a.artist_name} ${a.tour_name}`.trim() : a.tour_name;
  return name.toLowerCase().includes(place.toLowerCase()) ? `the ${name}` : `the ${place} at ${name}`;
}

/** Offer headline used when the admin leaves it blank: "15% off tour merch", "20% off food & drink". */
export function defaultHeadline(a: Pick<Activation, "kind" | "discount_type" | "discount_value" | "discount_currency"> & {
  applies_to?: AppliesTo | null; campaign_type?: CampaignType | null;
}): string {
  const what = GOODS[a.applies_to ?? "merch"];
  if (a.discount_type === "percent" && (a.discount_value ?? 0) >= 100) return `Complimentary ${what}`;
  const d = formatDiscount(a) ?? "Discount";
  return a.kind === "fan" && (a.campaign_type ?? "tour") === "tour" && what === "merch" ? `${d} tour merch` : `${d} ${what}`;
}

/** Default small print for each type, worded for where the pass is used and the kind of campaign. */
export function defaultTerms(kind: ActivationKind, place: string = DEFAULT_PLACE, campaign: CampaignType = "tour"): string {
  const noun = CAMPAIGN_TYPES[campaign].dateNoun;
  if (kind === "fan") return `Use at the ${place} on each ${noun} you've chosen. Personal to you. Not exchangeable for cash.`;
  const staff = campaign === "tour" ? "touring personnel" : campaign === "festival" ? "festival crew and staff" : "event staff";
  if (kind === "crew") return `Crew discount for ${staff} only. Personal to the named holder — not transferable.`;
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

/**
 * Reads the "What does the discount cover?" fields: merch and/or food & drink (cover_merch,
 * cover_fnb) plus optional wording for where the pass is shown (redeem_place).
 */
export function coverFromForm(form: FormData): { applies_to: AppliesTo; redeem_place: string } | { error: string } {
  const merch = form.get("cover_merch") === "1";
  const fnb = form.get("cover_fnb") === "1";
  if (!merch && !fnb) return { error: "Choose what the discount covers: merch, food & drink, or both" };
  const applies_to: AppliesTo = merch && fnb ? "both" : fnb ? "fnb" : "merch";
  const custom = String(form.get("redeem_place") ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return { applies_to, redeem_place: custom || DEFAULT_PLACES[applies_to] };
}
