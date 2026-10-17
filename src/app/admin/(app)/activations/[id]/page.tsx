import Link from "next/link";
import { getActivationStats, getDailySeries, getRedemptionsByVenue } from "@/lib/activations";
import { DailyBars, Funnel, StatTile } from "@/components/charts";
import { fmtInt, fmtMoney, fmtPct, fmtRevenue } from "@/lib/format";

export default async function ResultsPage({ params }: PageProps<"/admin/activations/[id]">) {
  const { id } = await params;
  const s = getActivationStats(id);
  const daily = getDailySeries(id);
  const venues = getRedemptionsByVenue(id);
  const walletAdds = s.apple_passes + s.google_passes;

  if (s.codes_total === 0) {
    return (
      <div className="card text-sm text-zinc-600">
        No promo codes loaded yet. <Link href={`/admin/activations/${id}/imports`} className="font-semibold underline">Import a CSV of atVenu codes</Link> before
        going live.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Fan opt-ins" value={fmtInt(s.opt_ins)} sub={`${fmtInt(s.codes_available)} of ${fmtInt(s.codes_total)} codes left`} />
        <StatTile label="Added to wallet" value={fmtInt(walletAdds)} sub={`${fmtInt(s.apple_passes)} Apple · ${fmtInt(s.google_passes)} Google`} />
        <StatTile label="Fans who bought" value={fmtInt(s.redeemed_fans)} sub={`${fmtPct(s.redeemed_fans, s.opt_ins)} of opt-ins`} />
        <StatTile label="Attributed merch sales"
          value={s.revenue.length > 1 ? s.revenue.map((r) => <span key={r.currency} className="block text-2xl">{fmtMoney(r.total, r.currency)}</span>) : fmtRevenue(s.revenue)}
          sub={`${fmtInt(s.redemptions - s.unmatched_redemptions)} orders from opted-in fans`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">Fan funnel</h2>
          <Funnel steps={[
            { label: "Opted in", value: s.opt_ins },
            { label: "Added pass to wallet", value: walletAdds },
            { label: "Redeemed at merch stand", value: s.redeemed_fans },
          ]} />
          {s.unmatched_redemptions > 0 && (
            <p className="mt-4 text-xs text-zinc-500">
              {fmtInt(s.unmatched_redemptions)} imported sale(s) used codes not linked to a fan in this activation.
            </p>
          )}
        </section>
        <section className="card">
          <h2 className="mb-2 font-semibold">Opt-ins per day</h2>
          <DailyBars label="Opt-ins" data={daily.filter((d) => d.opt_ins > 0).map((d) => ({ day: d.day, value: d.opt_ins }))} />
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Redemptions by venue</h2>
        {venues.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No matched sales yet. <Link href={`/admin/activations/${id}/imports`} className="underline">Upload an atVenu redemption report</Link> after
            each show.
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
