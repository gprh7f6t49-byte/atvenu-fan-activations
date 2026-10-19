import Link from "next/link";
import type { Activation, ActivationKind, Show } from "@/lib/activations";
import type { Organisation } from "@/lib/orgs";
import type { Tour } from "@/lib/tours";
import { formatUkDate } from "@/lib/dates";
import { ImageField } from "./image-field";

const showsToText = (shows: Show[]) =>
  shows
    .map((s) => [formatUkDate(s.show_date), s.venue, s.city, s.country, s.latitude ?? "", s.longitude ?? ""].join(" | ").replace(/( \| )+$/, ""))
    .join("\n");

const DEFAULTS: Record<ActivationKind, { discount: number; singleUse: boolean; terms: string }> = {
  fan: { discount: 15, singleUse: true, terms: "One use per fan. Valid at official merch stands on the tour. Not exchangeable for cash." },
  crew: { discount: 25, singleUse: false, terms: "Crew discount for touring personnel only. Personal to the named holder — not transferable." },
  comp: { discount: 100, singleUse: true, terms: "Comp issued by the merch team. Personal to the named holder — not transferable or exchangeable for cash." },
};

/**
 * Shared fields for the create and edit activation forms. Fan-only fields are hidden for crew / comps.
 * When a tour is chosen, artist, tour name and dates come from the tour instead of being typed here.
 */
export function ActivationFields({ kind, a, shows = [], tours = [], tour, organisations }: {
  kind: ActivationKind; a?: Activation; shows?: Show[]; tours?: Tour[]; tour?: Tour;
  /** Only passed to atVenu admins creating an activation: choose the client. */
  organisations?: Organisation[];
}) {
  const fan = kind === "fan";
  const d = DEFAULTS[kind];
  return (
    <div className="space-y-8">
      <input type="hidden" name="kind" value={kind} />
      {organisations && (tour ? (
        <input type="hidden" name="organisation_id" value={tour.organisation_id ?? ""} />
      ) : (
        <label className="block max-w-md">
          <span className="label">Client</span>
          <select name="organisation_id" required defaultValue="" className="input">
            <option value="" disabled>Choose a client…</option>
            {organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      ))}

      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-bold">Artist & tour</h2>
        {tours.length > 0 && (
          <label className="block md:col-span-2">
            <span className="label">Tour</span>
            <select name="tour_id" defaultValue={tour?.id ?? ""} className="input">
              {!tour && <option value="">— Not linked to a tour (enter artist, tour and dates below)</option>}
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.artist_name} — {t.name}{organisations && "organisation_name" in t ? ` (${(t as Tour & { organisation_name: string | null }).organisation_name})` : ""}
                </option>
              ))}
            </select>
            {tour ? (
              <span className="mt-1 block text-xs text-zinc-500">
                Artist, tour name, dates and cities come from the tour. <Link href={`/admin/tours/${tour.id}`} className="underline">Edit tour dates</Link>
              </span>
            ) : (
              <span className="mt-1 block text-xs text-zinc-500">Pick a tour to use its dates and cities (needed for city sign-up links).</span>
            )}
          </label>
        )}
        {!tour && (
          <>
            <Text name="artist_name" label="Artist" defaultValue={a?.artist_name} placeholder="Oasis" />
            <Text name="tour_name" label="Tour" defaultValue={a?.tour_name} placeholder="Live '27 European Tour" />
          </>
        )}
        {fan ? (
          <>
            <Text name="slug" label="Landing page URL slug" defaultValue={a?.slug} placeholder="oasis-2027" required hint="Fans visit /a/<slug>" />
            <Text name="promoter_name" label="Promoter (for consent wording)" defaultValue={a?.promoter_name} placeholder="Optional" />
          </>
        ) : (
          <input type="hidden" name="slug" value={a?.slug ?? ""} />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <h2 className="md:col-span-4 text-sm font-bold">Discount</h2>
        <label className="block">
          <span className="label">Discount type</span>
          <select name="discount_type" defaultValue={a?.discount_type ?? "percent"} className="input">
            <option value="percent">Percentage off</option>
            <option value="amount">Fixed amount off</option>
          </select>
        </label>
        <Text name="discount_value" label="Discount" type="number" step="0.01" min="0.01" required
          defaultValue={a?.discount_value != null ? String(a.discount_value) : String(d.discount)}
          hint="e.g. 25 for 25%, or 40 for £40 off" />
        <label className="block">
          <span className="label">Currency (fixed amount)</span>
          <select name="discount_currency" defaultValue={a?.discount_currency ?? ""} className="input">
            <option value="">— not needed for %</option>
            <option value="GBP">GBP £</option>
            <option value="EUR">EUR €</option>
            <option value="USD">USD $</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Code use</span>
          <select name="single_use" defaultValue={String(a?.single_use ?? (d.singleUse ? 1 : 0))} className="input">
            <option value="1">One order per code</option>
            <option value="0">Reusable all tour</option>
          </select>
        </label>
        <p className="md:col-span-4 -mt-2 text-xs text-zinc-500">
          Set the same discount on the promo codes in atVenu. atVenu applies the discount at the till; this setting controls what
          the pass shows and how discount value is estimated in reports.
        </p>
        <div className="md:col-span-2">
          <Text name="offer_headline" label="Headline on pass" defaultValue={a?.offer_headline}
            placeholder={fan ? "Leave blank for e.g. “15% off tour merch”" : "Leave blank for e.g. “25% off merch”"} />
        </div>
        <div className="md:col-span-2">
          <Area name="offer_terms" label="Terms (small print)" defaultValue={a ? a.offer_terms : d.terms} />
        </div>
      </section>

      {fan && (
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-sm font-bold">Landing page</h2>
          <Text name="tagline" label="Tagline" defaultValue={a?.tagline} placeholder="Skip the queue for the good stuff" />
          <Text name="privacy_url" label="Privacy notice URL" defaultValue={a?.privacy_url} placeholder="https://…" />
          <Area name="description" label="Description" defaultValue={a?.description} />
          <div className="md:col-span-2 max-w-xl">
            <ImageField name="hero_image" label="Landing page image (optional)" current={a?.hero_image_url} aspect="aspect-[16/7]"
              hint="Shown behind the sign-up page, and on the pass if you don't add a pass image. JPG, PNG or WebP up to 10 MB, ideally 2000px wide. Use artwork the artist's team has cleared." />
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <h2 className="md:col-span-3 text-sm font-bold">Pass branding</h2>
        <Color name="primary_color" label="Background" defaultValue={a?.primary_color ?? "#0B0B0C"} />
        <Color name="accent_color" label="Accent" defaultValue={a?.accent_color ?? "#E8C547"} />
        <Color name="text_color" label="Text" defaultValue={a?.text_color ?? "#FFFFFF"} />
        <div className="md:col-span-3 max-w-xl">
          <ImageField name="pass_image" label="Pass image (optional)" current={a?.pass_image_url} aspect="aspect-[375/123]"
            hint={fan
              ? "The banner across the wallet pass and pass page. Wide images work best (about 3:1); the middle is used. Leave empty to use the landing page image, or the brand colours."
              : "The banner across the wallet pass and pass page. Wide images work best (about 3:1); the middle is used. Leave empty to use the brand colours."} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <h2 className="md:col-span-3 text-sm font-bold">Lifecycle</h2>
        <Text name="pass_expires_at" label="Pass expires (DD-MM-YYYY)" defaultValue={formatUkDate(a?.pass_expires_at)} placeholder="e.g. 30-09-2027"
          hint="Optional. The pass stops working after this day." />
        <label className="block">
          <span className="label">Status</span>
          <select name="status" defaultValue={a?.status ?? "draft"} className="input">
            <option value="draft">Draft</option>
            <option value="live">{fan ? "Live (accepting sign-ups)" : "Live"}</option>
            <option value="ended">Ended</option>
          </select>
        </label>
      </section>

      {!tour && (
      <section>
        <h2 className="mb-2 text-sm font-bold">Tour dates</h2>
        <p className="mb-2 text-xs text-zinc-500">
          One per line: <code>DD-MM-YYYY | venue | city | country | latitude | longitude</code>. Coordinates are optional; when set, the
          Apple Wallet pass pops up on the lock screen near the venue.
        </p>
        <textarea name="shows" rows={8} defaultValue={showsToText(shows)} className="input font-mono text-xs"
          placeholder="12-06-2027 | Wembley Stadium | London | GB | 51.5560 | -0.2796" />
      </section>
      )}
    </div>
  );
}


function Text(props: {
  name: string; label: string; defaultValue?: string | null; placeholder?: string; required?: boolean;
  type?: string; hint?: string; step?: string; min?: string;
}) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <input name={props.name} type={props.type ?? "text"} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder}
        required={props.required} step={props.step} min={props.min} className="input" />
      {props.hint && <span className="mt-1 block text-xs text-zinc-500">{props.hint}</span>}
    </label>
  );
}

function Area(props: { name: string; label: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <textarea name={props.name} rows={3} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder} className="input" />
    </label>
  );
}

function Color(props: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <input type="color" name={props.name} defaultValue={props.defaultValue.toLowerCase()}
        className="h-10 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" />
    </label>
  );
}
