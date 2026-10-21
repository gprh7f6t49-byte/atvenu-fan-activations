import { db } from "./db";
import { getActivationStats, listActivations, listShows, type Activation, type ActivationKind, type ActivationStats } from "./activations";
import { listTours } from "./tours";

// The Activations screen lists tours and standalone events; each opens an overview with a tab per
// activation type. A tour's activations hang off tour_id; a standalone event's share group_id
// (older standalone activations without one are an event of their own).

export type GroupActivation = Activation & ActivationStats;

export interface Group {
  type: "tour" | "event";
  id: string;
  organisation_id: string | null;
  organisation_name: string | null;
  artist_name: string;
  name: string;
  first_date: string | null;
  last_date: string | null;
  activations: GroupActivation[];
  href: string;
  created_at: string;
}

const KIND_ORDER: ActivationKind[] = ["fan", "crew", "comp"];
const byKind = (x: Activation, y: Activation) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || x.created_at.localeCompare(y.created_at);

export const eventKey = (a: Pick<Activation, "id" | "group_id">) => a.group_id ?? a.id;
export const groupHref = (a: Pick<Activation, "id" | "group_id" | "tour_id">) =>
  a.tour_id ? `/admin/tours/${a.tour_id}` : `/admin/events/${eventKey(a)}`;

/** Every tour (with or without activations) and standalone event, newest first. */
export function listGroups(orgId: string | null): Group[] {
  const activations = listActivations(orgId);
  const groups: Group[] = listTours(orgId).map((t) => ({
    type: "tour",
    id: t.id,
    organisation_id: t.organisation_id,
    organisation_name: t.organisation_name,
    artist_name: t.artist_name,
    name: t.name,
    first_date: t.first_date,
    last_date: t.last_date,
    activations: activations.filter((a) => a.tour_id === t.id).sort(byKind),
    href: `/admin/tours/${t.id}`,
    created_at: t.created_at,
  }));
  const events = new Map<string, Group>();
  for (const a of activations.filter((x) => !x.tour_id)) {
    const key = eventKey(a);
    const g = events.get(key) ?? {
      type: "event" as const,
      id: key,
      organisation_id: a.organisation_id,
      organisation_name: a.organisation_name,
      artist_name: a.artist_name,
      name: a.tour_name,
      first_date: null,
      last_date: null,
      activations: [],
      href: `/admin/events/${key}`,
      created_at: a.created_at,
    };
    g.activations.push(a);
    for (const s of listShows(a.id)) {
      if (!g.first_date || s.show_date < g.first_date) g.first_date = s.show_date;
      if (!g.last_date || s.show_date > g.last_date) g.last_date = s.show_date;
    }
    if (a.created_at < g.created_at) g.created_at = a.created_at;
    events.set(key, g);
  }
  for (const g of events.values()) g.activations.sort(byKind);
  return [...groups, ...events.values()].sort((x, y) => y.created_at.localeCompare(x.created_at));
}

/** The activations of a standalone event (by its group id, or a lone activation's own id). */
export function eventActivations(key: string): GroupActivation[] {
  const rows = db()
    .prepare("SELECT * FROM activations WHERE tour_id IS NULL AND (group_id = ? OR (group_id IS NULL AND id = ?))")
    .all(key, key) as unknown as Activation[];
  return rows.map((a) => ({ ...a, ...getActivationStats(a.id) })).sort(byKind);
}

/** The other activations alongside this one (same tour or event), for the tab bar. */
export function siblingActivations(a: Activation): Activation[] {
  const rows = a.tour_id
    ? db().prepare("SELECT * FROM activations WHERE tour_id = ?").all(a.tour_id)
    : db().prepare("SELECT * FROM activations WHERE tour_id IS NULL AND (group_id = ? OR (group_id IS NULL AND id = ?))").all(eventKey(a), eventKey(a));
  return (rows as unknown as Activation[]).sort(byKind);
}
