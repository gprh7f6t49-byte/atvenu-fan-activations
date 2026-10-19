import Link from "next/link";
import { pendingAtvenuCodes } from "@/lib/codes";
import { fmtInt } from "@/lib/format";

/** Reminder that generated codes must be loaded into atVenu before they work at the merch stand. */
export function AtvenuCodeWarning({ activationId }: { activationId: string }) {
  const pending = pendingAtvenuCodes(activationId);
  if (pending.batches === 0) return null;
  const step = pending.exported < pending.batches ? "Download them and send them to atVenu" : "Once atVenu has loaded them, mark them as loaded";
  return (
    <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <b>{fmtInt(pending.codes)} generated code{pending.codes === 1 ? "" : "s"} not yet loaded in atVenu.</b> People can sign up and get
      their passes, but the merch stand won&apos;t accept these codes until atVenu loads them. {step} on the{" "}
      <Link href={`/admin/activations/${activationId}/imports`} className="font-semibold underline">Codes &amp; sales</Link> tab.
    </div>
  );
}
