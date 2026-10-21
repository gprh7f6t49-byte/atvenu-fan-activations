import Link from "next/link";
import { GroupHeader } from "@/components/group-header";
import { listShows, type ActivationKind } from "@/lib/activations";
import { requireEvent } from "@/lib/auth";
import { SetupForm } from "../../../tours/[id]/setup/setup-form";
import { addToEventAction } from "../../../tours/actions";

export const metadata = { title: "Add activations · Activations" };

export default async function AddToEventPage({ params }: PageProps<"/admin/events/[id]/setup">) {
  const { id } = await params;
  const { activations } = await requireEvent(id);
  const first = activations[0];
  const shows = listShows(first.id);
  const existing: Partial<Record<ActivationKind, string>> = {};
  for (const a of activations) existing[a.kind] ??= `/admin/activations/${a.id}`;
  const slug = `${first.artist_name}-${first.tour_name}`.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  return (
    <>
      <GroupHeader type="event" href={`/admin/events/${id}`} artist={first.artist_name} name={first.tour_name}
        firstDate={shows[0]?.show_date} lastDate={shows.at(-1)?.show_date} activations={activations} setupHref={`/admin/events/${id}/setup`} />
      <h2 className="mb-1 text-xl font-bold">Add activations</h2>
      <p className="mb-6 text-sm text-zinc-600">New activations share this event&apos;s details and dates.</p>
      {Object.keys(existing).length === 3 ? (
        <div className="card text-sm text-zinc-600">
          Fan, crew and comp activations are all set up for this event. <Link href={`/admin/events/${id}`} className="underline">Back to the overview</Link>
        </div>
      ) : (
        <div className="card">
          <SetupForm action={addToEventAction.bind(null, id)} existing={existing} standalone slug={existing.fan ? "" : slug}
            artist={first.artist_name} tourName={first.tour_name}
            shows={shows.slice(0, 8).map((s) => ({ id: s.id, show_date: s.show_date, venue: s.venue, city: s.city }))} />
        </div>
      )}
    </>
  );
}
