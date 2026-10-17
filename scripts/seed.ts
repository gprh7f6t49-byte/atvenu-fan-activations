/**
 * Seeds the Oasis Live '27 example activation.
 *
 *   npm run seed           activation + 500 promo codes (status: live)
 *   npm run seed -- --demo also creates sample fans and imports sample sales so the dashboard has data
 *
 * Tour dates, promoter and fans are illustrative sample data, not real announcements.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createActivation, getActivationBySlug, replaceShows } from "../src/lib/activations";
import { parseCodesCsv, parseRedemptionsCsv, toCsv } from "../src/lib/csv";
import { db } from "../src/lib/db";
import { importCodes, importRedemptions, optInFan } from "../src/lib/fans";

const SLUG = "oasis-2027";
const demo = process.argv.includes("--demo");

// Deterministic PRNG so the sample CSVs are identical on every machine.
let seed = 2027;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const SHOWS = [
  { show_date: "2027-06-11", venue: "Wembley Stadium", city: "London", country: "GB", latitude: 51.556, longitude: -0.2796 },
  { show_date: "2027-06-12", venue: "Wembley Stadium", city: "London", country: "GB", latitude: 51.556, longitude: -0.2796 },
  { show_date: "2027-06-18", venue: "Heaton Park", city: "Manchester", country: "GB", latitude: 53.534, longitude: -2.253 },
  { show_date: "2027-06-25", venue: "Croke Park", city: "Dublin", country: "IE", latitude: 53.3607, longitude: -6.2512 },
  { show_date: "2027-07-02", venue: "Johan Cruijff ArenA", city: "Amsterdam", country: "NL", latitude: 52.3144, longitude: 4.9419 },
  { show_date: "2027-07-06", venue: "Olympiastadion", city: "Berlin", country: "DE", latitude: 52.5147, longitude: 13.2395 },
  { show_date: "2027-07-10", venue: "Stade de France", city: "Paris", country: "FR", latitude: 48.9245, longitude: 2.3602 },
  { show_date: "2027-07-14", venue: "Estadio Metropolitano", city: "Madrid", country: "ES", latitude: 40.4362, longitude: -3.5995 },
];

function makeCodes(n: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easier to read out at a till
  return Array.from({ length: n }, () => `OAS27-${Array.from({ length: 6 }, () => pick(alphabet.split(""))).join("")}`);
}

let activation = getActivationBySlug(SLUG);
if (activation) {
  console.log(`Activation "${SLUG}" already exists — skipping create.`);
} else {
  const id = createActivation({
    slug: SLUG,
    artist_name: "Oasis",
    tour_name: "Live '27 European Tour",
    tagline: "Your code, your wallet, no queue for the classics.",
    description:
      "Sign up for your personal merch code and add it to Apple or Google Wallet. Show it at any official merch stand on the tour to get 15% off.",
    offer_headline: "15% off tour merch",
    offer_terms:
      "One use per fan, valid at official merch stands on the Live '27 European Tour. Cannot be combined with other offers or exchanged for cash. Sample activation for pilot purposes.",
    promoter_name: "Sample Promoter Ltd",
    primary_color: "#0b0b0c",
    accent_color: "#e8c547",
    text_color: "#ffffff",
    hero_image_url: null,
    privacy_url: "https://www.atvenu.com/privacy",
    status: "live",
    pass_expires_at: "2027-07-31T23:59:59.000Z",
  });
  replaceShows(id, SHOWS);
  activation = getActivationBySlug(SLUG)!;
  console.log(`Created activation "${SLUG}" (${id}).`);
}

const samples = path.join(process.cwd(), "public", "samples");
const codesCsv = toCsv(makeCodes(500).map((code) => ({ "Promo Code": code, Discount: "15%", "Max Uses": 1 })));
writeFileSync(path.join(samples, "promo-codes.csv"), codesCsv);
const { codes } = parseCodesCsv(codesCsv);
const { imported } = importCodes(activation.id, codes, "promo-codes.csv (seed)");
console.log(`Imported ${imported} promo codes.`);

if (demo) {
  const firstNames = ["Liam", "Noel", "Aoife", "Sophie", "Jamie", "Priya", "Tom", "Chloe", "Ciaran", "Hannah", "Lukas", "Emma", "Mateo", "Lucia", "Sven", "Amelie", "Ruby", "Josh", "Niamh", "Marco"];
  const lastNames = ["Murphy", "Walsh", "Smith", "Patel", "Jones", "Byrne", "Müller", "de Vries", "Garcia", "Dubois", "Brown", "Kelly", "Taylor", "Rossi", "Jansen"];
  const sources = ["instagram", "newsletter", "ticket-confirmation", "tiktok", null];
  const countryFor = (i: number) => pick(i % 3 === 0 ? ["IE", "NL", "DE", "FR", "ES"] : ["GB", "GB", "GB", "IE"]);
  const fans: { code: string; show: (typeof SHOWS)[number] }[] = [];

  const setCreated = db().prepare("UPDATE opt_ins SET created_at = ?, apple_pass_at = ?, google_pass_at = ?, email_sent_at = ? WHERE id = ?");
  for (let i = 0; i < 180; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const r = optInFan(activation, {
      email: `${first}.${last}.${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@example.com",
      firstName: first,
      lastName: last,
      country: countryFor(i),
      consentArtist: rand() < 0.72,
      consentPromoter: rand() < 0.41,
      consentAtvenu: rand() < 0.28,
      consentSnapshot: JSON.stringify({ seeded: true }),
      source: pick(sources) ?? undefined,
    });
    // Spread sign-ups over the last 21 days, weighted towards the announcement.
    const daysAgo = Math.floor(Math.pow(rand(), 1.8) * 21);
    const created = new Date(Date.now() - daysAgo * 86_400_000 - rand() * 86_400_000).toISOString();
    const wallet = rand();
    setCreated.run(created, wallet < 0.48 ? created : null, wallet >= 0.48 && wallet < 0.8 ? created : null, created, r.optInId);
    fans.push({ code: r.code, show: pick(SHOWS) });
  }

  const redemptionRows = fans
    .filter(() => rand() < 0.34)
    .map((f, i) => {
      const items = 1 + Math.floor(rand() * 4);
      const eur = f.show.country !== "GB";
      return {
        "Order ID": `AV-${100200 + i}`,
        Date: `${f.show.show_date} ${18 + Math.floor(rand() * 4)}:${String(Math.floor(rand() * 60)).padStart(2, "0")}`,
        Venue: f.show.venue,
        City: f.show.city,
        "Promo Code": f.code,
        Items: items,
        Total: (items * (eur ? 38 : 32) * 0.85).toFixed(2),
        Currency: eur ? "EUR" : "GBP",
      };
    });
  // A couple of walk-up sales with codes from outside this activation, to show unmatched handling.
  redemptionRows.push({ "Order ID": "AV-109001", Date: "2027-06-11 19:40", Venue: "Wembley Stadium", City: "London", "Promo Code": "CREW10", Items: 1, Total: "25.00", Currency: "GBP" });
  const redemptionsCsv = toCsv(redemptionRows);
  writeFileSync(path.join(samples, "redemptions.csv"), redemptionsCsv);
  const parsed = parseRedemptionsCsv(redemptionsCsv);
  const res = importRedemptions(activation.id, parsed.rows, "redemptions.csv (seed)", parsed.skipped);
  console.log(`Created ${fans.length} demo fans; imported ${res.imported} sales (${res.matched} matched).`);
}

console.log(`\nLanding page: /a/${SLUG}`);
