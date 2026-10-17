"use client";

import { useState } from "react";

/** Copy / WhatsApp / SMS buttons for a city sign-up link. */
export function ShareButtons({ url, pin, message }: { url: string; pin: string; message: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this:", text);
    }
  };
  const btn = "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
        className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-95">WhatsApp</a>
      <a href={`sms:?&body=${encodeURIComponent(message)}`} className={btn}>Text message</a>
      <button type="button" onClick={() => copy("message", message)} className={btn}>{copied === "message" ? "Copied ✓" : "Copy message"}</button>
      <button type="button" onClick={() => copy("link", url)} className={btn}>{copied === "link" ? "Copied ✓" : "Copy link"}</button>
      <button type="button" onClick={() => copy("pin", pin)} className={btn}>{copied === "pin" ? "Copied ✓" : "Copy PIN"}</button>
    </div>
  );
}
