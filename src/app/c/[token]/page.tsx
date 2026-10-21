import { PoweredBy } from "@/components/powered-by";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getActivation } from "@/lib/activations";
import { brandStyle } from "@/lib/brand";
import { CREW_DEPARTMENTS, formatDiscount, placeOf } from "@/lib/discount";
import { formatShowDate } from "@/lib/wallet/content";
import { accessCookieName, countSignups, getSignupLinkByToken, hasAccess, linkCity, linkState } from "@/lib/signup-links";
import { submitCrewSignup, submitPin } from "./actions";
import { CrewSignupForm, PinForm } from "./forms";

export const metadata: Metadata = { title: "Crew sign-up", robots: { index: false, follow: false } };

const COMP_ROLES = ["Venue management", "Venue operations", "Box office", "Hospitality", "Security", "Other"] as const;

export default async function CrewSignupPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const link = getSignupLinkByToken(token);
  if (!link) notFound();
  const a = getActivation(link.activation_id);
  if (!a || a.kind === "fan") notFound();

  const city = linkCity(a.id, link);
  const state = a.status === "draft" ? "not-open" : a.status === "ended" ? "closed" : linkState(link, countSignups(link.id));
  const unlocked = hasAccess(link, (await cookies()).get(accessCookieName(link))?.value);
  const discount = formatDiscount(a);
  const crew = a.kind === "crew";

  return (
    <main style={brandStyle(a)} className="min-h-screen flex-1 bg-brand px-5 py-10 text-ink">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{crew ? "Crew" : "Comp"} sign-up · {a.tour_name}</p>
        <h1 className="mt-2 text-5xl font-black uppercase leading-none tracking-tight">{a.artist_name}</h1>
        <p className="mt-4 text-2xl font-bold">{link.label || link.city}</p>
        {city && (
          <ul className="mt-2 space-y-0.5 text-sm opacity-80">
            {city.dates.map((d) => (
              <li key={d.id}>{formatShowDate(d.show_date)} · {d.venue}</li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm opacity-80">
          {crew ? "Working on the show? " : ""}Sign up for your {crew ? "crew" : "comp"} merch pass
          {discount ? ` — ${discount}` : ""} at the {placeOf(a)}
          {link.pass_scope === "city" ? `, valid for the ${link.city} ${city && city.dates.length > 1 ? "dates" : "date"}` : " for the whole tour"}.
        </p>

        <div className="mt-8 rounded-2xl bg-black/30 p-6 ring-1 ring-white/15">
          {state !== "open" ? (
            <div className="py-6 text-center">
              <p className="text-xl font-bold">
                {state === "full" ? "Sign-ups are full" : state === "not-open" ? "Sign-ups aren't open yet" : "Sign-ups have closed"}
              </p>
              <p className="mt-2 text-sm opacity-70">Speak to the merch team or your tour manager if you still need a pass.</p>
            </div>
          ) : unlocked ? (
            <CrewSignupForm
              action={submitCrewSignup.bind(null, link.token)}
              departments={crew ? CREW_DEPARTMENTS : COMP_ROLES}
              askOrganisation={!crew}
            />
          ) : (
            <PinForm action={submitPin.bind(null, link.token)} />
          )}
        </div>
        {a.offer_terms && <p className="mt-6 text-xs opacity-50">{a.offer_terms}</p>}
      </div>
      <PoweredBy className="pt-6" />
    </main>
  );
}
