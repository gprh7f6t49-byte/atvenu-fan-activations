import { db, newId } from "./db";
import type { Activation } from "./activations";
import { KIND_LABELS } from "./discount";
import type { PublicUser } from "./users";
import type { CampaignType } from "./campaigns";

// Change log: who created, edited, deleted or launched tours, events and activations.
// Names are copied in, so entries still read correctly after the thing itself is deleted.

export type ChangeAction = "created" | "edited" | "renamed" | "deleted" | "went live" | "ended" | "set to draft";
export type EntityType = "tour" | "festival" | "event" | "campaign" | "activation" | "dates" | "tour dates" | "codes" | "sales" | "sign-up link";

export interface ChangeInput {
  action: ChangeAction;
  entityType: EntityType;
  entityId?: string | null;
  entityName: string;
  organisationId: string | null;
  /** The tour / event it belongs to, so its overview can show its history. */
  group?: { type: CampaignType; id: string } | null;
  details?: string | null;
}

export function recordChange(user: Pick<PublicUser, "id" | "email" | "name">, c: ChangeInput): void {
  db()
    .prepare(
      `INSERT INTO changes (id, user_id, user_email, user_name, organisation_id, action, entity_type, entity_id, entity_name, group_type, group_id, details)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(newId(), user.id, user.email, user.name ?? null, c.organisationId, c.action, c.entityType, c.entityId ?? null, c.entityName,
      c.group?.type ?? null, c.group?.id ?? null, c.details ?? null);
}

/** The tour or event an activation belongs to. */
export const activationGroup = (a: Pick<Activation, "id" | "tour_id" | "campaign_type">) => ({ type: a.campaign_type, id: a.tour_id ?? a.id });

/** "Oasis · Live '27 European Tour · Fan activation" */
export const activationName = (a: Pick<Activation, "artist_name" | "tour_name" | "kind">) =>
  `${a.artist_name} · ${a.tour_name} · ${KIND_LABELS[a.kind].name}`;

export function recordActivationChange(user: Pick<PublicUser, "id" | "email" | "name">, a: Activation, action: ChangeAction, details?: string | null) {
  recordChange(user, {
    action,
    entityType: "activation",
    entityId: a.id,
    entityName: activationName(a),
    organisationId: a.organisation_id,
    group: activationGroup(a),
    details,
  });
}

/** Lists what changed between two versions, e.g. "Discount: 15 → 20; Headline: … → …". */
export function describeChanges<T extends object>(before: T, after: Partial<T>, labels: Partial<Record<keyof T, string>>): string | null {
  const show = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    const s = String(v).replace(/\s+/g, " ");
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  };
  const parts: string[] = [];
  for (const key of Object.keys(labels) as (keyof T)[]) {
    if (!(key in after)) continue;
    const was = before[key];
    const now = after[key];
    if ((was ?? "") === (now ?? "") || (typeof was === "number" && Number(now) === was)) continue;
    parts.push(`${labels[key]}: ${show(was)} → ${show(now)}`);
  }
  return parts.length ? parts.join("; ") : null;
}

export interface ChangeRow {
  id: string;
  at: string;
  user_email: string | null;
  user_name: string | null;
  organisation_id: string | null;
  organisation_name: string | null;
  action: ChangeAction;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name: string | null;
  group_type: CampaignType | null;
  group_id: string | null;
  details: string | null;
}

/** Newest first; for one organisation (or all, for atVenu admins), optionally one tour / event. */
export function listChanges(opts: { orgId: string | null; groupId?: string; q?: string; limit?: number }): ChangeRow[] {
  const like = opts.q ? `%${opts.q.trim()}%` : null;
  return db()
    .prepare(
      `SELECT c.*, o.name AS organisation_name FROM changes c LEFT JOIN organisations o ON o.id = c.organisation_id
       WHERE (? IS NULL OR c.organisation_id = ?) AND (? IS NULL OR c.group_id = ? OR c.entity_id = ?)
         AND (? IS NULL OR c.entity_name LIKE ? OR c.user_email LIKE ? OR c.user_name LIKE ? OR c.details LIKE ? OR c.action LIKE ?)
       ORDER BY c.at DESC LIMIT ?`,
    )
    .all(opts.orgId, opts.orgId, opts.groupId ?? null, opts.groupId ?? null, opts.groupId ?? null, like, like, like, like, like, like, opts.limit ?? 200) as unknown as ChangeRow[];
}
