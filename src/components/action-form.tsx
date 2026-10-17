"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/admin/(app)/actions";

interface Props {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  children: React.ReactNode;
}

/** Form wrapper that posts to a server action and shows its success/error message. */
export function ActionForm({ action, submitLabel, pendingLabel, className, children }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? (pendingLabel ?? "Working…") : submitLabel}
        </button>
        {state.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
