"use client";

import { useState } from "react";
import { DEFAULT_PLACE, REDEEM_PLACES } from "@/lib/discount";

/** "Where is the pass used?" — a suggestion or your own words. Posts redeem_place (+ redeem_place_other). */
export function PlaceField({ value }: { value?: string | null }) {
  const current = value?.trim() || DEFAULT_PLACE;
  const preset = (REDEEM_PLACES as readonly string[]).includes(current);
  const [choice, setChoice] = useState(preset ? current : "other");
  return (
    <div className="block">
      <span className="label">Where is the pass used?</span>
      <div className="flex flex-wrap gap-2">
        <select name="redeem_place" value={choice} onChange={(e) => setChoice(e.currentTarget.value)} className="input w-auto">
          {REDEEM_PLACES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          <option value="other">Somewhere else…</option>
        </select>
        {choice === "other" && (
          <input name="redeem_place_other" defaultValue={preset ? "" : current} maxLength={40} required placeholder="e.g. box office, VIP lounge"
            className="input w-56" />
        )}
      </div>
      <span className="mt-1 block text-xs text-zinc-500">Used in the wording fans see: &ldquo;Show your pass at the {choice === "other" ? "…" : choice}&rdquo;.</span>
    </div>
  );
}
