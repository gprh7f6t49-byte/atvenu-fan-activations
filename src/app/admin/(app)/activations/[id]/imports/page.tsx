import { requireActivation } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { getActivationStats, listShows } from "@/lib/activations";
import { MAX_GENERATE, suggestPrefix } from "@/lib/codes";
import { listImports, type ImportBatch } from "@/lib/fans";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { generateCodesAction, importCodesAction, importRedemptionsAction, setBatchLoadedAction } from "../../../actions";

export default async function ImportsPage({ params, searchParams }: PageProps<"/admin/activations/[id]/imports">) {
  const { id } = await params;
  const { activation: a } = await requireActivation(id);
  const { created } = await searchParams;
  const stats = getActivationStats(id);
  const imports = listImports(id);
  const codeBatches = imports.filter((b) => b.kind === "codes");
  const salesBatches = imports.filter((b) => b.kind === "redemptions");
  const firstShow = listShows(id)[0];
  const year = firstShow ? Number(firstShow.show_date.slice(0, 4)) : new Date().getFullYear();
  const hasGenerated = codeBatches.some((b) => b.source === "generated");

  return (
    <div className="space-y-6">
      {created && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Activation created. Next step: generate promo codes here, or import codes you&apos;ve already created in atVenu.
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">1. Promo codes</h2>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{fmtInt(stats.codes_available)}</span> available of{" "}
            <span className="tabular-nums">{fmtInt(stats.codes_total)}</span>
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <h3 className="font-semibold">Generate codes</h3>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              Create unique codes here and go live straight away. Then download them for atVenu to load, so the merch stand
              accepts them.
            </p>
            <ActionForm action={generateCodesAction.bind(null, id)} submitLabel="Generate codes" pendingLabel="Generating…">
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="label">How many</span>
                  <input name="quantity" type="number" min={1} max={MAX_GENERATE} defaultValue={a.kind === "fan" ? 500 : 100} required className="input" />
                </label>
                <label className="block">
                  <span className="label">Prefix</span>
                  <input name="prefix" defaultValue={suggestPrefix(a, year)} maxLength={12} className="input uppercase" />
                </label>
                <label className="block">
                  <span className="label">Length</span>
                  <select name="length" defaultValue="6" className="input">
                    {[5, 6, 7, 8, 10, 12].map((n) => <option key={n} value={n}>{n} characters</option>)}
                  </select>
                </label>
              </div>
              <p className="text-xs text-zinc-500">
                Codes look like <code>{suggestPrefix(a, year)}-K7PX3M</code>. No 0/O or 1/I, so they&apos;re easy to read out at a
                till. Every code is unique across the platform.
              </p>
            </ActionForm>
          </div>

          <div className="card">
            <h3 className="font-semibold">Import codes from atVenu</h3>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              Already created codes in atVenu? Export them as CSV and upload. We look for a column called <code>code</code> /{" "}
              <code>promo code</code>, or use a single-column file. Duplicates are skipped.
            </p>
            <ActionForm action={importCodesAction.bind(null, id)} submitLabel="Upload codes" pendingLabel="Importing…" resetOnSuccess>
              <input type="file" name="file" accept=".csv,text/csv,text/plain" required className="block text-sm" />
            </ActionForm>
            <a href="/samples/promo-codes.csv" className="mt-3 inline-block text-xs text-zinc-500 underline">Sample codes CSV</a>
          </div>
        </div>

        {codeBatches.length > 0 && (
          <div className="card mt-6 overflow-x-auto">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Code batches</h3>
              {hasGenerated && (
                <a href={`/api/admin/activations/${id}/codes`} className="btn-secondary">Download all generated codes for atVenu</a>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="py-2">When</th><th>Batch</th><th className="text-right">Codes</th><th className="pl-6">In atVenu</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {codeBatches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 text-xs text-zinc-600">{fmtDateTime(b.created_at)}</td>
                    <td className="max-w-64 truncate text-xs">
                      {b.filename ?? "—"}
                      {b.notes && <span className="block text-zinc-500">{b.notes}</span>}
                    </td>
                    <td className="text-right tabular-nums">{fmtInt(b.rows_imported)}</td>
                    <td className="pl-6"><AtvenuStatus batch={b} /></td>
                    <td className="py-2 text-right">
                      {b.source === "generated" && (
                        <div className="flex justify-end gap-3 text-xs">
                          <a href={`/api/admin/activations/${id}/codes?batch=${b.id}`} className="underline">
                            {b.exported_at ? "Download again" : "Download for atVenu"}
                          </a>
                          <form action={setBatchLoadedAction.bind(null, id, b.id, !b.atvenu_loaded_at)}>
                            <button className="underline">{b.atvenu_loaded_at ? "Undo loaded" : "Mark loaded in atVenu"}</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasGenerated && (
              <p className="mt-3 text-xs text-zinc-500">
                The download lists each code with this activation&apos;s discount ({a.single_use ? "one use per code" : "reusable"}).
                Send it to your atVenu contact to load, then mark the batch as loaded.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">2. Sales (redemptions)</h2>
        <div className="card">
          <p className="mb-4 text-sm text-zinc-600">
            After each show, export the orders that used a promo code from atVenu. We match each sale&apos;s code to the person who
            claimed it. Recognised columns: code, order ID, total, currency, items, discount, date, venue, city.
          </p>
          <ActionForm action={importRedemptionsAction.bind(null, id)} submitLabel="Upload sales" pendingLabel="Matching…" resetOnSuccess>
            <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
          </ActionForm>
          <a href="/samples/redemptions.csv" className="mt-3 inline-block text-xs text-zinc-500 underline">Sample redemptions CSV</a>

          {salesBatches.length > 0 && (
            <table className="mt-6 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="py-2">When</th><th>File</th><th className="text-right">Rows</th><th className="text-right">Imported</th><th className="pl-4">Notes</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {salesBatches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 text-xs text-zinc-600">{fmtDateTime(b.created_at)}</td>
                    <td className="max-w-48 truncate text-xs">{b.filename ?? "—"}</td>
                    <td className="text-right tabular-nums">{fmtInt(b.rows_total)}</td>
                    <td className="text-right tabular-nums">{fmtInt(b.rows_imported)}</td>
                    <td className="pl-4 text-xs text-zinc-500">{b.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function AtvenuStatus({ batch }: { batch: ImportBatch }) {
  if (batch.source === "import") return <span className="text-xs text-zinc-500">Imported from atVenu</span>;
  if (batch.atvenu_loaded_at) {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">✓ Loaded</span>;
  }
  if (batch.exported_at) {
    return <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">Sent · awaiting atVenu</span>;
  }
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Not sent yet</span>;
}
