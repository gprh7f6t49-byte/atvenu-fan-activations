import Link from "next/link";
import { listActivations } from "@/lib/activations";
import { KindBadge, StatusBadge } from "@/components/status-badge";
import { formatDiscount } from "@/lib/discount";
import { isPlatformAdmin, orgScope, requireUser } from "@/lib/auth";
import { fmtInt, fmtPct, fmtRevenue } from "@/lib/format";

export const metadata = { title: "Activations · Fan Activations" };

export default async function ActivationsPage() {
  const user = await requireUser();
  const platform = isPlatformAdmin(user);
  const activations = listActivations(orgScope(user));
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activations</h1>
        <Link href="/admin/activations/new" className="btn">New activation</Link>
      </div>
      {activations.length === 0 ? (
        <div className="card text-center text-zinc-600">
          No activations yet. Create a fan activation, crew sales or venue &amp; management comps, then import a CSV of atVenu promo codes.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Activation</th>
                {platform && <th className="px-3 py-3">Client</th>}
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Discount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Opt-ins / passes</th>
                <th className="px-3 py-3 text-right">Codes left</th>
                <th className="px-3 py-3 text-right">Redeemed</th>
                <th className="px-3 py-3 text-right">Conversion</th>
                <th className="px-5 py-3 text-right">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {activations.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/activations/${a.id}`} className="font-semibold hover:underline">
                      {a.artist_name}
                    </Link>
                    <div className="text-xs text-zinc-500">{a.tour_name}</div>
                  </td>
                  {platform && <td className="px-3 py-3 text-xs text-zinc-600">{a.organisation_name ?? "—"}</td>}
                  <td className="px-3 py-3"><KindBadge kind={a.kind} /></td>
                  <td className="px-3 py-3 text-xs text-zinc-600">{formatDiscount(a) ?? "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtInt(a.opt_ins)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtInt(a.codes_available)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtInt(a.redeemed_fans)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtPct(a.redeemed_fans, a.opt_ins)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtRevenue(a.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
