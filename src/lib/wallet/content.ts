import type { Activation, Show } from "../activations";
import { formatDiscount } from "../discount";

export function nextShow(shows: Show[], now = new Date()): Show | undefined {
  const today = now.toISOString().slice(0, 10);
  return shows.find((s) => s.show_date >= today) ?? undefined;
}

export function formatShowDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function redemptionInstructions(a: Activation): string {
  const discount = formatDiscount(a);
  const uses = a.single_use ? "One use only." : "Valid for every show on the tour.";
  switch (a.kind) {
    case "crew":
      return `Show this pass at any ${a.artist_name} merch stand on the ${a.tour_name}. Staff will scan the QR code (or enter the code underneath) to apply your crew discount${discount ? ` of ${discount}` : ""}. ${uses} This pass is personal to you — please don't share it.`;
    case "comp":
      return `Show this pass at any ${a.artist_name} merch stand on the ${a.tour_name}. Staff will scan the QR code (or enter the code underneath) to apply your comp${discount ? ` (${discount})` : ""}. ${uses} This pass is personal to you.`;
    default:
      return `Show this pass at any official ${a.artist_name} merch stand on the ${a.tour_name}. Staff will scan the QR code (or enter the code underneath) at checkout to apply your offer. ${a.single_use ? "One use per fan." : "Valid for the whole tour."}`;
  }
}
