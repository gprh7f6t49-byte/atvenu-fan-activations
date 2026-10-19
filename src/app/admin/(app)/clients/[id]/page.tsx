import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { KindBadge, StatusBadge } from "@/components/status-badge";
import { TeamPanel } from "@/components/team-panel";
import { listActivations } from "@/lib/activations";
import { requirePlatformAdmin } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { listTours } from "@/lib/tours";
import { updateClientAction } from "../../team/actions";

export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  const me = await requirePlatformAdmin();
  const { id } = await params;
  const org = getOrganisation(id);
  if (!org) notFound();
  const activations = listActivations(id);
  const tours = listTours(id);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/clients" className="text-sm text-zinc-500 hover:text-zinc-900">← Clients</Link>
        <h1 className="mt-2 text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-zinc-500">{tours.length} tour(s) · {activations.length} activation(s)</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Team</h2>
        <TeamPanel orgId={id} me={me} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Activations</h2>
          {activations.length === 0 ? <p className="text-sm text-zinc-500">None yet.</p> : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {activations.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2">
                  <KindBadge kind={a.kind} />
                  <Link href={`/admin/activations/${a.id}`} className="font-medium hover:underline">{a.artist_name}</Link>
                  <span className="truncate text-xs text-zinc-500">{a.offer_headline}</span>
                  <span className="ml-auto"><StatusBadge status={a.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Tours</h2>
          {tours.length === 0 ? <p className="text-sm text-zinc-500">None yet.</p> : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {tours.map((t) => (
                <li key={t.id} className="py-2">
                  <Link href={`/admin/tours/${t.id}`} className="font-medium hover:underline">{t.artist_name}</Link>
                  <span className="ml-2 text-xs text-zinc-500">{t.name} · {t.date_count} dates</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card max-w-2xl">
        <h2 className="mb-3 font-semibold">Client details</h2>
        <ActionForm action={updateClientAction.bind(null, id)} submitLabel="Save">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block"><span className="label">Name</span><input name="name" defaultValue={org.name} required className="input" /></label>
            <label className="block"><span className="label">Contact email</span><input name="contact_email" type="email" defaultValue={org.contact_email ?? ""} className="input" /></label>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
