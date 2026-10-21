import Link from "next/link";
import { DateRows } from "@/components/date-rows";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { listOrganisations } from "@/lib/orgs";
import { SetupForm } from "../../../tours/[id]/setup/setup-form";
import { createStandaloneAction } from "../../../tours/actions";

export const metadata = { title: "New standalone activation · Activations" };

/** Activations without a tour: a one-off show or two, a pop-up shop, food & drink. */
export default async function StandaloneActivationPage() {
  const user = await requireUser();
  const organisations = isPlatformAdmin(user) ? listOrganisations() : null;
  return (
    <>
      <Link href="/admin/activations/new" className="text-sm text-zinc-500 hover:text-zinc-900">← New activation</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Standalone activation</h1>
      <p className="mb-6 text-sm text-zinc-600">For a one-off show or two, a pop-up shop, food &amp; drink — anything that isn&apos;t a tour.</p>
      <div className="card">
        <SetupForm
          action={createStandaloneAction}
          existing={{}}
          slug=""
          artist="Your event"
          tourName=""
          shows={[]}
          details={
            <>
              {organisations && (
                <label className="block max-w-md">
                  <span className="label">Client</span>
                  <select name="organisation_id" required defaultValue="" className="input">
                    <option value="" disabled>Choose a client…</option>
                    {organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
              )}
              <div className="grid max-w-3xl gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="label">Artist, brand or venue</span>
                  <input name="artist_name" required className="input" placeholder="e.g. Oasis, or The Jazz Café" />
                </label>
                <label className="block">
                  <span className="label">Event or campaign</span>
                  <input name="tour_name" required className="input" placeholder="e.g. Summer Pop-up 2027" />
                </label>
              </div>
              <div>
                <span className="label">Dates &amp; locations</span>
                <DateRows />
              </div>
            </>
          }
        />
      </div>
    </>
  );
}
