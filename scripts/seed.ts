/**
 * Seeds the Oasis Live '27 example: the tour and its dates, a fan activation, crew sales and
 * venue & management comps, plus PIN-protected city sign-up links for crew.
 *
 *   npm run seed           activations + promo codes (status: live)
 *   npm run seed -- --demo also issues sample passes and imports sample sales so the dashboards have data
 *
 * Tour dates, promoter and fans are illustrative sample data, not real announcements.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createActivation, getActivationBySlug, listShows, type Activation, type ActivationInput, type Show } from "../src/lib/activations";
import { parseCodesCsv, parseRecipientsCsv, parseRedemptionsCsv, toCsv } from "../src/lib/csv";
import { db, DEFAULT_ORG_NAME } from "../src/lib/db";
import { createOrganisation, getOrganisationByName } from "../src/lib/orgs";
import { createUser, ensureBootstrapAdmin, getUserByEmail, hashPassword } from "../src/lib/users";
import { importCodes, importRedemptions, optInFan } from "../src/lib/fans";
import { createSignupLink, listSignupLinks, passWindow } from "../src/lib/signup-links";
import { addTourDates, createTour, listTourCities, listTours } from "../src/lib/tours";

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
  { show_date: "2027-06-19", venue: "Heaton Park", city: "Manchester", country: "GB", latitude: 53.534, longitude: -2.253 },
  { show_date: "2027-06-25", venue: "Croke Park", city: "Dublin", country: "IE", latitude: 53.3607, longitude: -6.2512 },
  { show_date: "2027-07-02", venue: "Johan Cruijff ArenA", city: "Amsterdam", country: "NL", latitude: 52.3144, longitude: 4.9419 },
  { show_date: "2027-07-06", venue: "Olympiastadion", city: "Berlin", country: "DE", latitude: 52.5147, longitude: 13.2395 },
  { show_date: "2027-07-10", venue: "Stade de France", city: "Paris", country: "FR", latitude: 48.9245, longitude: 2.3602 },
  { show_date: "2027-07-14", venue: "Estadio Metropolitano", city: "Madrid", country: "ES", latitude: 40.4362, longitude: -3.5995 },
];

// The demo belongs to a sample client account so the client view can be shown too.
const ORG_ID = getOrganisationByName(DEFAULT_ORG_NAME)?.id ?? createOrganisation(DEFAULT_ORG_NAME, null);

const TOUR_NAME = "Live '27 European Tour";
const TOUR_ID =
  listTours(ORG_ID).find((t) => t.artist_name === "Oasis" && t.name === TOUR_NAME)?.id ??
  (() => {
    const id = createTour({ artist_name: "Oasis", name: TOUR_NAME, notes: "Sample tour for the pilot — dates are illustrative." }, ORG_ID);
    addTourDates(id, SHOWS);
    console.log(`Created tour "${TOUR_NAME}" with ${SHOWS.length} dates.`);
    return id;
  })();

function makeCodes(n: number, prefix = "OAS27") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easier to read out at a till
  return Array.from({ length: n }, () => `${prefix}-${Array.from({ length: 6 }, () => pick(alphabet.split(""))).join("")}`);
}

const BRAND = { primary_color: "#0b0b0c", accent_color: "#e8c547", text_color: "#ffffff" };

function ensureActivation(input: ActivationInput): Activation {
  const existing = getActivationBySlug(input.slug);
  if (existing) {
    console.log(`Activation "${input.slug}" already exists — skipping create.`);
    return existing;
  }
  createActivation(input, ORG_ID);
  console.log(`Created ${input.kind} activation "${input.slug}".`);
  return getActivationBySlug(input.slug)!;
}

let activation = getActivationBySlug(SLUG);
if (activation) {
  console.log(`Activation "${SLUG}" already exists — skipping create.`);
} else {
  const id = createActivation(
    {
    slug: SLUG,
    artist_name: "Oasis",
    tour_name: "Live '27 European Tour",
    tagline: "Your code, your wallet, no queue for the classics.",
    description:
      "Sign up for your personal merch code and add it to Apple or Google Wallet. Show it at any official merch stand on the tour to get 15% off.",
    offer_headline: "15% off tour merch",
    offer_terms:
      "Use at the official merch stand at each show you've chosen. Personal to you. Cannot be combined with other offers or exchanged for cash. Sample activation for pilot purposes.",
    promoter_name: "Sample Promoter Ltd",
    primary_color: "#0b0b0c",
    accent_color: "#e8c547",
    text_color: "#ffffff",
    hero_image_url: null, pass_image_url: null,
    privacy_url: "https://www.atvenu.com/privacy",
    status: "live",
    pass_expires_at: "2027-07-31T23:59:59.000Z",
    kind: "fan",
    tour_id: TOUR_ID,
    discount_type: "percent",
    discount_value: 15,
    discount_currency: null,
    single_use: 0,
  },
    ORG_ID,
  );
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
  const fans: { code: string; show: Show }[] = [];
  const tourShows = listShows(activation.id);

  const setCreated = db().prepare("UPDATE opt_ins SET created_at = ?, apple_pass_at = ?, google_pass_at = ?, email_sent_at = ? WHERE id = ?");
  for (let i = 0; i < 180; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    // Most fans pick one show; some are going to two.
    const picked = [...new Set([pick(tourShows), ...(rand() < 0.25 ? [pick(tourShows)] : [])])];
    const r = optInFan(activation, {
      email: `${first}.${last}.${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@example.com",
      firstName: first,
      lastName: last,
      country: countryFor(i),
      consentArtist: rand() < 0.72,
      consentPromoter: rand() < 0.41,
      consentSnapshot: JSON.stringify({ seeded: true }),
      source: pick(sources) ?? undefined,
      shows: picked,
    });
    // Spread sign-ups over the last 21 days, weighted towards the announcement.
    const daysAgo = Math.floor(Math.pow(rand(), 1.8) * 21);
    const created = new Date(Date.now() - daysAgo * 86_400_000 - rand() * 86_400_000).toISOString();
    const wallet = rand();
    setCreated.run(created, wallet < 0.48 ? created : null, wallet >= 0.48 && wallet < 0.8 ? created : null, created, r.optInId);
    fans.push({ code: r.code, show: picked[0] });
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


// ---- Crew sales: 25% off, reusable all tour --------------------------------
const crew = ensureActivation({
  ...BRAND,
  kind: "crew",
  tour_id: TOUR_ID,
  slug: "crew-oasis-live-27",
  artist_name: "Oasis",
  tour_name: "Live '27 European Tour",
  offer_headline: "25% off merch",
  offer_terms: "Crew discount for touring personnel only. Personal to the named holder — not transferable. Sample activation for pilot purposes.",
  discount_type: "percent",
  discount_value: 25,
  discount_currency: null,
  single_use: 0,
  status: "live",
  pass_expires_at: "2027-07-31T23:59:59.000Z",
  tagline: null, description: null, promoter_name: null, hero_image_url: null, pass_image_url: null, privacy_url: null,
});
const crewCodesCsv = toCsv(makeCodes(120, "CREW27").map((code) => ({ "Promo Code": code, Discount: "25%", "Max Uses": "Unlimited" })));
writeFileSync(path.join(samples, "crew-codes.csv"), crewCodesCsv);
console.log(`Imported ${importCodes(crew.id, parseCodesCsv(crewCodesCsv).codes, "crew-codes.csv (seed)").imported} crew codes.`);

const DEPARTMENTS = ["Production", "Audio", "Lighting", "Video", "Backline", "Rigging", "Catering", "Wardrobe", "Security", "Merch"];
const crewFirst = ["Dave", "Sian", "Gaz", "Kerry", "Phil", "Jo", "Rob", "Beth", "Mick", "Tasha", "Lee", "Anna"];
const crewLast = ["Hughes", "Price", "Doyle", "Evans", "Clarke", "Moss", "Reid", "Hart", "Shaw", "Lowe"];
const crewList = Array.from({ length: 36 }, (_, i) => {
  const first = pick(crewFirst);
  const last = pick(crewLast);
  return { Name: `${first} ${last}`, Email: `${first}.${last}.crew${i}@example.com`.toLowerCase(), Department: DEPARTMENTS[i % DEPARTMENTS.length] };
});
writeFileSync(path.join(samples, "crew-list.csv"), toCsv(crewList));

// ---- Venue & management comps: £40 off, one order --------------------------
const comps = ensureActivation({
  ...BRAND,
  kind: "comp",
  tour_id: TOUR_ID,
  slug: "comps-oasis-live-27",
  artist_name: "Oasis",
  tour_name: "Live '27 European Tour",
  offer_headline: "£40 off merch",
  offer_terms: "Comp issued by the merch team. Personal to the named holder — not transferable or exchangeable for cash. Sample activation for pilot purposes.",
  discount_type: "amount",
  discount_value: 40,
  discount_currency: "GBP",
  single_use: 1,
  status: "live",
  pass_expires_at: "2027-07-31T23:59:59.000Z",
  tagline: null, description: null, promoter_name: null, hero_image_url: null, pass_image_url: null, privacy_url: null,
});
const compCodesCsv = toCsv(makeCodes(80, "COMP27").map((code) => ({ "Promo Code": code, Discount: "40.00", "Max Uses": 1 })));
writeFileSync(path.join(samples, "comp-codes.csv"), compCodesCsv);
console.log(`Imported ${importCodes(comps.id, parseCodesCsv(compCodesCsv).codes, "comp-codes.csv (seed)").imported} comp codes.`);

const compList = [
  ...SHOWS.filter((s, i, all) => all.findIndex((x) => x.venue === s.venue) === i).flatMap((s, i) => [
    { Name: `${pick(crewFirst)} ${pick(crewLast)}`, Email: `venue.manager${i}@example.com`, Group: "Venue", Organisation: s.venue, Role: "Venue Manager" },
    { Name: `${pick(crewFirst)} ${pick(crewLast)}`, Email: `ops${i}@example.com`, Group: "Venue", Organisation: s.venue, Role: "Operations" },
  ]),
  ...["Artist Manager", "Tour Manager", "Day-to-day Manager", "Business Manager"].map((role, i) => ({
    Name: `${pick(crewFirst)} ${pick(crewLast)}`, Email: `mgmt${i}@example.com`, Group: "Management", Organisation: "Sample Management Co", Role: role,
  })),
  ...["Head of Marketing", "A&R"].map((role, i) => ({
    Name: `${pick(crewFirst)} ${pick(crewLast)}`, Email: `label${i}@example.com`, Group: "Label", Organisation: "Sample Records", Role: role,
  })),
];
writeFileSync(path.join(samples, "comp-list.csv"), toCsv(compList));

if (demo) {
  const issueAll = (a: Activation, rows: ReturnType<typeof parseRecipientsCsv>) =>
    rows.map((r) =>
      optInFan(a, {
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        role: r.role || undefined,
        recipientGroup: a.kind === "comp" ? r.group || "Other" : undefined,
        organisation: r.organisation || undefined,
        issuedByAdmin: true,
        consentArtist: false,
        consentPromoter: false,
        consentSnapshot: JSON.stringify({ seeded: true, issued_by_admin: true }),
      }),
    );
  const markWallet = db().prepare("UPDATE opt_ins SET email_sent_at = created_at, apple_pass_at = ?, google_pass_at = ? WHERE id = ?");
  const salesFor = (issued: ReturnType<typeof issueAll>, share: number, ordersEach: () => number, total: () => number, prefix: string) => {
    const rows: Record<string, string | number>[] = [];
    issued.forEach((r) => {
      const w = rand();
      markWallet.run(w < 0.55 ? new Date().toISOString() : null, w >= 0.55 && w < 0.85 ? new Date().toISOString() : null, r.optInId);
      if (rand() > share) return;
      for (let n = ordersEach(); n > 0; n--) {
        const show = pick(SHOWS);
        rows.push({
          "Order ID": `${prefix}-${rows.length + 1000}`, Date: `${show.show_date} 17:${String(Math.floor(rand() * 60)).padStart(2, "0")}`,
          Venue: show.venue, City: show.city, "Promo Code": r.code, Items: 1 + Math.floor(rand() * 3),
          Total: total().toFixed(2), Currency: show.country === "GB" ? "GBP" : "EUR",
        });
      }
    });
    return rows;
  };

  const crewIssued = issueAll(crew, parseRecipientsCsv(toCsv(crewList)));
  const crewSales = salesFor(crewIssued, 0.75, () => 1 + Math.floor(rand() * 3), () => 24 + rand() * 60, "CRW");
  const crewParsed = parseRedemptionsCsv(toCsv(crewSales));
  const crewRes = importRedemptions(crew.id, crewParsed.rows, "crew-sales.csv (seed)", crewParsed.skipped);
  console.log(`Issued ${crewIssued.length} crew passes; imported ${crewRes.imported} crew sales.`);

  const compIssued = issueAll(comps, parseRecipientsCsv(toCsv(compList)));
  const compSales = salesFor(compIssued, 0.6, () => 1, () => rand() * 35, "CMP");
  const compParsed = parseRedemptionsCsv(toCsv(compSales));
  const compRes = importRedemptions(comps.id, compParsed.rows, "comp-sales.csv (seed)", compParsed.skipped);
  console.log(`Issued ${compIssued.length} comp passes; imported ${compRes.imported} comp sales.`);
}

// ---- City sign-up links (PIN-protected) -----------------------------------
const cities = listTourCities(TOUR_ID);
const cityNamed = (name: string) => cities.find((c) => c.city === name)!;
if (listSignupLinks(crew.id).length === 0) {
  for (const name of ["London", "Manchester", "Dublin"]) {
    createSignupLink({ activationId: crew.id, city: cityNamed(name), label: `${name} — local crew`, passScope: "city", expiresAt: null, maxSignups: 60 });
  }
  createSignupLink({ activationId: comps.id, city: cityNamed("London"), label: "Wembley — venue staff", passScope: "city", expiresAt: null, maxSignups: 25 });
}
const links = listSignupLinks(crew.id);
for (const l of [...links, ...listSignupLinks(comps.id)]) console.log(`Sign-up link ${l.label}: /c/${l.token}  PIN ${l.pin}`);

if (demo) {
  // A few local crew who signed up themselves through the London link.
  const london = links.find((l) => l.city === "London")!;
  const window = passWindow(london, cityNamed("London"));
  const locals = [["Ade", "Okafor", "Local crew"], ["Ellie", "Ward", "Catering"], ["Ravi", "Shah", "Security"], ["Kate", "Flynn", "Local crew"]];
  locals.forEach(([first, last, dept]) =>
    optInFan(crew, {
      email: `${first}.${last}.local@example.com`.toLowerCase(),
      firstName: first,
      lastName: last,
      role: dept,
      consentArtist: false,
      consentPromoter: false,
      consentSnapshot: JSON.stringify({ seeded: true, self_signup: true }),
      source: "London sign-up link",
      signupLinkId: london.id,
      ...window,
    }),
  );
  console.log(`Added ${locals.length} self sign-ups via the London crew link.`);
}

console.log(`\nFan landing page: /a/${SLUG} · Admin: /admin`);

// ---- Accounts --------------------------------------------------------------
// atVenu admin from ADMIN_EMAIL / ADMIN_PASSWORD; optional demo client login to show the client view.
void (async () => {
  await ensureBootstrapAdmin();
  const demoEmail = process.env.DEMO_CLIENT_EMAIL;
  const demoPassword = process.env.DEMO_CLIENT_PASSWORD;
  if (demoEmail && demoPassword && !getUserByEmail(demoEmail)) {
    createUser({ email: demoEmail, name: "Demo client", role: "org_admin", organisationId: ORG_ID, passwordHash: await hashPassword(demoPassword) });
    console.log(`Created demo client login ${demoEmail} (${DEFAULT_ORG_NAME}).`);
  }
})();
