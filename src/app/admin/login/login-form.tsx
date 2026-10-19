"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="text" inputMode="email" autoComplete="username" autoFocus required className="input" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs">
        <Link href="/admin/forgot" className="text-zinc-500 underline">Forgotten your password?</Link>
      </p>
    </form>
  );
}
