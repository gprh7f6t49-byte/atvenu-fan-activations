import Link from "next/link";
import { listActivationsForTour, type ActivationKind } from "@/lib/activations";
import { requireTour } from "@/lib/auth";
import { listTourCities } from "@/lib/tours";
import { formatShowDate } from "@/lib/wallet/content";
import { setupActivationsAction } from "../../actions";
import { SetupForm } from "./setup-form";
import { GroupHeader } from "@/components/group-header";

export const metadata = { title: "Set up activations · Activations" };

export default async function SetupActivationsPage({ params }: PageProps<"/admin/tours/[id]/setup">) {
  const { id } = await params;
  const { tour } = await requireTour(id);
  const cities = listTourCities(id);
  const dates = cities.flatMap((c) => c.dates);
  const existing: Partial<Record<ActivationKind, string>> = {};
  const activations = listActivationsForTour(id);
  for (const a of activations) existing[a.kind] ??= `/admin/activations/${a.id}`;
  const year = dates[0]?.show_date.slice(0, 4) ?? String(new Date().getFullYear());
  const slug = `${tour.artist_name}-${year}`.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return (
    <>
      <GroupHeader type="tour" href={`/admin/tours/${id}`} artist={tour.artist_name} name={tour.name}
        firstDate={dates[0]?.show_date} lastDate={dates.at(-1)?.show_date} activations={activations} setupHref={`/admin/tours/${id}/setup`} />
      <h2 className="mb-1 text-xl font-bold">Add activations</h2>
      <p className="mb-6 text-sm text-zinc-600">
        {dates.length
          ? `${dates.length} show(s) in ${cities.length} cit${cities.length === 1 ? "y" : "ies"}, ${formatShowDate(dates[0].show_date)} – ${formatShowDate(dates[dates.length - 1].show_date)}.`
          : "This tour has no dates yet."}{" "}
        <Link href={`/admin/tours/${id}`} className="underline">{dates.length ? "Edit dates" : "Add dates first"}</Link>
      </p>
      {!dates.length && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Passes show the tour dates, and crew city links need them. You can carry on and add dates afterwards.
        </div>
      )}
      {Object.keys(existing).length === 3 ? (
        <div className="card text-sm text-zinc-600">
          Fan, crew and comp activations are all set up on this tour. <Link href={`/admin/tours/${id}`} className="underline">Back to the tour</Link>
        </div>
      ) : (
      <div className="card">
        <SetupForm action={setupActivationsAction.bind(null, id)} existing={existing} slug={slug} artist={tour.artist_name} tourName={tour.name}
          shows={dates.slice(0, 8).map((d) => ({ id: d.id, show_date: d.show_date, venue: d.venue, city: d.city }))} />
      </div>
      )}
    </>
  );
}
