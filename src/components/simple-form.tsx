"use client";

import { startTransition, useActionState } from "react";

type State = { ok?: string; error?: string };

/** Minimal client form for the signed-out pages (sign-in, invite, reset). */
export function SimpleForm({ action, submitLabel, children }: {
  action: (prev: State, form: FormData) => Promise<State>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Please wait…" : submitLabel}</button>
    </form>
  );
}
