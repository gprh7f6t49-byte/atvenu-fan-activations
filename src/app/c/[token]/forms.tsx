"use client";

import { startTransition, useActionState, useState } from "react";
import type { CrewFormState } from "./actions";

type Action = (prev: CrewFormState, form: FormData) => Promise<CrewFormState>;

function useSubmit(action: Action) {
  const [state, formAction, pending] = useActionState(action, {});
  // onSubmit (not the action prop) so an error doesn't wipe what was typed.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  };
  return { state, pending, onSubmit };
}

function Messages({ state }: { state: CrewFormState }) {
  return (
    <>
      {state.resent && (
        <p role="status" className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 ring-1 ring-emerald-400/40">{state.resent}</p>
      )}
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/40">{state.error}</p>
      )}
    </>
  );
}

const button =
  "w-full rounded-full bg-accent px-6 py-4 text-base font-extrabold uppercase tracking-wide text-brand transition hover:brightness-110 disabled:opacity-60";

export function PinForm({ action }: { action: Action }) {
  const { state, pending, onSubmit } = useSubmit(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-widest opacity-70">Enter the 6-digit PIN</span>
        <input
          name="pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          className="fan-input text-center font-mono text-3xl tracking-[0.5em]"
        />
      </label>
      <Messages state={state} />
      <button className={button} disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

export function CrewSignupForm({ action, departments, askOrganisation }: { action: Action; departments: readonly string[]; askOrganisation: boolean }) {
  const { state, pending, onSubmit } = useSubmit(action);
  const [department, setDepartment] = useState("");
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><input name="firstName" autoComplete="given-name" required className="fan-input" /></Field>
        <Field label="Last name"><input name="lastName" autoComplete="family-name" required className="fan-input" /></Field>
      </div>
      <Field label="Email (your pass is sent here)">
        <input name="email" type="email" inputMode="email" autoComplete="email" required className="fan-input" />
      </Field>
      <Field label={askOrganisation ? "Role" : "Department"}>
        <select name="department" required value={department} onChange={(e) => setDepartment(e.target.value)} className="fan-input">
          <option value="" disabled>Choose…</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
      </Field>
      {department === "Other" && (
        <Field label="Which department?"><input name="departmentOther" className="fan-input" /></Field>
      )}
      {askOrganisation && (
        <Field label="Company / venue"><input name="organisation" className="fan-input" placeholder="Optional" /></Field>
      )}
      <label className="flex gap-3 text-sm leading-snug">
        <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 shrink-0 accent-accent" />
        <span>I confirm I&apos;m working on this tour. My pass is personal to me and I won&apos;t share it.</span>
      </label>
      <Messages state={state} />
      <button className={button} disabled={pending}>{pending ? "Creating your pass…" : "Get my pass"}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest opacity-70">{label}</span>
      {children}
    </label>
  );
}
