import { ActionForm } from "@/components/action-form";
import { ActivationSummary } from "@/components/activation-summary";
import { GroupHeader } from "@/components/group-header";
import { listShows } from "@/lib/activations";
import { requireEvent } from "@/lib/auth";
import { formatUkDate } from "@/lib/dates";
import { KIND_LABELS } from "@/lib/discount";
import { formatShowDate } from "@/lib/wallet/content";
import { updateEventAction } from "../../tours/actions";
import { RecentChanges } from "@/components/recent-changes";

export const metadata = { title: "Event · Activations" };

/** Overview of a standalone event (one-off show, pop-up, food & drink): its details, dates and activations. */
export default async function EventPage({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { activations } = await requireEvent(id);
  const first = activations[0];
  const shows = listShows(first.id);
  const created = typeof sp.created === "string" ? sp.created.split(",").filter((k): k is keyof typeof KIND_LABELS => k in KIND_LABELS) : [];
  const datesText = shows.map((s) => [formatUkDate(s.show_date), s.venue, s.city, s.country].filter(Boolean).join(" | ")).join("\n");

  return (
    <div className="space-y-6">
      <div>
        <GroupHeader type="event" href={`/admin/events/${id}`} artist={first.artist_name} name={first.tour_name}
          firstDate={shows[0]?.show_date} lastDate={shows.at(-1)?.show_date} activations={activations} setupHref={`/admin/events/${id}/setup`}
          renameHref="#details" />
      </div>

      {created.length > 0 && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p className="font-semibold">Created: {created.map((k) => KIND_LABELS[k].name).join(", ")}.</p>
          <p className="mt-1">
            Next: open each one from the tabs above. Download generated codes for atVenu from <em>Codes &amp; sales</em>
            {created.some((k) => k !== "fan") ? ", create crew / comp sign-up links" : ""}
            {created.includes("fan") ? ", and share the fan landing page once it's live" : ""}.
          </p>
        </div>
      )}

      <ActivationSummary activations={activations} setupHref={`/admin/events/${id}/setup`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card overflow-x-auto">
          <h2 className="mb-3 font-semibold">Dates &amp; locations</h2>
          {shows.length === 0 ? (
            <p className="text-sm text-zinc-500">No dates — an ongoing offer. Add dates on the right if it runs on particular days.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {shows.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">{formatShowDate(s.show_date)}</td>
                    <td className="py-2">{s.venue}</td>
                    <td className="py-2 text-zinc-500">{s.city}{s.country ? `, ${s.country}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section id="details" className="card scroll-mt-6">
          <h2 className="mb-3 font-semibold">Event name &amp; dates</h2>
          <ActionForm action={updateEventAction.bind(null, id)} submitLabel="Save for all activations">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block"><span className="label">Artist, brand or venue</span><input name="artist_name" defaultValue={first.artist_name} required className="input" /></label>
              <label className="block"><span className="label">Event or campaign</span><input name="tour_name" defaultValue={first.tour_name} required className="input" /></label>
            </div>
            <label className="block">
              <span className="label">Dates (one per line)</span>
              <textarea name="dates" rows={5} defaultValue={datesText} className="input font-mono text-xs" placeholder="01-08-2027 | Covent Garden pop-up | London | GB" />
              <span className="mt-1 block text-xs text-zinc-500">DD-MM-YYYY | venue or location | city | country. Applies to every activation in this event.</span>
            </label>
          </ActionForm>
        </section>
      </div>

      <RecentChanges groupId={id} orgId={first.organisation_id} />
      <p className="text-xs text-zinc-500">
        To remove this event, delete its activations (each tab → Settings → Delete). The event goes when its last activation is deleted.
      </p>
    </div>
  );
}
