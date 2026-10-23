// Campaigns group activations: a Tour (many dates across cities), a Festival (days and venues,
// e.g. several weekends across sites) or an Event (a one-off show, pop-up, food & drink offer).

export type CampaignType = "tour" | "festival" | "event";

export const CAMPAIGN_TYPES: Record<CampaignType, {
  label: string;
  blurb: string;
  /** Labels for the two name fields (stored as artist_name / name). */
  nameLabel: string;
  namePlaceholder: string;
  editionLabel: string;
  editionPlaceholder: string;
  /** What one date is called, to fans: "show", "day", "date". */
  dateNoun: string;
  datesHeading: string;
  /** Crew / comp sign-up links are made per city (tours, events) or per venue (festivals). */
  linkUnit: "city" | "venue";
}> = {
  tour: {
    label: "Tour",
    blurb: "An artist on the road: many shows across cities.",
    nameLabel: "Artist",
    namePlaceholder: "Oasis",
    editionLabel: "Tour name",
    editionPlaceholder: "Live '27 European Tour",
    dateNoun: "show",
    datesHeading: "Tour dates",
    linkUnit: "city",
  },
  festival: {
    label: "Festival",
    blurb: "One or more days — over several weekends and venues if you like.",
    nameLabel: "Festival",
    namePlaceholder: "Parklife",
    editionLabel: "Edition",
    editionPlaceholder: "2027, or Summer Series 2027",
    dateNoun: "day",
    datesHeading: "Festival days",
    linkUnit: "venue",
  },
  event: {
    label: "Event",
    blurb: "A one-off show or two, a pop-up shop, a food & drink offer.",
    nameLabel: "Artist, brand or venue",
    namePlaceholder: "The Jazz Café",
    editionLabel: "Event name",
    editionPlaceholder: "Summer Pop-up 2027",
    dateNoun: "date",
    datesHeading: "Dates",
    linkUnit: "city",
  },
};

export const isCampaignType = (v: unknown): v is CampaignType => typeof v === "string" && v in CAMPAIGN_TYPES;

export const campaignHref = (id: string) => `/admin/campaigns/${id}`;

/** "9 shows in 7 cities", "6 days at 3 venues", "2 dates", "No dates yet". */
export function datesSummary(type: CampaignType, dates: { venue: string; city: string; country: string }[]): string {
  if (!dates.length) return "No dates yet";
  const t = CAMPAIGN_TYPES[type];
  const n = dates.length;
  const noun = `${n} ${t.dateNoun}${n === 1 ? "" : "s"}`;
  if (type === "festival") {
    const venues = new Set(dates.map((d) => d.venue.toLowerCase())).size;
    return venues > 1 ? `${noun} at ${venues} venues` : noun;
  }
  const cities = new Set(dates.map((d) => `${d.city}|${d.country}`)).size;
  return cities > 1 ? `${noun} in ${cities} cities` : noun;
}
