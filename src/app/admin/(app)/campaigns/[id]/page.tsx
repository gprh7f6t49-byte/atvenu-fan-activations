import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { GroupHeader } from "@/components/group-header";
import { ActivationSummary } from "@/components/activation-summary";
import { getActivationStats, listActivationsForTour } from "@/lib/activations";
import { KIND_LABELS } from "@/lib/discount";
import { canDelete, requireTour } from "@/lib/auth";
import { DeleteBox } from "@/components/delete-box";
import { RecentChanges } from "@/components/recent-changes";
import { groupByCity, listTourDates } from "@/lib/tours";
import { CAMPAIGN_TYPES, campaignHref, datesSummary } from "@/lib/campaigns";
import { formatShowDate } from "@/lib/wallet/content";
import { TourImport } from "./tour-import";
import { addTourDateAction, deleteTourAction, deleteTourDateAction, updateTourAction } from "../actions";

/** A campaign's Overview: its activations, dates and details. */
export default async function CampaignPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const created = typeof sp.created === "string" ? sp.created.split(",").filter((k): k is keyof typeof KIND_LABELS => k in KIND_LABELS) : [];
  const { user, tour } = await requireTour(id);
  const type = CAMPAIGN_TYPES[tour.type];
  const byVenue = type.linkUnit === "venue";
  const allDates = listTourDates(id);
  const cities = groupByCity(allDates, type.linkUnit);
  const href = campaignHref(id);
  const summary = datesSummary(tour.type, allDates);
  const activations = listActivationsForTour(id);
  const dateCount = cities.reduce((n, c) => n + c.dates.length, 0);
  const countries = cities.map((c) => c.country).filter(Boolean);
  const usualCountry = countries.sort((x, y) => countries.filter((c) => c === y).length - countries.filter((c) => c === x).length)[0] ?? "GB";

  return (
    <div className="space-y-6">
      <div>
        <GroupHeader
          type={tour.type}
          href={href}
          artist={tour.artist_name}
          name={`${tour.name} · ${summary}`}
          activations={activations}
          setupHref={`${href}/setup`}
          renameHref="#details"
        />
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

      {activations.length === 0 && (
        <ol className="grid gap-3 md:grid-cols-3">
          <Step n={1} done title={`Create the ${type.label.toLowerCase()}`} text={`${tour.artist_name} · ${tour.name}`} />
          <Step n={2} done={dateCount > 0} title="Add the dates"
            text={dateCount ? `${summary}. Add more any time.` : tour.type === "event" ? "Optional for an event. Paste them below if it runs on particular days." : "Paste them in any format below, or use a web page link."} />
          <Step n={3} done={false} title="Choose activations" text="Fan, crew and comps together — they all share these dates.">
            <Link href={`${href}/setup`} className={dateCount || tour.type === "event" ? "btn mt-3" : "btn-secondary mt-3"}>Set up activations →</Link>
          </Step>
        </ol>
      )}

      {activations.length > 0 && <ActivationSummary activations={activations.map((a) => ({ ...a, ...getActivationStats(a.id) }))} setupHref={`${href}/setup`} />}

      <TourImport tourId={id} defaultCountry={usualCountry} collapsed={dateCount > 0} noun={type.datesHeading.toLowerCase()} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-x-auto">
          <h2 className="mb-3 font-semibold">{type.datesHeading} by {byVenue ? "venue" : "city"}</h2>
          {cities.length === 0 ? (
            <p className="text-sm text-zinc-500">No dates yet. Paste them into Add dates above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="py-2">{byVenue ? "Venue" : "City"}</th><th>Date</th><th>{byVenue ? "City" : "Venue"}</th><th>Location</th><th /></tr>
              </thead>
              <tbody>
                {cities.map((c) =>
                  c.dates.map((d, i) => (
                    <tr key={d.id} className={i === 0 ? "border-t border-zinc-200" : ""}>
                      <td className="py-2 align-top">
                        {i === 0 && (
                          <>
                            <span className="font-semibold">{c.city}</span> <span className="text-xs text-zinc-500">{c.country}</span>
                            {c.dates.length > 1 && <div className="text-xs text-zinc-500">{c.dates.length} dates</div>}
                          </>
                        )}
                      </td>
                      <td className="py-2">{formatShowDate(d.show_date)}</td>
                      <td className="py-2">{byVenue ? d.city : d.venue}</td>
                      <td className="py-2 text-xs text-zinc-500">{d.latitude != null ? "📍 set" : "—"}</td>
                      <td className="py-2 text-right">
                        <form action={deleteTourDateAction.bind(null, id, d.id)}>
                          <button className="text-xs text-red-600 underline">Remove</button>
                        </form>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </section>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-semibold">Add one date</h2>
            <ActionForm action={addTourDateAction.bind(null, id)} submitLabel="Add date" resetOnSuccess>
              <label className="block"><span className="label">Date</span><input name="show_date" required className="input" placeholder="DD-MM-YYYY" inputMode="numeric" title="DD-MM-YYYY, e.g. 12-06-2027" /></label>
              <label className="block"><span className="label">Venue</span><input name="venue" required className="input" /></label>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <label className="block"><span className="label">City</span><input name="city" required className="input" list="tour-cities" /></label>
                <label className="block"><span className="label">Country</span><input name="country" required maxLength={2} className="input uppercase" placeholder="GB" /></label>
              </div>
              <datalist id="tour-cities">{[...new Set(allDates.map((d) => d.city))].map((c) => <option key={c} value={c} />)}</datalist>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="label">Latitude</span><input name="latitude" inputMode="decimal" className="input" placeholder="Optional" /></label>
                <label className="block"><span className="label">Longitude</span><input name="longitude" inputMode="decimal" className="input" placeholder="Optional" /></label>
              </div>
              <p className="text-xs text-zinc-500">{byVenue ? "Same venue name = same venue (sign-up links are per venue)." : "Same city name = same city."} Coordinates make Apple Wallet passes pop up near the venue.</p>
            </ActionForm>
          </section>
        </aside>
      </div>


      <section id="details" className="card max-w-3xl scroll-mt-6">
        <h2 className="mb-3 font-semibold">{type.label} name &amp; details</h2>
        <ActionForm action={updateTourAction.bind(null, id)} submitLabel="Save">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="label">{type.nameLabel}</span><input name="artist_name" defaultValue={tour.artist_name} required className="input" /></label>
            <label className="block"><span className="label">{type.editionLabel}</span><input name="name" defaultValue={tour.name} required className="input" /></label>
          </div>
          <label className="block"><span className="label">Notes</span><textarea name="notes" rows={2} defaultValue={tour.notes ?? ""} className="input" /></label>
          <p className="text-xs text-zinc-500">Renaming updates every activation in this {type.label.toLowerCase()}.</p>
        </ActionForm>
      </section>

      <RecentChanges groupId={id} orgId={tour.organisation_id} />

      <DeleteBox
        title={`Delete this ${type.label.toLowerCase()}`}
        confirmWord={tour.name}
        buttonLabel={`Delete ${type.label.toLowerCase()}`}
        action={deleteTourAction.bind(null, id)}
        blocked={
          !canDelete(user, tour.organisation_id)
            ? "Only client admins can delete campaigns."
            : activations.length
              ? `Delete its ${activations.length} activation${activations.length === 1 ? "" : "s"} first: open each tab above → Settings → Delete.`
              : undefined
        }
      >
        Removes the {type.label.toLowerCase()} and its {dateCount} date(s). A campaign can only be deleted once it has no activations.
      </DeleteBox>
    </div>
  );
}

function Step({ n, done, title, text, children }: { n: number; done: boolean; title: string; text: string; children?: React.ReactNode }) {
  return (
    <li className={`card ${done ? "bg-zinc-50" : "border-zinc-900"}`}>
      <p className="flex items-center gap-2 font-semibold">
        <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${done ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white"}`}>{done ? "✓" : n}</span>
        {title}
      </p>
      <p className="mt-2 text-sm text-zinc-600">{text}</p>
      {children}
    </li>
  );
}
