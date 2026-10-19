import { notFound } from "next/navigation";
import { TeamPanel } from "@/components/team-panel";
import { requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";

export const metadata = { title: "Team · Fan Activations" };

export default async function TeamPage() {
  const me = await requireUser();
  if (me.role !== "org_admin" || !me.organisation_id) notFound();
  const org = getOrganisation(me.organisation_id)!;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="mt-1 text-sm text-zinc-600">People at {org.name} who can sign in.</p>
      </div>
      <TeamPanel orgId={org.id} me={me} />
    </div>
  );
}
