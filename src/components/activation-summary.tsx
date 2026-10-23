import Link from "next/link";
import type { GroupActivation } from "@/lib/groups";
import { APPLIES_LABELS, formatDiscount, KIND_LABELS } from "@/lib/discount";
import { fmtInt, fmtRevenue } from "@/lib/format";
import { KindBadge, StatusBadge } from "./status-badge";

/** One card per activation on a tour / event overview, linking to its tab. */
export function ActivationSummary({ activations, setupHref }: { activations: GroupActivation[]; setupHref: string }) {
  if (!activations.length) {
    return (
      <div className="card text-sm text-zinc-600">
        No activations yet. <Link href={setupHref} className="font-semibold underline">Set up fan, crew or comp activations</Link> — they share these dates.
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {activations.map((a) => (
        <Link key={a.id} href={`/admin/activations/${a.id}`} className="card block transition hover:border-zinc-400">
          <div className="flex items-center gap-2">
            <KindBadge kind={a.kind} />
            <StatusBadge status={a.status} />
          </div>
          <p className="mt-3 font-semibold">{a.offer_headline}</p>
          <p className="text-xs text-zinc-500">{formatDiscount(a)} · {APPLIES_LABELS[a.applies_to]} · {a.single_use ? "one order per code" : "reusable"}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-xs text-zinc-500">{a.kind === "fan" ? "Sign-ups" : "Passes"}</dt><dd className="font-semibold tabular-nums">{fmtInt(a.opt_ins)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Used</dt><dd className="font-semibold tabular-nums">{fmtInt(a.redeemed_fans)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Codes left</dt><dd className="font-semibold tabular-nums">{fmtInt(a.codes_available)}</dd></div>
          </dl>
          {a.revenue.length > 0 && <p className="mt-2 text-xs text-zinc-500">Sales {fmtRevenue(a.revenue)}</p>}
          <p className="mt-3 text-sm font-semibold">Open {KIND_LABELS[a.kind].short.toLowerCase()} →</p>
        </Link>
      ))}
    </div>
  );
}
