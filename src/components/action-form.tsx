"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/admin/(app)/actions";

interface Props {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  /** Clear the fields after a successful submit (e.g. "issue another pass"). */
  resetOnSuccess?: boolean;
  children: React.ReactNode;
}

/**
 * Form wrapper that posts to a server action and shows its success/error message.
 * Submits via onSubmit rather than the action prop so React doesn't clear the
 * fields when the server returns a validation error.
 */
export function ActionForm({ action, submitLabel, pendingLabel, className, resetOnSuccess, children }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className ?? "space-y-4"}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
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
