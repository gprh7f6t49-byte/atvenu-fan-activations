"use client";

import { startTransition, useActionState } from "react";
import type { FormState } from "@/app/admin/(app)/actions";

/** Danger-zone delete: type the given word to confirm. When `blocked` is set, explains why it can't be deleted yet. */
export function DeleteBox({ action, title, confirmWord, children, blocked, buttonLabel }: {
  action?: (prev: FormState, form: FormData) => Promise<FormState>;
  title: string;
  confirmWord: string;
  children: React.ReactNode;
  blocked?: React.ReactNode;
  buttonLabel: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action ?? (async () => ({})), {});
  return (
    <section className="card border-red-300">
      <h2 className="font-semibold text-red-700">{title}</h2>
      <div className="mt-1 text-sm text-zinc-600">{children}</div>
      {blocked ? (
        <p className="mt-3 text-sm text-zinc-600">{blocked}</p>
      ) : (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => run(data));
          }}
        >
          <label className="block min-w-64 flex-1">
            <span className="label">Type &ldquo;{confirmWord}&rdquo; to confirm</span>
            <input name="confirm" autoComplete="off" required className="input" />
          </label>
          <button disabled={pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
            {pending ? "Deleting…" : buttonLabel}
          </button>
          {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
