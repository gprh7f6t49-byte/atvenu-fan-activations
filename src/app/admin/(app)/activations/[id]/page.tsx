import { requireActivation } from "@/lib/auth";
import Link from "next/link";
import {
  getActivationStats,
  getDailySeries,
  getRecipientBreakdown,
  getRedemptionsByVenue,
} from "@/lib/activations";
import { DailyBars, Funnel, StatTile } from "@/components/charts";
import { KIND_LABELS } from "@/lib/discount";
import { fmtInt, fmtMoney, fmtPct, fmtRevenue } from "@/lib/format";

function Money({ rows }: { rows: { currency: string | null; total: number }[] }) {
  return rows.length > 1
    ? rows.map((r) => <span key={r.currency} className="block text-2xl">{fmtMoney(r.total, r.currency)}</span>)
    : fmtRevenue(rows);
}

export default async function ResultsPage({ params }: PageProps<"/admin/activations/[id]">) {
  const { id } = await params;
  const { activation: a } = await requireActivation(id);
  const s = getActivationStats(id);
  const venues = getRedemptionsByVenue(id);
  const walletAdds = s.apple_passes + s.google_passes;
  const fan = a.kind === "fan";
  const labels = KIND_LABELS[a.kind];
  const people = labels.people.toLowerCase();
  const matchedOrders = s.redemptions - s.unmatched_redemptions;
  const discountText = s.discount_given.length ? s.discount_given.map((r) => fmtMoney(r.total, r.currency)).join(" · ") : null;

  if (s.codes_total === 0) {
    return (
      <div className="card text-sm text-zinc-600">
        No promo codes loaded yet. <Link href={`/admin/activations/${id}/imports`} className="font-semibold underline">Generate or import promo codes</Link>{" "}
        {fan ? "before going live." : "before issuing passes."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label={fan ? "Fan opt-ins" : "Passes issued"}
          value={fmtInt(s.opt_ins)}
          sub={`${fmtInt(s.codes_available)} of ${fmtInt(s.codes_total)} codes left${s.revoked ? ` · ${fmtInt(s.revoked)} revoked` : ""}`}
        />
        <StatTile label="Added to wallet" value={fmtInt(walletAdds)} sub={`${fmtInt(s.apple_passes)} Apple · ${fmtInt(s.google_passes)} Google`} />
        <StatTile
          label={fan ? "Fans who bought" : `${labels.people} who used it`}
          value={fmtInt(s.redeemed_fans)}
          sub={`${fmtPct(s.redeemed_fans, s.opt_ins)} of ${fan ? "opt-ins" : "passes"}`}
        />
        {fan ? (
          <StatTile label="Attributed merch sales" value={<Money rows={s.revenue} />}
            sub={`${fmtInt(matchedOrders)} orders${discountText ? ` · est. ${discountText} discount` : ""}`} />
        ) : (
          <StatTile label="Discount given (est.)" value={discountText ? <Money rows={s.discount_given} /> : "—"}
            sub={`${fmtInt(matchedOrders)} orders · ${fmtRevenue(s.revenue)} paid`} />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">{fan ? "Fan funnel" : "Pass usage"}</h2>
          <Funnel steps={[
            { label: fan ? "Opted in" : "Passes issued", value: s.opt_ins },
            { label: "Added pass to wallet", value: walletAdds },
            { label: "Used at merch stand", value: s.redeemed_fans },
          ]} />
          {s.unmatched_redemptions > 0 && (
            <p className="mt-4 text-xs text-zinc-500">
              {fmtInt(s.unmatched_redemptions)} imported sale(s) used codes not linked to anyone in this activation.
            </p>
          )}
        </section>
        {fan ? (
          <section className="card">
            <h2 className="mb-2 font-semibold">Opt-ins per day</h2>
            <DailyBars label="Opt-ins" data={getDailySeries(id).filter((d) => d.opt_ins > 0).map((d) => ({ day: d.day, value: d.opt_ins }))} />
          </section>
        ) : (
          <section className="card overflow-x-auto">
            <h2 className="mb-3 font-semibold">By {a.kind === "crew" ? "department" : "group"}</h2>
            <BreakdownTable id={id} />
          </section>
        )}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Redemptions by venue</h2>
        {venues.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No matched sales yet. <Link href={`/admin/activations/${id}/imports`} className="underline">Upload an atVenu redemption report</Link> after
            each show to see which {people} used their pass.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="py-2">Venue</th><th>City</th><th className="text-right">Redemptions</th><th className="text-right">Sales</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {venues.map((v) => (
                <tr key={v.venue}>
                  <td className="py-2">{v.venue}</td>
                  <td>{v.city ?? "—"}</td>
                  <td className="text-right tabular-nums">{fmtInt(v.redemptions)}</td>
                  <td className="text-right tabular-nums">{fmtMoney(v.revenue, v.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function BreakdownTable({ id }: { id: string }) {
  const rows = getRecipientBreakdown(id);
  if (rows.length === 0) return <p className="text-sm text-zinc-500">No passes issued yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr><th className="py-2"> </th><th className="text-right">Issued</th><th className="text-right">Used</th><th className="text-right">Orders</th><th className="text-right">Paid</th></tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-2">{r.label}</td>
            <td className="text-right tabular-nums">{fmtInt(r.issued)}</td>
            <td className="text-right tabular-nums">{fmtInt(r.used)}</td>
            <td className="text-right tabular-nums">{fmtInt(r.orders)}</td>
            <td className="text-right tabular-nums">{r.orders ? fmtRevenue(r.revenue) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
