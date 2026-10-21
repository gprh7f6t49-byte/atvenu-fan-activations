import type { Activation, Show } from "@/lib/activations";
import { brandStyle } from "@/lib/brand";
import { backgroundTint, bannerTint, focusPosition, posterTint, type HeroLayout, type HeroOverlay } from "@/lib/hero";
import { formatShowDate } from "@/lib/wallet/content";
import { placeOf } from "@/lib/discount";
import { PoweredBy } from "./powered-by";

export type LandingLook = Pick<
  Activation,
  "artist_name" | "tour_name" | "offer_headline" | "tagline" | "description" | "primary_color" | "accent_color" | "text_color" | "hero_image_url"
> & { redeem_place?: string | null; tour_id?: string | null; hero_layout: HeroLayout; hero_focus_x: number; hero_focus_y: number; hero_overlay: HeroOverlay };

/**
 * The fan landing page layout. Used by the live page and, scaled down, by the settings preview,
 * so it sizes itself with container queries (@3xl = 768px wide) rather than the screen width.
 */
export function LandingLayout({ a, shows, form, top, fullHeight = true }: {
  a: LandingLook;
  shows: Pick<Show, "id" | "show_date" | "venue" | "city">[];
  /** The sign-up card's contents. */
  form: React.ReactNode;
  /** Shown above everything (e.g. the draft preview notice). */
  top?: React.ReactNode;
  fullHeight?: boolean;
}) {
  const img = a.hero_image_url;
  const layout = img ? a.hero_layout : null;
  const focus = { objectPosition: focusPosition(a.hero_focus_x, a.hero_focus_y) };

  return (
    <main style={brandStyle(a as Activation)} className={`@container relative flex-1 overflow-hidden bg-brand text-ink ${fullHeight ? "min-h-screen" : ""}`}>
      {/* eslint-disable @next/next/no-img-element */}
      {layout === "background" && (
        // Covers the first screen or so, then fades into the page colour: on a long phone page a
        // full-height crop would blow the image up until the focal point is lost.
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full max-h-[60rem]">
          <img src={img!} alt="" className="absolute inset-0 h-full w-full object-cover" style={focus} />
          <div className="absolute inset-0" style={{ background: backgroundTint(a.primary_color, a.hero_overlay) }} />
          <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: `linear-gradient(180deg, transparent, ${a.primary_color})` }} />
        </div>
      )}
      {layout === "poster" && (
        <>
          <img src={img!} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: posterTint(a.primary_color, a.hero_overlay) }} />
        </>
      )}
      {!layout && (
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(1200px 600px at 85% -10%, ${a.accent_color}55, transparent 60%)` }} />
      )}

      {top}

      {layout === "banner" && (
        <div className="relative z-10 aspect-[4/3] w-full @xl:aspect-[2/1] @3xl:aspect-[16/5]">
          <img src={img!} alt="" className="absolute inset-0 h-full w-full object-cover" style={focus} />
          <div aria-hidden className="absolute inset-0" style={{ background: bannerTint(a.primary_color, a.hero_overlay) }} />
        </div>
      )}

      <div className={`relative z-10 mx-auto grid max-w-6xl gap-10 px-5 @3xl:grid-cols-[1.1fr_1fr] @3xl:gap-x-16 ${layout === "banner" ? "pb-10 pt-2 @3xl:pb-20" : "py-10 @3xl:py-20"}`}>
        <section className="flex flex-col justify-end @3xl:col-start-1 @3xl:row-start-1">
          {layout === "poster" && (
            <img src={img!} alt={`${a.artist_name} artwork`}
              className="mb-8 max-h-[22rem] w-auto max-w-full self-start rounded-xl object-contain shadow-2xl ring-1 ring-white/10 @3xl:max-h-[28rem]" />
          )}
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{a.tour_name}</p>
          <h1 className="mt-3 text-6xl font-black uppercase leading-[0.9] tracking-tight @3xl:text-8xl">{a.artist_name}</h1>
          <p className="mt-6 text-3xl font-bold @3xl:text-4xl">{a.offer_headline}</p>
          {a.tagline && <p className="mt-3 text-lg opacity-80">{a.tagline}</p>}
          {a.description && <p className="mt-6 max-w-prose whitespace-pre-line opacity-70">{a.description}</p>}

          <ol className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm @sm:gap-5">
            {["Sign up", "Add Pass to Apple or Google Wallet", `Show pass at the ${placeOf(a)}`].map((step, i) => (
              <li key={step} className="flex flex-col items-center gap-2 text-center leading-snug">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-brand">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="self-center rounded-2xl bg-black/30 p-6 ring-1 ring-white/15 backdrop-blur @3xl:col-start-2 @3xl:row-span-2 @3xl:row-start-1 @3xl:p-8">
          {form}
        </section>

        {shows.length > 0 && (
          <section className="@3xl:col-start-1 @3xl:row-start-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] opacity-60">{a.tour_id ? "Tour dates" : "Dates"}</h2>
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
