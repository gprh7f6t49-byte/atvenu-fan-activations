import Link from "next/link";
import { listGroups } from "@/lib/groups";
import { isPlatformAdmin, orgScope, requireUser } from "@/lib/auth";
import { KIND_LABELS } from "@/lib/discount";
import { fmtInt, fmtRevenue } from "@/lib/format";
import { formatShowDate } from "@/lib/wallet/content";

export const metadata = { title: "Activations" };

const DOT = { live: "bg-emerald-600", draft: "bg-zinc-400", ended: "bg-amber-700" };

/** Tours and standalone events. Each opens an overview with a tab per activation type. */
export default async function ActivationsPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser();
  const { created, deleted } = await searchParams;
  const platform = isPlatformAdmin(user);
  const groups = listGroups(orgScope(user));
  const dates = (f: string | null, l: string | null) =>
    !f ? "—" : f === l || !l ? formatShowDate(f) : `${formatShowDate(f).replace(/ \d{4}$/, "")} – ${formatShowDate(l)}`;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activations</h1>
        <Link href="/admin/activations/new" className="btn">New activation</Link>
      </div>
      {typeof created === "string" && (
        <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Created {created.split(",").length} activations. Open each one to download its codes for atVenu{created.includes("fan") ? " and share the fan page once it's live" : ""}.
        </div>
      )}
      {typeof deleted === "string" && (
        <div className="mb-6 rounded-lg bg-zinc-100 px-4 py-3 text-sm ring-1 ring-zinc-300">
          {deleted === "tour" ? "Tour deleted." : "Activation deleted."} It&apos;s recorded in the <Link href="/admin/changes" className="underline">change log</Link>.
        </div>
      )}
      {groups.length === 0 ? (
        <div className="card text-center text-zinc-600">
          Nothing yet. <Link href="/admin/activations/new" className="font-semibold underline">Create an activation</Link> for a tour, or
          standalone for a one-off show, pop-up shop or food &amp; drink.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Tour or event</th>
                {platform && <th className="px-3 py-3">Client</th>}
                <th className="px-3 py-3">Dates</th>
                <th className="px-3 py-3">Activations</th>
                <th className="px-3 py-3 text-right">Sign-ups &amp; passes</th>
                <th className="px-5 py-3 text-right">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {groups.map((g) => {
                const signups = g.activations.reduce((n, a) => n + a.opt_ins, 0);
                const revenue = g.activations.flatMap((a) => a.revenue);
                return (
                  <tr key={`${g.type}-${g.id}`} className="hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <Link href={g.href} className="font-semibold hover:underline">{g.artist_name}</Link>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded bg-zinc-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">{g.type === "tour" ? "Tour" : "Event"}</span>
                        {g.name}
                      </div>
                    </td>
                    {platform && <td className="px-3 py-3 text-xs text-zinc-600">{g.organisation_name ?? "—"}</td>}
                    <td className="px-3 py-3 text-xs text-zinc-600">{dates(g.first_date, g.last_date)}</td>
                    <td className="px-3 py-3">
                      {g.activations.length === 0 ? (
                        <Link href={`${g.href}/setup`} className="text-xs underline">Set up activations</Link>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {g.activations.map((a) => (
                            <Link key={a.id} href={`/admin/activations/${a.id}`} title={`${KIND_LABELS[a.kind].name}: ${a.status}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs ring-1 ring-zinc-200 hover:ring-zinc-400">
                              <span className={`h-1.5 w-1.5 rounded-full ${DOT[a.status]}`} />
                              {KIND_LABELS[a.kind].short}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtInt(signups)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{revenue.length ? fmtRevenue(mergeCurrencies(revenue)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${DOT.live}`} />Live</span>
        <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${DOT.draft}`} />Draft</span>
        <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${DOT.ended}`} />Ended</span>
      </p>
    </>
  );
}

/** Sales from several activations, still kept apart per currency. */
function mergeCurrencies(rows: { currency: string | null; total: number }[]) {
  const by = new Map<string | null, number>();
  for (const r of rows) by.set(r.currency, (by.get(r.currency) ?? 0) + r.total);
  return [...by].map(([currency, total]) => ({ currency, total }));
}
