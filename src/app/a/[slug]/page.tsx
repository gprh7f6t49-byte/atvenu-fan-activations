import { PoweredBy } from "@/components/powered-by";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivationBySlug, listShows } from "@/lib/activations";
import { brandStyle } from "@/lib/brand";
import { canAccessOrg, getCurrentUser } from "@/lib/auth";
import { consentCopy } from "@/lib/consent";
import { formatShowDate, upcomingShows } from "@/lib/wallet/content";
import { submitOptIn } from "./actions";
import { OptInForm } from "./opt-in-form";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const a = getActivationBySlug((await params).slug);
  if (!a || a.kind !== "fan") return {};
  return { title: `${a.artist_name} — ${a.offer_headline}`, description: a.tagline ?? a.description ?? undefined };
}

export default async function ActivationLanding({ params, searchParams }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const a = getActivationBySlug(slug);
  // Crew and comp passes are issued by the merch team; there is no public sign-up.
  if (!a || a.kind !== "fan") notFound();

  const viewer = a.status === "draft" ? await getCurrentUser() : null;
  const preview = Boolean(viewer && canAccessOrg(viewer, a.organisation_id));
  if (a.status === "draft" && !preview) notFound();

  const shows = listShows(a.id);
  const source = [sp.utm_source, sp.src].find((v): v is string => typeof v === "string") ?? null;

  return (
    <main style={brandStyle(a)} className="relative min-h-screen flex-1 overflow-hidden bg-brand text-ink">
      {a.hero_image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          <div aria-hidden className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(90deg, ${a.primary_color}f2 0%, ${a.primary_color}b3 55%, ${a.primary_color}66 100%)` }} />
        </>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(1200px 600px at 85% -10%, ${a.accent_color}55, transparent 60%)` }}
        />
      )}

      {preview && (
        <div className="relative z-10 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-black">
          Draft preview — only admins can see this page. Set the activation to Live to open sign-ups.
        </div>
      )}

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-[1.1fr_1fr] md:gap-x-16 md:py-20">
        <section className="flex flex-col justify-end md:col-start-1 md:row-start-1">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{a.tour_name}</p>
          <h1 className="mt-3 text-6xl font-black uppercase leading-[0.9] tracking-tight md:text-8xl">{a.artist_name}</h1>
          <p className="mt-6 text-3xl font-bold md:text-4xl">{a.offer_headline}</p>
          {a.tagline && <p className="mt-3 text-lg opacity-80">{a.tagline}</p>}
          {a.description && <p className="mt-6 max-w-prose whitespace-pre-line opacity-70">{a.description}</p>}

          <ol className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm sm:gap-5">
            {["Sign up", "Add Pass to Apple or Google Wallet", "Show pass at the merch stand"].map((step, i) => (
              <li key={step} className="flex flex-col items-center gap-2 text-center leading-snug">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-brand">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="self-center rounded-2xl bg-black/30 p-6 ring-1 ring-white/15 backdrop-blur md:col-start-2 md:row-span-2 md:row-start-1 md:p-8">
          {a.status === "ended" ? (
            <div className="py-10 text-center">
              <p className="text-2xl font-bold">This offer has ended</p>
              <p className="mt-2 opacity-70">Thanks to everyone who took part.</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold">Claim Fan Discount</h2>
              <p className="mb-6 mt-1 text-sm opacity-70">Your personal pass, delivered straight to your phone.</p>
              <OptInForm
                action={submitOptIn.bind(null, a.slug)}
                copy={consentCopy(a)}
                privacyUrl={a.privacy_url}
                source={source}
                shows={upcomingShows(shows).map((s) => ({ id: s.id, date: formatShowDate(s.show_date), place: `${s.venue}, ${s.city}` }))}
              />
            </>
          )}
          {a.offer_terms && <p className="mt-6 text-xs opacity-50">{a.offer_terms}</p>}
        </section>

        {shows.length > 0 && (
          <section className="md:col-start-1 md:row-start-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] opacity-60">Tour dates</h2>
            <ul className="mt-3 divide-y divide-white/10 border-y border-white/10 text-sm">
              {shows.map((s) => (
                <li key={s.id} className="flex justify-between gap-4 py-2">
                  <span className="opacity-70">{formatShowDate(s.show_date)}</span>
                  <span className="text-right">
                    {s.venue}, <span className="font-semibold">{s.city}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <PoweredBy />
    </main>
  );
}
