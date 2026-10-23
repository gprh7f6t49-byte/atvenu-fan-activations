import { requireActivation } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { formatDiscount } from "@/lib/discount";
import { fmtDateTime } from "@/lib/format";
import { CAMPAIGN_TYPES } from "@/lib/campaigns";
import { activationCities, linkCity, linkState, listSignupLinks, signupUrl, type LinkState } from "@/lib/signup-links";
import { formatShowDate } from "@/lib/wallet/content";
import { createLinkAction, deleteLinkAction, newPinAction, setLinkActiveAction } from "./actions";
import { ShareButtons } from "./share-buttons";

const STATE_STYLES: Record<LinkState, string> = {
  open: "bg-emerald-50 text-emerald-700 ring-emerald-300",
  disabled: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  expired: "bg-amber-50 text-amber-700 ring-amber-300",
  full: "bg-red-50 text-red-700 ring-red-300",
};

const shortDate = (d: string) => formatShowDate(d).replace(/ \d{4}$/, "");

export default async function SignupLinksPage({ params }: PageProps<"/admin/activations/[id]/links">) {
  const { id } = await params;
  const { activation: a } = await requireActivation(id);
  if (a.kind === "fan") redirect(`/admin/activations/${id}`);
  const cities = activationCities(id);
  const unit = CAMPAIGN_TYPES[a.campaign_type].linkUnit; // "city", or "venue" for festivals
  const Unit = unit === "venue" ? "Venue" : "City";
  const whole = a.campaign_type === "tour" ? "all tour" : `the whole ${CAMPAIGN_TYPES[a.campaign_type].label.toLowerCase()}`;

  if (!cities.length) {
    return (
      <div className="card text-sm text-zinc-600">
        Sign-up links cover a {unit}&apos;s dates.{" "}
        <Link href={`/admin/activations/${id}/settings`} className="font-semibold underline">Add the dates and locations</Link> in Settings first
        {" "}(they come from the campaign).
      </div>
    );
  }

  const links = listSignupLinks(id);
  const discount = formatDiscount(a);
  const who = a.kind === "crew" ? "crew" : "comp";

  return (
    <div className="space-y-6">
      {a.status !== "live" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          This activation is <b>{a.status}</b>, so sign-up links show &ldquo;{a.status === "draft" ? "not open yet" : "closed"}&rdquo;.
          Use <b>Go live</b> (top right) before sending links out.
        </p>
      )}
      <section className="card">
        <h2 className="font-semibold">Create a {unit} sign-up link</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-600">
          Each {unit} gets its own short URL and 6-digit PIN to circulate by WhatsApp or text. People who open the link enter the PIN, fill in
          their name, email and department, and get their {who} pass straight away.
        </p>
        <ActionForm action={createLinkAction.bind(null, id)} submitLabel="Create link & PIN" pendingLabel="Creating…" resetOnSuccess>
          <div className="grid gap-4 md:grid-cols-5">
            <label className="block md:col-span-2">
              <span className="label">{Unit}</span>
              <select name="city" required defaultValue="" className="input">
                <option value="" disabled>Choose a {unit}…</option>
                {cities.map((c) => (
                  <option key={`${c.city}|${c.country}`} value={`${c.city}|${c.country}`}>
                    {c.city} ({c.country}) — {c.dates.length > 1 ? `${c.dates.length} dates, ${shortDate(c.first_date)}–${shortDate(c.last_date)}` : shortDate(c.first_date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Pass valid for</span>
              <select name="pass_scope" defaultValue="city" className="input">
                <option value="city">This {unit}&apos;s dates</option>
                <option value="tour">{whole[0].toUpperCase() + whole.slice(1)}</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Link closes</span>
              <input name="expires_at" className="input" placeholder="DD-MM-YYYY" inputMode="numeric" />
              <span className="mt-1 block text-xs text-zinc-500">Blank = day after last show</span>
            </label>
            <label className="block">
              <span className="label">Max sign-ups</span>
              <input name="max_signups" inputMode="numeric" placeholder="No limit" className="input" />
            </label>
            <label className="block md:col-span-2">
              <span className="label">Label (optional)</span>
              <input name="label" placeholder="e.g. London — local crew" className="input" />
            </label>
          </div>
        </ActionForm>
      </section>

      {links.length === 0 ? (
        <p className="text-sm text-zinc-500">No links yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {links.map((l) => {
            const city = linkCity(id, l);
            const state = linkState(l, l.signups);
            const url = signupUrl(l);
            const dates = city ? city.dates.map((d) => shortDate(d.show_date)).join(", ") : "";
            const message =
              `${a.artist_name} ${a.tour_name} — ${who} merch pass${discount ? ` (${discount})` : ""}\n` +
              `${l.label || l.city}${dates ? ` · ${dates}` : ""}\n\n` +
              `Sign up here: ${url}\nPIN: ${l.pin}`;
            return (
              <article key={l.id} className="card space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">{l.label || l.city}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ring-1 ${STATE_STYLES[state]}`}>{state}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {l.city}, {l.country}{dates ? ` · ${dates}` : ""} · pass valid {l.pass_scope === "city" ? `for this ${unit}` : whole}
                    </p>
                  </div>
                  <a href={`/api/admin/links/${l.id}/qr`} target="_blank" title="QR code for printing">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/links/${l.id}/qr`} alt={`QR code for the ${l.city} sign-up link`} width={72} height={72} className="rounded ring-1 ring-zinc-200" />
                  </a>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                  <div className="min-w-0">
                    <p className="label">Link</p>
                    <a href={url} target="_blank" className="block truncate font-mono text-sm underline">{url}</a>
                  </div>
                  <div className="text-right">
                    <p className="label">PIN</p>
                    <p className="font-mono text-2xl font-bold tracking-[0.2em]">{l.pin}</p>
                  </div>
                </div>
                <ShareButtons url={url} pin={l.pin} message={message} />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                  <span>
                    <span className="font-semibold text-zinc-900">{l.signups}</span>{l.max_signups ? ` / ${l.max_signups}` : ""} signed up
                  </span>
                  <span>Closes {fmtDateTime(l.expires_at)}</span>
                  <Link href={`/admin/activations/${id}/recipients?q=${encodeURIComponent(l.city)}`} className="underline">See sign-ups</Link>
                  <span className="ml-auto flex gap-3">
                    <form action={newPinAction.bind(null, id, l.id)}><button className="underline" title="Old PIN stops working">New PIN</button></form>
                    <form action={setLinkActiveAction.bind(null, id, l.id, !l.active)}>
                      <button className="underline">{l.active ? "Disable" : "Enable"}</button>
                    </form>
                    {l.signups === 0 && (
                      <form action={deleteLinkAction.bind(null, id, l.id)}><button className="text-red-600 underline">Delete</button></form>
                    )}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Anyone with both the link and the PIN can sign up, so post them only in the crew group. Use <b>New PIN</b> if a PIN leaks; people
        who already signed up keep their passes. A connection is blocked for 15 minutes after 10 wrong PINs.
      </p>
    </div>
  );
}
