"use client";

import { useState } from "react";

/** Dates and locations for a standalone activation. Posts d_date / d_venue / d_city / d_country per row. */
export function DateRows() {
  const [rows, setRows] = useState([0]);
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[140px_1fr_1fr_80px_32px] gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
        <span>Date</span><span>Venue or location</span><span>City</span><span>Country</span><span />
      </div>
      {rows.map((key, i) => (
        <div key={key} className="grid grid-cols-2 gap-2 md:grid-cols-[140px_1fr_1fr_80px_32px]">
          <input name="d_date" placeholder="DD-MM-YYYY" inputMode="numeric" aria-label={`Date ${i + 1}`} className="input" />
          <input name="d_venue" placeholder="e.g. The Roundhouse, or Covent Garden pop-up" aria-label={`Venue ${i + 1}`} className="input" />
          <input name="d_city" placeholder="City" aria-label={`City ${i + 1}`} className="input" />
          <input name="d_country" placeholder="GB" maxLength={2} defaultValue="GB" aria-label={`Country ${i + 1}`} className="input uppercase" />
          <button type="button" aria-label="Remove this date" disabled={rows.length === 1}
            onClick={() => setRows((r) => r.filter((k) => k !== key))} className="text-zinc-500 hover:text-red-600 disabled:opacity-30">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((r) => [...r, Math.max(...r) + 1])} className="btn-secondary">+ Add another date</button>
      <p className="text-xs text-zinc-500">
        Optional. Add each day the pass can be used (a pop-up running three days = three dates). Fans pick which date they&apos;re coming
        to, and crew / comp sign-up links are made per city. Leave blank for an ongoing offer.
      </p>
    </div>
  );
}
