import Link from "next/link";
import type { Activation } from "@/lib/activations";
import { KIND_LABELS } from "@/lib/discount";
import { formatShowDate } from "@/lib/wallet/content";
import { GroupTabs } from "./group-tabs";
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/campaigns";

/** Title and tab bar shared by a tour / event's overview and its activations. */
export function GroupHeader({ type, href, artist, name, firstDate, lastDate, activations, setupHref, renameHref }: {
  type: CampaignType;
  href: string;
  artist: string;
  name: string;
  firstDate?: string | null;
  lastDate?: string | null;
  activations: Pick<Activation, "id" | "kind" | "status">[];
  setupHref: string;
  /** Shows a "Rename" link next to the title. */
  renameHref?: string;
}) {
  const dates = firstDate ? (firstDate === lastDate || !lastDate ? formatShowDate(firstDate) : `${formatShowDate(firstDate)} – ${formatShowDate(lastDate)}`) : null;
  return (
    <div className="mb-6">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">← Campaigns</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold">{artist}</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-600 ring-1 ring-zinc-300">
          {CAMPAIGN_TYPES[type].label}
        </span>
        {renameHref && <Link href={renameHref} className="text-xs underline">Rename</Link>}
      </div>
      <p className="text-sm text-zinc-500">{name}{dates ? ` · ${dates}` : ""}</p>
      <div className="mt-5">
        <GroupTabs
          tabs={[
            { href, label: "Overview" },
            ...activations.map((a) => ({ href: `/admin/activations/${a.id}`, label: KIND_LABELS[a.kind].name, status: a.status, prefix: true })),
            ...(new Set(activations.map((a) => a.kind)).size < 3 ? [{ href: setupHref, label: "+ Add activation", muted: true }] : []),
          ]}
        />
      </div>
    </div>
  );
}
