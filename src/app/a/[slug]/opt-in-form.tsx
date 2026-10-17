"use client";

import { startTransition, useActionState } from "react";
import { COUNTRIES } from "@/lib/countries";
import type { OptInState } from "./actions";

interface Props {
  action: (prev: OptInState, form: FormData) => Promise<OptInState>;
  copy: { terms: string; artist: string; promoter: string | null; atvenu: string };
  privacyUrl: string | null;
  source: string | null;
}

export function OptInForm({ action, copy, privacyUrl, source }: Props) {
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={fe.firstName}>
          <input name="firstName" autoComplete="given-name" required className="fan-input" />
        </Field>
        <Field label="Last name">
          <input name="lastName" autoComplete="family-name" placeholder="Optional" className="fan-input" />
        </Field>
      </div>
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

      <fieldset className="space-y-3 pt-2 text-sm">
        <Check name="terms" required error={fe.terms}>
          {copy.terms}{" "}
          {privacyUrl && (
            <a href={privacyUrl} target="_blank" rel="noreferrer" className="underline">
              Privacy notice
            </a>
          )}
        </Check>
        <p className="pt-1 text-xs uppercase tracking-widest opacity-60">Optional — you&apos;ll get your code either way</p>
        <Check name="consent_artist">{copy.artist}</Check>
        {copy.promoter && <Check name="consent_promoter">{copy.promoter}</Check>}
        <Check name="consent_atvenu">{copy.atvenu}</Check>
      </fieldset>

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
        {pending ? "Getting your code…" : "Get my code"}
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
