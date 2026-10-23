"use client";

import { useState } from "react";
import { defaultPlaceFor, type AppliesTo } from "@/lib/discount";

/**
 * "What does the discount cover?" — merch, food & drink, or both on one pass — plus optional
 * wording for where the pass is shown. Posts cover_merch, cover_fnb and redeem_place.
 */
export function CoverField({ appliesTo = "merch", place }: { appliesTo?: AppliesTo; place?: string | null }) {
  const [merch, setMerch] = useState(appliesTo !== "fnb");
  const [fnb, setFnb] = useState(appliesTo !== "merch");
  const current: AppliesTo = merch && fnb ? "both" : fnb ? "fnb" : "merch";
  // Saved wording that was just the old default isn't custom: let it follow the ticks.
  const custom = place && place !== defaultPlaceFor(appliesTo) ? place : "";
  return (
    <div className="space-y-3">
      <div>
        <span className="label">What does the discount cover?</span>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "cover_merch", label: "Merch", on: merch, set: setMerch },
            { name: "cover_fnb", label: "Food & drink", on: fnb, set: setFnb },
          ].map((o) => (
            <label key={o.name} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${o.on ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-300"}`}>
              <input type="checkbox" name={o.name} value="1" checked={o.on} onChange={(e) => o.set(e.currentTarget.checked)} />
              {o.label}
            </label>
          ))}
        </div>
        {!merch && !fnb && <p className="mt-1 text-xs text-red-600">Tick merch, food &amp; drink, or both.</p>}
        <p className="mt-1 text-xs text-zinc-500">Tick both to give one pass that works at the merch stand and the bars. Set the same codes up in each till system.</p>
      </div>
      <label className="block max-w-md">
        <span className="label">Where is the pass shown? (optional wording)</span>
        <input name="redeem_place" defaultValue={custom} maxLength={60} placeholder={defaultPlaceFor(current)} className="input" />
        <span className="mt-1 block text-xs text-zinc-500">Used in what fans see: &ldquo;Show your pass at the {defaultPlaceFor(current)}&rdquo;. Leave blank for that, or write your own, e.g. &ldquo;VIP Bar&rdquo;.</span>
      </label>
    </div>
  );
}
