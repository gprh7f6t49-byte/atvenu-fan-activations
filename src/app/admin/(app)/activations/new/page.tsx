import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformAdmin, orgScope, requireTour, requireUser } from "@/lib/auth";
import { listTours } from "@/lib/tours";
import { formatShowDate } from "@/lib/wallet/content";

export const metadata = { title: "New activation · Activations" };

/** Activations always hang off a tour, so creating one starts by choosing (or creating) the tour. */
export default async function NewActivationPage({ searchParams }: PageProps<"/admin/activations/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  if (typeof sp.tour === "string") {
    await requireTour(sp.tour);
    redirect(`/admin/tours/${sp.tour}/setup`);
  }
  const tours = listTours(orgScope(user));
  const platform = isPlatformAdmin(user);

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">New activation</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Activations belong to a tour, so the dates and cities are entered once and shared by the fan, crew and comp passes.
      </p>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <section className="card">
          <h2 className="mb-3 font-semibold">Use an existing tour</h2>
          {tours.length === 0 ? (
            <p className="text-sm text-zinc-500">No tours yet — create one to get started.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {tours.map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/tours/${t.id}/setup`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-zinc-50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.artist_name}</span>
                      <span className="block text-xs text-zinc-500">
                        {t.name}
                        {platform && t.organisation_name ? ` · ${t.organisation_name}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      {t.first_date ? `${t.date_count} show(s) · ${formatShowDate(t.first_date)} – ${formatShowDate(t.last_date!)}` : "No dates yet"}
                    </span>
                    <span className="text-xs text-zinc-500">{t.activation_count} activation(s)</span>
                    <span className="text-sm font-semibold">Choose →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="card self-start">
          <h2 className="font-semibold">New tour</h2>
          <p className="mt-1 text-sm text-zinc-600">Create the tour, add its dates (import them from the tour&apos;s web page), then pick the activations.</p>
          <Link href="/admin/tours/new" className="btn mt-4">Create a tour →</Link>
        </aside>
      </div>
    </>
  );
}
