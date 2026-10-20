"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { formatUkDate } from "@/lib/dates";
import { addImportedDatesAction, findTourDatesAction, type ImportState } from "../actions";

const isPast = (ukDate: string) => {
  const [d, m, y] = ukDate.split("-");
  return Boolean(y) && `${y}-${m}-${d}` < new Date().toISOString().slice(0, 10);
};

interface Row {
  key: number;
  selected: boolean;
  duplicate: boolean;
  show_date: string; // DD-MM-YYYY while editing
  venue: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

/** Find dates on a tour web page (or in pasted text), review them in a table, then add the ticked ones. */
export function TourImport({ tourId, defaultCountry, collapsed }: {
  tourId: string; defaultCountry: string;
  /** Once the tour has dates the importer folds away, but stays in place so its messages survive. */
  collapsed: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<{ error?: string; ok?: string }>({});
  const [state, findAction, finding] = useActionState(async (prev: ImportState, form: FormData) => {
    const next = await findTourDatesAction(tourId, prev, form);
    setResult({});
    setRows((next.dates ?? []).map((d, i) => ({ ...d, key: i, selected: !d.duplicate, show_date: formatUkDate(d.show_date) })));
    return next;
  }, {});
  const [adding, startAdding] = useTransition();
  const router = useRouter();

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.selected);

  return (
    <section className="card">
      <details open={!collapsed || rows.length > 0} className="group">
      <summary className="cursor-pointer list-none text-lg font-bold">
        Add tour dates
        {collapsed && <span className="ml-2 text-sm font-normal text-zinc-500 group-open:hidden">— paste more dates or a tour page link ▸</span>}
      </summary>
      <p className="mb-4 mt-1 text-sm text-zinc-600">
        Copy the dates from anywhere (a website, Google, an email, a spreadsheet) and paste them here as they are. We&apos;ll
        pick out each date, venue and city, and you can check them before they&apos;re added.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => findAction(data));
        }}
      >
        <label className="block">
          <span className="label">Paste tour dates — any format</span>
          <textarea name="text" rows={7} className="input text-sm"
            placeholder={"Fri, Apr 24, 2026: Norwich – UEA\nSat, Apr 25, 2026: Brighton – The Dome\n19-06-2027 | Croke Park | Dublin | Ireland\nSep 3, 2026: Santa Ana, CA – The Observatory"} />
        </label>
        <div className="grid gap-3 md:grid-cols-[1fr_200px]">
          <label className="block">
            <span className="label">…or a link to the tour page</span>
            <input name="url" type="text" inputMode="url" className="input" placeholder="https://artist.com/tour" />
            <span className="mt-1 block text-xs text-zinc-500">Used when the box above is empty. Some sites block this; pasting always works.</span>
          </label>
          <label className="block">
            <span className="label">Country if not shown</span>
            <select name="default_country" defaultValue={defaultCountry} className="input">
              <option value="">— leave blank</option>
              {COUNTRIES.filter(([c]) => c !== "ZZ").map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={finding}>{finding ? "Reading…" : "Find dates"}</button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        </div>
      </form>

      {rows.length > 0 && (
        <div className="mt-6">
          {state.note && <p className="mb-3 text-sm text-zinc-700">{state.note}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="w-8 py-2">
                    <input type="checkbox" aria-label="Select all" checked={selected.length === rows.length}
                      onChange={(e) => { const on = e.currentTarget.checked; setRows((rs) => rs.map((r) => ({ ...r, selected: on }))); }} />
                  </th>
                  <th className="w-32">Date</th><th>Venue</th><th>City</th><th className="w-20">Country</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.key} className={r.selected ? "" : "opacity-50"}>
                    <td className="py-1.5">
                      <input type="checkbox" aria-label={`Add ${r.city} ${r.show_date}`} checked={r.selected}
                        onChange={(e) => update(r.key, { selected: e.currentTarget.checked })} />
                    </td>
                    <td className="pr-2"><input value={r.show_date} onChange={(e) => update(r.key, { show_date: e.currentTarget.value })} className="input py-1" placeholder="DD-MM-YYYY" /></td>
                    <td className="pr-2"><input value={r.venue} onChange={(e) => update(r.key, { venue: e.currentTarget.value })} className="input py-1" /></td>
                    <td className="pr-2"><input value={r.city} onChange={(e) => update(r.key, { city: e.currentTarget.value })} className="input py-1" /></td>
                    <td className="pr-2"><input value={r.country} maxLength={2} onChange={(e) => update(r.key, { country: e.currentTarget.value.toUpperCase() })} className="input py-1 uppercase" placeholder="GB" /></td>
                    <td className="whitespace-nowrap text-xs text-zinc-500">
                      {r.duplicate ? "Already on tour" : isPast(r.show_date) ? "In the past" : r.latitude != null ? "📍" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn"
              disabled={adding || selected.length === 0}
              onClick={() =>
                startAdding(async () => {
                  const res = await addImportedDatesAction(
                    tourId,
                    selected.map(({ show_date, venue, city, country, latitude, longitude }) => ({ show_date, venue, city, country, latitude, longitude })),
                  );
                  setResult(res);
                  if (res.ok) {
                    setRows([]);
                    router.refresh();
                  }
                })
              }
            >
              {adding ? "Adding…" : `Add ${selected.length} selected date${selected.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setRows([])}>Discard</button>
            {result.error && <p className="text-sm text-red-600">{result.error}</p>}
          </div>
        </div>
      )}
      </details>
      {result.ok && rows.length === 0 && <p className="mt-3 text-sm text-emerald-700">{result.ok}</p>}
    </section>
  );
}
