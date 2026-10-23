import { db } from "./db";
import { getActivationStats, listActivations, type Activation, type ActivationKind, type ActivationStats } from "./activations";
import { campaignHref, type CampaignType } from "./campaigns";
import { listTours } from "./tours";

// The Campaigns screen: one row per campaign (tour, festival or event), each opening an
// overview with a tab per activation type.

export type GroupActivation = Activation & ActivationStats;

export interface Group {
  type: CampaignType;
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

/** The campaign overview an activation belongs to. */
export const groupHref = (a: Pick<Activation, "tour_id">) => campaignHref(a.tour_id ?? "");

/** Every campaign (with or without activations), newest first. */
export function listGroups(orgId: string | null): Group[] {
  const activations = listActivations(orgId);
  return listTours(orgId).map((t) => ({
    type: t.type,
    id: t.id,
    organisation_id: t.organisation_id,
    organisation_name: t.organisation_name,
    artist_name: t.artist_name,
    name: t.name,
    first_date: t.first_date,
    last_date: t.last_date,
    activations: activations.filter((a) => a.tour_id === t.id).sort(byKind),
    href: campaignHref(t.id),
    created_at: t.created_at,
  }));
}

/** A campaign's activations with their stats, in Fan / Crew / Comps order. */
export function campaignActivations(campaignId: string): GroupActivation[] {
  const rows = db().prepare("SELECT * FROM activations WHERE tour_id = ?").all(campaignId) as unknown as Activation[];
  return rows.map((a) => ({ ...a, ...getActivationStats(a.id) })).sort(byKind);
}

/** The activations alongside this one in its campaign, for the tab bar. */
export function siblingActivations(a: Activation): Activation[] {
  return (db().prepare("SELECT * FROM activations WHERE tour_id = ?").all(a.tour_id) as unknown as Activation[]).sort(byKind);
}
