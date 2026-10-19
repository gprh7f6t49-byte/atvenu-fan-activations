"use client";

import { startTransition, useActionState } from "react";
import type { FormState } from "@/app/admin/(app)/actions";
import { CopyLink } from "./copy-link";

/** A small button that runs an action returning a link (e.g. "Reset link") and shows it to copy. */
export function LinkButton({ action, label }: { action: (prev: FormState) => Promise<FormState>; label: string }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <div className="space-y-2">
      <button type="button" className="text-xs underline" disabled={pending} onClick={() => startTransition(() => run())}>
        {pending ? "…" : label}
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.link && (
        <div className="w-80 text-left">
          <p className="mb-1 text-xs text-zinc-500">{state.ok}</p>
          <CopyLink link={state.link} />
        </div>
      )}
    </div>
  );
}
