import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { isPlatformAdmin, orgScope, requireUser } from "@/lib/auth";
import { CAMPAIGN_TYPES, campaignHref, isCampaignType, type CampaignType } from "@/lib/campaigns";
import { listOrganisations } from "@/lib/orgs";
import { listTours } from "@/lib/tours";
import { createTourAction } from "../actions";

export const metadata = { title: "New campaign · Campaigns" };

const TYPES: CampaignType[] = ["tour", "festival", "event"];

/** Step 1: choose the kind of campaign and name it. Dates and activations follow on its Overview. */
export default async function NewCampaignPage({ searchParams }: PageProps<"/admin/campaigns/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const type = isCampaignType(sp.type) ? sp.type : null;
  const organisations = isPlatformAdmin(user) ? listOrganisations() : null;

  if (!type) {
    const existing = listTours(orgScope(user)).slice(0, 8);
    return (
      <>
        <h1 className="mb-1 text-2xl font-bold">New campaign</h1>
        <p className="mb-6 text-sm text-zinc-600">What are the passes for? You&apos;ll add the dates next, then choose fan, crew and comp activations.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {TYPES.map((t) => (
            <Link key={t} href={`/admin/campaigns/new?type=${t}`} className="card block transition hover:border-zinc-400">
              <p className="text-lg font-bold">{CAMPAIGN_TYPES[t].label}</p>
              <p className="mt-2 text-sm text-zinc-600">{CAMPAIGN_TYPES[t].blurb}</p>
              <p className="mt-4 text-sm font-semibold">Set up →</p>
            </Link>
          ))}
        </div>
        {existing.length > 0 && (
          <section className="card mt-8">
            <h2 className="mb-1 font-semibold">Or add activations to a campaign you&apos;ve set up</h2>
            <ul className="divide-y divide-zinc-100 text-sm">
              {existing.map((c) => (
                <li key={c.id}>
                  <Link href={`${campaignHref(c.id)}/setup`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-zinc-50">
                    <span className="rounded bg-zinc-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">{CAMPAIGN_TYPES[c.type].label}</span>
                    <span className="font-medium">{c.artist_name}</span>
                    <span className="text-zinc-500">{c.name}</span>
                    <span className="ml-auto text-xs text-zinc-500">{c.activation_count} activation(s) · Add →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  const t = CAMPAIGN_TYPES[type];
  return (
    <>
      <Link href="/admin/campaigns/new" className="text-sm text-zinc-500 hover:text-zinc-900">← Choose a different type</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">New {t.label.toLowerCase()}</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Step 1 of 3. Next you&apos;ll add the {t.datesHeading.toLowerCase()}
        {type === "festival" ? " (as many days, weekends and venues as you need)" : ""}, then choose the fan, crew and comp activations.
      </p>
      <div className="card max-w-3xl">
        <ActionForm action={createTourAction} submitLabel={`Create ${t.label.toLowerCase()} and add dates →`}>
          <input type="hidden" name="type" value={type} />
          {organisations && (
            <label className="block max-w-md">
              <span className="label">Client</span>
              <select name="organisation_id" required defaultValue="" className="input">
                <option value="" disabled>Choose a client…</option>
                {organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="label">{t.nameLabel}</span><input name="artist_name" required className="input" placeholder={t.namePlaceholder} /></label>
            <label className="block"><span className="label">{t.editionLabel}</span><input name="name" required className="input" placeholder={t.editionPlaceholder} /></label>
          </div>
          <label className="block"><span className="label">Notes (optional)</span><textarea name="notes" rows={2} className="input" /></label>
        </ActionForm>
      </div>
    </>
  );
}
