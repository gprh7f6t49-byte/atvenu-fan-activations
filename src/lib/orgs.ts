import { db, newId } from "./db";

export interface Organisation {
  id: string;
  name: string;
  contact_email: string | null;
  created_at: string;
}

export interface OrganisationSummary extends Organisation {
  users: number;
  tours: number;
  activations: number;
  live_activations: number;
}

export function listOrganisations(): OrganisationSummary[] {
  return db()
    .prepare(
      `SELECT o.*,
              (SELECT COUNT(*) FROM users u WHERE u.organisation_id = o.id) AS users,
              (SELECT COUNT(*) FROM tours t WHERE t.organisation_id = o.id) AS tours,
              (SELECT COUNT(*) FROM activations a WHERE a.organisation_id = o.id) AS activations,
              (SELECT COUNT(*) FROM activations a WHERE a.organisation_id = o.id AND a.status = 'live') AS live_activations
       FROM organisations o ORDER BY o.name COLLATE NOCASE`,
    )
    .all() as unknown as OrganisationSummary[];
}

export function getOrganisation(id: string): Organisation | undefined {
  return db().prepare("SELECT * FROM organisations WHERE id = ?").get(id) as unknown as Organisation | undefined;
}

export function getOrganisationByName(name: string): Organisation | undefined {
  return db().prepare("SELECT * FROM organisations WHERE name = ? COLLATE NOCASE").get(name) as unknown as Organisation | undefined;
}

export function createOrganisation(name: string, contactEmail: string | null): string {
  const id = newId();
  db().prepare("INSERT INTO organisations (id, name, contact_email) VALUES (?,?,?)").run(id, name, contactEmail);
  return id;
}

export function renameOrganisation(id: string, name: string, contactEmail: string | null): void {
  db().prepare("UPDATE organisations SET name = ?, contact_email = ? WHERE id = ?").run(name, contactEmail, id);
}
