import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { TeamPanel } from "@/components/team-panel";
import { requirePlatformAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { listOrganisations } from "@/lib/orgs";
import { createClientAction } from "../team/actions";

export const metadata = { title: "Clients · Fan Activations" };

export default async function ClientsPage() {
  const me = await requirePlatformAdmin();
  const orgs = listOrganisations();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="mt-1 text-sm text-zinc-600">Each client signs in to their own space and only sees their own tours, activations and fans.</p>
      </div>

      <section className="card">
        <h2 className="font-semibold">Add a client</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-600">Creates the client account and invites their first user as client admin.</p>
        <ActionForm action={createClientAction} submitLabel="Create client & send invite" pendingLabel="Creating…" resetOnSuccess>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block"><span className="label">Client name</span><input name="name" required className="input" placeholder="e.g. Sample Merch Co" /></label>
            <label className="block"><span className="label">Billing / contact email</span><input name="contact_email" type="email" className="input" placeholder="Optional" /></label>
            <label className="block"><span className="label">First user&apos;s name</span><input name="user_name" className="input" /></label>
            <label className="block"><span className="label">First user&apos;s email</span><input name="user_email" type="email" required className="input" /></label>
          </div>
        </ActionForm>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-5 py-3">Client</th><th className="px-3 py-3 text-right">Users</th><th className="px-3 py-3 text-right">Tours</th><th className="px-3 py-3 text-right">Activations</th><th className="px-3 py-3 text-right">Live</th><th className="px-5 py-3">Added</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orgs.map((o) => (
              <tr key={o.id} className="hover:bg-zinc-50">
                <td className="px-5 py-3">
                  <Link href={`/admin/clients/${o.id}`} className="font-semibold hover:underline">{o.name}</Link>
                  {o.contact_email && <div className="text-xs text-zinc-500">{o.contact_email}</div>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{o.users}</td>
                <td className="px-3 py-3 text-right tabular-nums">{o.tours}</td>
                <td className="px-3 py-3 text-right tabular-nums">{o.activations}</td>
                <td className="px-3 py-3 text-right tabular-nums">{o.live_activations}</td>
                <td className="px-5 py-3 text-xs text-zinc-600">{fmtDateTime(o.created_at)}</td>
              </tr>
            ))}
            {orgs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500">No clients yet</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">atVenu admins</h2>
        <TeamPanel orgId={null} me={me} />
      </section>
    </div>
  );
}
