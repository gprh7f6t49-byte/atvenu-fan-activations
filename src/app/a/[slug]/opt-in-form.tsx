"use client";

import { startTransition, useActionState } from "react";
import { COUNTRIES } from "@/lib/countries";
import type { OptInState } from "./actions";

interface Props {
  action: (prev: OptInState, form: FormData) => Promise<OptInState>;
  copy: { terms: string; artist: string; promoter: string | null };
  privacyUrl: string | null;
  source: string | null;
  /** Upcoming shows to choose from, already formatted. */
  shows: { id: string; date: string; place: string }[];
  /** "show" on a tour, "date" for a pop-up or one-off. */
  noun?: string;
}

export function OptInForm({ action, copy, privacyUrl, source, shows, noun = "show" }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    // onSubmit (not the action prop) so a validation error doesn't wipe what the fan typed.
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="source" value={source ?? ""} />
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Field label="Full name" error={fe.fullName}>
        <input name="fullName" autoComplete="name" required className="fan-input" />
      </Field>
      <Field label="Email" error={fe.email}>
        <input name="email" type="email" inputMode="email" autoComplete="email" required className="fan-input" />
      </Field>
      <Field label="Country">
        <select name="country" className="fan-input" defaultValue="GB">
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </Field>

      {shows.length > 0 && (
        <fieldset>
          <legend className="mb-1 block text-xs font-semibold uppercase tracking-widest opacity-70">
            {noun === "show" ? `Which show${shows.length > 1 ? "s are" : " is"} you going to?` : `Which ${noun}${shows.length > 1 ? "s are" : " is"} you coming?`}
          </legend>
          {shows.length > 1 && <p className="mb-2 text-xs opacity-60">Tick all that apply — your pass works at each one.</p>}
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/20 bg-white/5 p-1.5">
            {shows.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-white/10 has-[:checked]:bg-white/15">
                <input type="checkbox" name="shows" value={s.id} defaultChecked={shows.length === 1} className="h-5 w-5 shrink-0 accent-accent" />
                <span className="min-w-0">
                  <span className="block font-semibold">{s.date}</span>
                  <span className="block truncate opacity-75">{s.place}</span>
                </span>
              </label>
            ))}
          </div>
          {fe.shows && <span className="mt-1 block text-xs text-red-300">{fe.shows}</span>}
        </fieldset>
      )}

      <fieldset className="space-y-3 pt-2 text-sm">
        <Check name="terms" required error={fe.terms}>
          {copy.terms}{" "}
          {privacyUrl && (
            <a href={privacyUrl} target="_blank" rel="noreferrer" className="underline">
              Privacy notice
            </a>
          )}
        </Check>
        <p className="pt-1 text-xs uppercase tracking-widest opacity-60">Optional — you&apos;ll get your pass either way</p>
        <Check name="consent_artist">{copy.artist}</Check>
        {copy.promoter && <Check name="consent_promoter">{copy.promoter}</Check>}
      </fieldset>

      {state.resent && (
        <p role="status" className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 ring-1 ring-emerald-400/40">
          {state.resent}
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/40">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent px-6 py-4 text-base font-extrabold uppercase tracking-wide text-brand transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Getting your pass…" : "Claim my discount"}
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest opacity-70">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

function Check({ name, required, error, children }: { name: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex gap-3 leading-snug">
      <input type="checkbox" name={name} required={required} className="mt-0.5 h-5 w-5 shrink-0 accent-accent" />
      <span>
        {children}
        {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
      </span>
    </label>
  );
}
