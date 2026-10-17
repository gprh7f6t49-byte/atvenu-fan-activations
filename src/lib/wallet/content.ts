import type { Activation, Show } from "../activations";

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
  return `Show this pass at any official ${a.artist_name} merch stand on the ${a.tour_name}. Staff will scan the QR code (or enter the code underneath) at checkout to apply your offer. One use per fan.`;
}
