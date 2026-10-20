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
export const KIND_DEFAULTS: Record<ActivationKind, { discount: number; singleUse: boolean; codes: number; terms: string }> = {
  fan: { discount: 15, singleUse: false, codes: 500, terms: "Use at the official merch stand at each show you've chosen. Personal to you. Not exchangeable for cash." },
  crew: { discount: 25, singleUse: false, codes: 100, terms: "Crew discount for touring personnel only. Personal to the named holder — not transferable." },
  comp: { discount: 100, singleUse: true, codes: 50, terms: "Comp issued by the merch team. Personal to the named holder — not transferable or exchangeable for cash." },
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

/** Offer headline used when the admin leaves it blank. */
export function defaultHeadline(a: Pick<Activation, "kind" | "discount_type" | "discount_value" | "discount_currency">): string {
  if (a.discount_type === "percent" && (a.discount_value ?? 0) >= 100) return "Complimentary merch";
  const d = formatDiscount(a) ?? "Discount";
  return a.kind === "fan" ? `${d} tour merch` : `${d} merch`;
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
