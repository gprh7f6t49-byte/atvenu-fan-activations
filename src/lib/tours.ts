import { db, newId, tx } from "./db";

export interface Tour {
  id: string;
  artist_name: string;
  name: string;
  notes: string | null;
  organisation_id: string | null;
  created_at: string;
}

export interface TourDate {
  id: string;
  tour_id: string;
  show_date: string;
  venue: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export type TourDateInput = Omit<TourDate, "id" | "tour_id">;

export interface TourCity {
  city: string;
  country: string;
  first_date: string;
  last_date: string;
  dates: TourDate[];
}

export interface TourSummary extends Tour {
  organisation_name: string | null;
  date_count: number;
  city_count: number;
  first_date: string | null;
  last_date: string | null;
  activation_count: number;
}

/** Tours for one organisation, or every organisation when orgId is null (atVenu admin). */
export function listTours(orgId: string | null): TourSummary[] {
  return db()
    .prepare(
      `SELECT t.*, (SELECT name FROM organisations o WHERE o.id = t.organisation_id) AS organisation_name,
              (SELECT COUNT(*) FROM tour_dates d WHERE d.tour_id = t.id) AS date_count,
              (SELECT COUNT(DISTINCT d.city || '|' || d.country) FROM tour_dates d WHERE d.tour_id = t.id) AS city_count,
              (SELECT MIN(show_date) FROM tour_dates d WHERE d.tour_id = t.id) AS first_date,
              (SELECT MAX(show_date) FROM tour_dates d WHERE d.tour_id = t.id) AS last_date,
              (SELECT COUNT(*) FROM activations a WHERE a.tour_id = t.id) AS activation_count
       FROM tours t WHERE (? IS NULL OR t.organisation_id = ?) ORDER BY t.created_at DESC`,
    )
    .all(orgId, orgId) as unknown as TourSummary[];
}

export function getTour(id: string): Tour | undefined {
  return db().prepare("SELECT * FROM tours WHERE id = ?").get(id) as unknown as Tour | undefined;
}

export function createTour(input: { artist_name: string; name: string; notes: string | null }, organisationId: string): string {
  const id = newId();
  db()
    .prepare("INSERT INTO tours (id, artist_name, name, notes, organisation_id) VALUES (?,?,?,?,?)")
    .run(id, input.artist_name, input.name, input.notes, organisationId);
  return id;
}

/** Renaming a tour renames the activations that use it, so passes stay in step. */
export function updateTour(id: string, input: { artist_name: string; name: string; notes: string | null }): void {
  tx((conn) => {
    conn.prepare("UPDATE tours SET artist_name = ?, name = ?, notes = ? WHERE id = ?").run(input.artist_name, input.name, input.notes, id);
    conn.prepare("UPDATE activations SET artist_name = ?, tour_name = ? WHERE tour_id = ?").run(input.artist_name, input.name, id);
  });
}

export function listTourDates(tourId: string): TourDate[] {
  return db()
    .prepare("SELECT * FROM tour_dates WHERE tour_id = ? ORDER BY show_date, city")
    .all(tourId) as unknown as TourDate[];
}

export function addTourDates(tourId: string, dates: TourDateInput[]): number {
  return tx((conn) => {
    const insert = conn.prepare(
      "INSERT INTO tour_dates (id, tour_id, show_date, venue, city, country, latitude, longitude) VALUES (?,?,?,?,?,?,?,?)",
    );
    for (const d of dates) insert.run(newId(), tourId, d.show_date, d.venue, d.city, d.country, d.latitude, d.longitude);
    return dates.length;
  });
}

export function deleteTourDate(tourId: string, dateId: string): void {
  db().prepare("DELETE FROM tour_dates WHERE id = ? AND tour_id = ?").run(dateId, tourId);
}

/** Tour dates grouped by city — a city can have several dates (e.g. two nights at Wembley). */
export function listTourCities(tourId: string): TourCity[] {
  const byCity = new Map<string, TourCity>();
  for (const d of listTourDates(tourId)) {
    const key = `${d.city}|${d.country}`;
    const c = byCity.get(key) ?? { city: d.city, country: d.country, first_date: d.show_date, last_date: d.show_date, dates: [] };
    c.dates.push(d);
    if (d.show_date < c.first_date) c.first_date = d.show_date;
    if (d.show_date > c.last_date) c.last_date = d.show_date;
    byCity.set(key, c);
  }
  return [...byCity.values()].sort((a, b) => a.first_date.localeCompare(b.first_date));
}

/** One date per line: date | venue | city | country | lat | lng (lat/lng optional). */
export function parseDateLines(text: string): TourDateInput[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [date, venue, city, country, lat, lng] = line.split("|").map((p) => p.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !venue || !city) {
        throw new Error(`Line ${i + 1} should look like "2027-06-12 | Wembley Stadium | London | GB"`);
      }
      return {
        show_date: date,
        venue,
        city,
        country: (country || "").toUpperCase(),
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
      };
    });
}
