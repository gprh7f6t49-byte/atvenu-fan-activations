import type { ActivationKind, ActivationStatus } from "@/lib/activations";
import { KIND_LABELS } from "@/lib/discount";

const STYLES: Record<ActivationStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  live: "bg-emerald-50 text-emerald-700 ring-emerald-300",
  ended: "bg-amber-50 text-amber-700 ring-amber-300",
};

export function StatusBadge({ status }: { status: ActivationStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ${STYLES[status]}`}>
      {status}
    </span>
  );
}

const KIND_STYLES: Record<ActivationKind, string> = {
  fan: "bg-sky-50 text-sky-700 ring-sky-200",
  crew: "bg-violet-50 text-violet-700 ring-violet-200",
  comp: "bg-orange-50 text-orange-700 ring-orange-200",
};

export function KindBadge({ kind }: { kind: ActivationKind }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${KIND_STYLES[kind]}`}>{KIND_LABELS[kind].short}</span>
  );
}
