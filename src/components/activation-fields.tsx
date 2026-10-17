import type { Activation, Show } from "@/lib/activations";

const showsToText = (shows: Show[]) =>
  shows
    .map((s) => [s.show_date, s.venue, s.city, s.country, s.latitude ?? "", s.longitude ?? ""].join(" | ").replace(/( \| )+$/, ""))
    .join("\n");

/** Shared fields for the create and edit activation forms. */
export function ActivationFields({ a, shows = [] }: { a?: Activation; shows?: Show[] }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-bold">Artist & offer</h2>
        <Text name="artist_name" label="Artist" defaultValue={a?.artist_name} placeholder="Oasis" required />
        <Text name="tour_name" label="Tour" defaultValue={a?.tour_name} placeholder="Live '27 European Tour" required />
        <Text name="slug" label="Landing page URL slug" defaultValue={a?.slug} placeholder="oasis-2027" required
          hint="Fans visit /a/<slug>" />
        <Text name="promoter_name" label="Promoter (for consent wording)" defaultValue={a?.promoter_name} placeholder="Optional" />
        <Text name="offer_headline" label="Offer headline" defaultValue={a?.offer_headline} placeholder="15% off tour merch" required />
        <Text name="tagline" label="Tagline" defaultValue={a?.tagline} placeholder="Skip the queue for the good stuff" />
        <Area name="description" label="Landing page description" defaultValue={a?.description} />
        <Area name="offer_terms" label="Offer terms (small print)" defaultValue={a?.offer_terms}
          placeholder="One use per fan. Valid at official merch stands on the tour. Not exchangeable for cash." />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <h2 className="md:col-span-3 text-sm font-bold">Branding</h2>
        <Color name="primary_color" label="Background" defaultValue={a?.primary_color ?? "#0B0B0C"} />
        <Color name="accent_color" label="Accent" defaultValue={a?.accent_color ?? "#E8C547"} />
        <Color name="text_color" label="Text" defaultValue={a?.text_color ?? "#FFFFFF"} />
        <div className="md:col-span-3">
          <Text name="hero_image_url" label="Hero image URL (optional)" defaultValue={a?.hero_image_url}
            placeholder="https://… (licensed artwork from the artist's team)" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <h2 className="md:col-span-3 text-sm font-bold">Compliance & lifecycle</h2>
        <Text name="privacy_url" label="Privacy notice URL" defaultValue={a?.privacy_url} placeholder="https://…" />
        <Text name="pass_expires_at" label="Pass expires" type="date" defaultValue={a?.pass_expires_at?.slice(0, 10)} />
        <label className="block">
          <span className="label">Status</span>
          <select name="status" defaultValue={a?.status ?? "draft"} className="input">
            <option value="draft">Draft (admin preview only)</option>
            <option value="live">Live (accepting sign-ups)</option>
            <option value="ended">Ended</option>
          </select>
        </label>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold">Tour dates</h2>
        <p className="mb-2 text-xs text-zinc-500">
          One per line: <code>date | venue | city | country | latitude | longitude</code>. Coordinates are optional; when set, the
          Apple Wallet pass pops up on the fan&apos;s lock screen near the venue.
        </p>
        <textarea name="shows" rows={8} defaultValue={showsToText(shows)} className="input font-mono text-xs"
          placeholder="2027-06-12 | Wembley Stadium | London | GB | 51.5560 | -0.2796" />
      </section>
    </div>
  );
}

function Text(props: { name: string; label: string; defaultValue?: string | null; placeholder?: string; required?: boolean; type?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <input name={props.name} type={props.type ?? "text"} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder}
        required={props.required} className="input" />
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
