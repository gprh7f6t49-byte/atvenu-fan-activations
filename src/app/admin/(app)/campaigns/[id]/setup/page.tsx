import Link from "next/link";
import { listActivationsForTour, type ActivationKind } from "@/lib/activations";
import { requireTour } from "@/lib/auth";
import { CAMPAIGN_TYPES, campaignHref, datesSummary } from "@/lib/campaigns";
import { listTourDates } from "@/lib/tours";
import { formatShowDate } from "@/lib/wallet/content";
import { setupActivationsAction } from "../../actions";
import { SetupForm } from "@/components/setup-form";
import { GroupHeader } from "@/components/group-header";

export const metadata = { title: "Add activations · Campaigns" };

export default async function SetupActivationsPage({ params }: PageProps<"/admin/campaigns/[id]/setup">) {
  const { id } = await params;
  const { tour } = await requireTour(id);
  const type = CAMPAIGN_TYPES[tour.type];
  const dates = listTourDates(id);
  const existing: Partial<Record<ActivationKind, string>> = {};
  const activations = listActivationsForTour(id);
  for (const a of activations) existing[a.kind] ??= `/admin/activations/${a.id}`;
  const year = dates[0]?.show_date.slice(0, 4) ?? String(new Date().getFullYear());
  const base = tour.type === "tour" ? `${tour.artist_name}-${year}` : `${tour.artist_name}-${tour.name}`;
  const slug = base.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const href = campaignHref(id);

  return (
    <>
      <GroupHeader type={tour.type} href={href} artist={tour.artist_name} name={tour.name}
        firstDate={dates[0]?.show_date} lastDate={dates.at(-1)?.show_date} activations={activations} setupHref={`${href}/setup`} />
      <h2 className="mb-1 text-xl font-bold">Add activations</h2>
      <p className="mb-6 text-sm text-zinc-600">
        {dates.length
          ? `${datesSummary(tour.type, dates)}, ${formatShowDate(dates[0].show_date)} – ${formatShowDate(dates[dates.length - 1].show_date)}.`
          : `This ${type.label.toLowerCase()} has no dates yet.`}{" "}
        <Link href={href} className="underline">{dates.length ? "Edit dates" : "Add dates first"}</Link>
      </p>
      {!dates.length && tour.type !== "event" && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Passes show the {type.datesHeading.toLowerCase()}, and crew sign-up links need them. You can carry on and add dates afterwards.
        </div>
      )}
      {Object.keys(existing).length === 3 ? (
        <div className="card text-sm text-zinc-600">
          Fan, crew and comp activations are all set up. <Link href={href} className="underline">Back to the overview</Link>
        </div>
      ) : (
        <div className="card">
          <SetupForm action={setupActivationsAction.bind(null, id)} existing={existing} slug={slug} artist={tour.artist_name} tourName={tour.name}
            campaignType={tour.type} shows={dates.slice(0, 8).map((d) => ({ id: d.id, show_date: d.show_date, venue: d.venue, city: d.city }))} />
        </div>
      )}
    </>
  );
}
