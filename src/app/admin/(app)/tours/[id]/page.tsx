import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { KindBadge, StatusBadge } from "@/components/status-badge";
import { listActivationsForTour } from "@/lib/activations";
import { KIND_LABELS } from "@/lib/discount";
import { requireTour } from "@/lib/auth";
import { listTourCities } from "@/lib/tours";
import { formatShowDate } from "@/lib/wallet/content";
import { addTourDateAction, deleteTourDateAction, pasteTourDatesAction, updateTourAction } from "../actions";

export default async function TourPage({ params }: PageProps<"/admin/tours/[id]">) {
  const { id } = await params;
  const { tour } = await requireTour(id);
  const cities = listTourCities(id);
  const activations = listActivationsForTour(id);
  const dateCount = cities.reduce((n, c) => n + c.dates.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tours" className="text-sm text-zinc-500 hover:text-zinc-900">← Tours</Link>
        <h1 className="mt-2 text-2xl font-bold">{tour.artist_name}</h1>
        <p className="text-sm text-zinc-500">{tour.name} · {dateCount} show(s) in {cities.length} cit{cities.length === 1 ? "y" : "ies"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-x-auto">
          <h2 className="mb-3 font-semibold">Dates by city</h2>
          {cities.length === 0 ? (
            <p className="text-sm text-zinc-500">No dates yet — add them below.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="py-2">City</th><th>Date</th><th>Venue</th><th>Location</th><th /></tr>
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
                      <td className="py-2">{d.venue}</td>
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
            <h2 className="mb-3 font-semibold">Add a date</h2>
            <ActionForm action={addTourDateAction.bind(null, id)} submitLabel="Add date" resetOnSuccess>
              <label className="block"><span className="label">Date</span><input type="date" name="show_date" required className="input" /></label>
              <label className="block"><span className="label">Venue</span><input name="venue" required className="input" /></label>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <label className="block"><span className="label">City</span><input name="city" required className="input" list="tour-cities" /></label>
                <label className="block"><span className="label">Country</span><input name="country" required maxLength={2} className="input uppercase" placeholder="GB" /></label>
              </div>
              <datalist id="tour-cities">{cities.map((c) => <option key={c.city} value={c.city} />)}</datalist>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="label">Latitude</span><input name="latitude" inputMode="decimal" className="input" placeholder="Optional" /></label>
                <label className="block"><span className="label">Longitude</span><input name="longitude" inputMode="decimal" className="input" placeholder="Optional" /></label>
              </div>
              <p className="text-xs text-zinc-500">Same city name = same city. Coordinates make Apple Wallet passes pop up near the venue.</p>
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="mb-1 font-semibold">Paste several dates</h2>
            <p className="mb-3 text-xs text-zinc-500">date | venue | city | country | lat | lng</p>
            <ActionForm action={pasteTourDatesAction.bind(null, id)} submitLabel="Add dates" resetOnSuccess>
              <textarea name="dates" rows={4} className="input font-mono text-xs" />
            </ActionForm>
          </section>
        </aside>
      </div>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Activations on this tour</h2>
          <div className="flex flex-wrap gap-2">
            {(["fan", "crew", "comp"] as const).map((k) => (
              <Link key={k} href={`/admin/activations/new?kind=${k}&tour=${id}`} className="btn-secondary">+ {KIND_LABELS[k].name}</Link>
            ))}
          </div>
        </div>
        {activations.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet. Activations created from here use this tour&apos;s dates automatically.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {activations.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <KindBadge kind={a.kind} />
                <Link href={`/admin/activations/${a.id}`} className="font-medium hover:underline">{a.offer_headline}</Link>
                <StatusBadge status={a.status} />
                {a.kind !== "fan" && (
                  <Link href={`/admin/activations/${a.id}/links`} className="ml-auto text-xs underline">City sign-up links</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card max-w-3xl">
        <h2 className="mb-3 font-semibold">Tour details</h2>
        <ActionForm action={updateTourAction.bind(null, id)} submitLabel="Save">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="label">Artist</span><input name="artist_name" defaultValue={tour.artist_name} required className="input" /></label>
            <label className="block"><span className="label">Tour name</span><input name="name" defaultValue={tour.name} required className="input" /></label>
          </div>
          <label className="block"><span className="label">Notes</span><textarea name="notes" rows={2} defaultValue={tour.notes ?? ""} className="input" /></label>
          <p className="text-xs text-zinc-500">Renaming updates every activation on this tour.</p>
        </ActionForm>
      </section>
    </div>
  );
}
