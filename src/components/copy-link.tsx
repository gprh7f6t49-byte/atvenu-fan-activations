"use client";

import { useState } from "react";

/** A link shown in a read-only box with a copy button (invite and reset links). */
export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex w-full items-center gap-2">
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input font-mono text-xs" />
      <button
        type="button"
        className="btn-secondary whitespace-nowrap"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt("Copy this link:", link);
          }
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
