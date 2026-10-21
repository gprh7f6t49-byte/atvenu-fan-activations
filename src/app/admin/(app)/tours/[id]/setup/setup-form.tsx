"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { ImageField } from "@/components/image-field";
import { HeroImageEditor } from "@/components/hero-image-editor";
import { HERO_DEFAULTS } from "@/lib/hero";
import type { ActivationKind } from "@/lib/activations";
import { KIND_DEFAULTS, KIND_LABELS } from "@/lib/discount";
import type { FormState } from "../../../actions";

const KINDS: ActivationKind[] = ["fan", "crew", "comp"];

/** Pick the activation types for a tour and set each one's discount, all in one form. */
export function SetupForm({ action, existing, slug, artist, tourName, shows }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  /** Types already set up on this tour, with a link to each. */
  existing: Partial<Record<ActivationKind, string>>;
  slug: string;
  artist: string;
  tourName: string;
  shows: { id: string; show_date: string; venue: string; city: string }[];
}) {
  const available = KINDS.filter((k) => !existing[k]);
  const [picked, setPicked] = useState<ActivationKind[]>(available);
  const toggle = (k: ActivationKind, on: boolean) => setPicked((p) => (on ? [...p, k] : p.filter((x) => x !== k)));
  const fan = picked.includes("fan");

  return (
    <ActionForm action={action} submitLabel={`Create ${picked.length || ""} activation${picked.length === 1 ? "" : "s"}`} pendingLabel="Creating…" className="space-y-8">
      <section>
        <h2 className="mb-1 text-lg font-bold">1. Which activations does this tour need?</h2>
        <p className="mb-4 text-sm text-zinc-600">They all use this tour&apos;s dates and cities, so you only enter them once.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {KINDS.map((k) => {
            const d = KIND_DEFAULTS[k];
            const on = picked.includes(k);
            if (existing[k]) {
              return (
                <div key={k} className="card bg-zinc-50">
                  <p className="font-bold">{KIND_LABELS[k].name}</p>
                  <p className="mt-2 text-sm text-zinc-600">Already set up on this tour.</p>
                  <a href={existing[k]} className="mt-3 inline-block text-sm font-semibold underline">Open it →</a>
                </div>
              );
            }
            return (
              <div key={k} className={`card transition ${on ? "border-zinc-900 ring-1 ring-zinc-900" : "opacity-70"}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="kinds" value={k} checked={on} onChange={(e) => toggle(k, e.currentTarget.checked)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="block font-bold">{KIND_LABELS[k].name}</span>
                    <span className="mt-1 block text-xs text-zinc-600">{KIND_LABELS[k].blurb}</span>
                  </span>
                </label>
                {on && (
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
                    <label className="block">
                      <span className="label">Discount</span>
                      <select name={`${k}_discount_type`} defaultValue="percent" className="input">
                        <option value="percent">% off</option>
                        <option value="amount">Amount off</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">Value</span>
                      <input name={`${k}_discount_value`} type="number" step="0.01" min="0.01" defaultValue={d.discount} required className="input" />
                    </label>
                    <label className="block">
                      <span className="label">Currency (amount off)</span>
                      <select name={`${k}_discount_currency`} defaultValue="" className="input">
                        <option value="">— not needed for %</option>
                        <option value="GBP">GBP £</option>
                        <option value="EUR">EUR €</option>
                        <option value="USD">USD $</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">Code use</span>
                      <select name={`${k}_single_use`} defaultValue={d.singleUse ? "1" : "0"} className="input">
                        <option value="1">One order</option>
                        <option value="0">Reusable all tour</option>
                      </select>
                    </label>
                    <label className="col-span-2 block">
                      <span className="label">Generate codes now</span>
                      <input name={`${k}_codes`} type="number" min={0} defaultValue={d.codes} className="input" />
                      <span className="mt-1 block text-xs text-zinc-500">0 = none yet (import codes from atVenu later).</span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {fan && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">2. Fan landing page</h2>
          <label className="block max-w-xl">
            <span className="label">Landing page URL</span>
            <div className="flex items-center gap-1 text-sm text-zinc-500">
              <span>/a/</span>
              <input name="slug" defaultValue={slug} required className="input" />
            </div>
          </label>
          <HeroImageEditor
            initial={{ layout: HERO_DEFAULTS.hero_layout, x: 50, y: 50, overlay: HERO_DEFAULTS.hero_overlay }}
            text={{
              artist_name: artist, tour_name: tourName, offer_headline: `${KIND_DEFAULTS.fan.discount}% off tour merch`,
              tagline: null, description: null, primary_color: "#0B0B0C", accent_color: "#E8C547", text_color: "#FFFFFF",
            }}
            shows={shows}
          />
          <p className="text-xs text-zinc-500">You can add the tagline, description and privacy link later in Settings.</p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold">{fan ? "3" : "2"}. Pass look</h2>
        <p className="-mt-2 text-sm text-zinc-600">Shared by every activation you create here; each can be changed later.</p>
        <div className="grid max-w-xl grid-cols-3 gap-4">
          <Color name="primary_color" label="Background" value="#0B0B0C" />
          <Color name="accent_color" label="Accent" value="#E8C547" />
          <Color name="text_color" label="Text" value="#FFFFFF" />
        </div>
        <div className="max-w-xl">
          <ImageField name="pass_image" label="Pass image (optional)" aspect="aspect-[375/123]"
            hint="The banner across the wallet pass. Wide images work best (about 3:1)." />
        </div>
        <label className="block max-w-xs">
          <span className="label">Start as</span>
          <select name="status" defaultValue="draft" className="input">
            <option value="draft">Draft — check it over first</option>
            <option value="live">Live straight away</option>
          </select>
        </label>
      </section>
    </ActionForm>
  );
}

function Color({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type="color" name={name} defaultValue={value.toLowerCase()} className="h-10 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" />
    </label>
  );
}
