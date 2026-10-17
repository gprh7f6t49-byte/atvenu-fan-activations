import { redirect } from "next/navigation";
import { getActivation } from "@/lib/activations";
import { listFans } from "@/lib/fans";
import { fmtDateTime, fmtRevenue } from "@/lib/format";

const Tick = ({ on }: { on: number | string | null }) =>
  on ? <span className="text-emerald-600" aria-label="yes">✓</span> : <span className="text-zinc-300" aria-label="no">–</span>;

export default async function FansPage({ params, searchParams }: PageProps<"/admin/activations/[id]/fans">) {
  const { id } = await params;
  if (getActivation(id)?.kind !== "fan") redirect(`/admin/activations/${id}/recipients`);
  const q = typeof (await searchParams).q === "string" ? ((await searchParams).q as string) : "";
  const fans = listFans(id, q || undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search email, name or code" className="input w-72" />
          <button className="btn-secondary">Search</button>
        </form>
        <a href={`/api/admin/activations/${id}/fans`} className="btn ml-auto">Export CSV</a>
      </div>
      <p className="text-xs text-zinc-500">
        Only share fans with the artist or promoter where the matching consent column is ticked.
      </p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Fan</th>
              <th className="px-3 py-3">Code</th>
              <th className="px-3 py-3">Opted in</th>
              <th className="px-3 py-3 text-center">Apple</th>
              <th className="px-3 py-3 text-center">Google</th>
              <th className="px-3 py-3 text-center" title="Marketing consent: artist / promoter / atVenu">Consent A·P·V</th>
              <th className="px-3 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {fans.map((f) => (
              <tr key={f.opt_in_id}>
                <td className="px-4 py-2">
                  <div className="font-medium">{[f.first_name, f.last_name].filter(Boolean).join(" ") || "—"}</div>
                  <div className="text-xs text-zinc-500">{f.email}{f.country ? ` · ${f.country}` : ""}{f.source ? ` · via ${f.source}` : ""}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {f.code}
                  {f.code_status === "redeemed" && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase text-emerald-700">redeemed</span>}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">{fmtDateTime(f.opted_in_at)}</td>
                <td className="px-3 py-2 text-center"><Tick on={f.apple_pass_at} /></td>
                <td className="px-3 py-2 text-center"><Tick on={f.google_pass_at} /></td>
                <td className="px-3 py-2 text-center tracking-widest">
                  <Tick on={f.consent_artist} /><Tick on={f.consent_promoter} /><Tick on={f.consent_atvenu} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{f.orders}</td>
                <td className="px-4 py-2 text-right tabular-nums">{f.orders ? fmtRevenue(f.spend) : "—"}</td>
              </tr>
            ))}
            {fans.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">{q ? "No matches" : "No fans yet"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
