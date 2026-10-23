import Link from "next/link";
import { ActionBadge, who } from "@/components/recent-changes";
import { listChanges } from "@/lib/audit";
import { isPlatformAdmin, orgScope, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Change log · Activations" };

/** Who created, edited, launched and deleted tours, events and activations. */
export default async function ChangesPage({ searchParams }: PageProps<"/admin/changes">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const group = typeof sp.group === "string" ? sp.group : undefined;
  const platform = isPlatformAdmin(user);
  const rows = listChanges({ orgId: orgScope(user), groupId: group, q: q || undefined, limit: 500 });
  // Link to tours / events that still exist.
  const tours = new Set((db().prepare("SELECT id FROM tours").all() as { id: string }[]).map((r) => r.id));
  const events = new Set((db().prepare("SELECT COALESCE(group_id, id) AS k FROM activations WHERE tour_id IS NULL").all() as { k: string }[]).map((r) => r.k));
  const href = (t: string | null, id: string | null) =>
    !id ? null : t === "tour" && tours.has(id) ? `/admin/tours/${id}` : t === "event" && events.has(id) ? `/admin/events/${id}` : null;
  const exportUrl = `/api/admin/changes?${new URLSearchParams({ ...(q && { q }), ...(group && { group }) })}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Change log</h1>
          <p className="text-sm text-zinc-500">Who set up, edited, launched and deleted tours, events and activations.</p>
        </div>
        <a href={exportUrl} className="btn-secondary">Download CSV</a>
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-3">
        {group && <input type="hidden" name="group" value={group} />}
        <input name="q" defaultValue={q} placeholder="Search name, person or change…" className="input max-w-sm" />
        <button className="btn-secondary">Search</button>
        {(q || group) && <Link href="/admin/changes" className="text-sm underline">Show everything</Link>}
        {group && <span className="text-xs text-zinc-500">Showing one tour / event</span>}
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-3 py-3">Who</th>
              {platform && <th className="px-3 py-3">Client</th>}
              <th className="px-3 py-3">Change</th>
              <th className="px-3 py-3">What</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((c) => {
              const link = href(c.group_type, c.group_id);
              return (
                <tr key={c.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-600">{fmtDateTime(c.at)}</td>
                  <td className="px-3 py-2 text-xs">{who(c)}{c.user_name && c.user_email && <span className="block text-zinc-500">{c.user_email}</span>}</td>
                  {platform && <td className="px-3 py-2 text-xs text-zinc-600">{c.organisation_name ?? "—"}</td>}
                  <td className="px-3 py-2"><ActionBadge action={c.action} /></td>
                  <td className="px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">{c.entity_type}</span>
                    <span className="block">{link ? <Link href={link} className="hover:underline">{c.entity_name}</Link> : c.entity_name}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-600">{c.details ?? ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">{q ? "No matches" : "No changes recorded yet"}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length === 500 && <p className="mt-2 text-xs text-zinc-500">Showing the latest 500. Download the CSV or search to see more.</p>}
    </>
  );
}
