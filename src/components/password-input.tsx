"use client";

import { useState } from "react";

/**
 * Password box with a show / hide toggle. The icon shows the current state:
 * eye closed while the password is hidden, eye open while it's visible.
 */
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input {...props} type={visible ? "text" : "password"} className={`${props.className ?? "input"} pr-11`} autoCapitalize="none" spellCheck={false} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-zinc-500 hover:text-zinc-900"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {visible ? (
            // Open eye
            <>
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            // Closed eye (lashes down)
            <>
              <path d="M2 10c2.4 3.2 5.8 5 10 5s7.6-1.8 10-5" />
              <path d="M5 13.4 3.3 15.6M9.2 14.8 8.6 17.4M14.8 14.8l.6 2.6M19 13.4l1.7 2.2" />
            </>
          )}
        </svg>
      </button>
    </span>
  );
}
