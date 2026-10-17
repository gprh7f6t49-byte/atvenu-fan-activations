import type { ActivationStatus } from "@/lib/activations";

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
