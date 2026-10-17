import { ActionForm } from "@/components/action-form";
import { getActivationStats } from "@/lib/activations";
import { listImports } from "@/lib/fans";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { importCodesAction, importRedemptionsAction } from "../../../actions";

export default async function ImportsPage({ params, searchParams }: PageProps<"/admin/activations/[id]/imports">) {
  const { id } = await params;
  const { created } = await searchParams;
  const stats = getActivationStats(id);
  const imports = listImports(id);

  return (
    <div className="space-y-6">
      {created && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Activation created. Next step: import the unique promo codes you generated in atVenu.
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">1. Import promo codes</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600">
            Export the unique codes from atVenu as CSV. We look for a column called <code>code</code> / <code>promo code</code>, or
            use a single-column file. Duplicates are skipped, so re-uploading is safe.
          </p>
          <p className="mb-4 text-sm">
            <span className="font-semibold tabular-nums">{fmtInt(stats.codes_available)}</span> available of{" "}
            <span className="tabular-nums">{fmtInt(stats.codes_total)}</span> loaded
          </p>
          <ActionForm action={importCodesAction.bind(null, id)} submitLabel="Upload codes" pendingLabel="Importing…">
            <input type="file" name="file" accept=".csv,text/csv,text/plain" required className="block text-sm" />
          </ActionForm>
          <a href="/samples/promo-codes.csv" className="mt-3 inline-block text-xs text-zinc-500 underline">Sample codes CSV</a>
        </section>

        <section className="card">
          <h2 className="font-semibold">2. Import redemptions (sales)</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600">
            After each show, export the orders that used a promo code from atVenu. We match each sale&apos;s code to the fan who
            claimed it. Recognised columns: code, order ID, total, currency, items, date, venue, city.
          </p>
          <ActionForm action={importRedemptionsAction.bind(null, id)} submitLabel="Upload sales" pendingLabel="Matching…">
            <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
          </ActionForm>
          <a href="/samples/redemptions.csv" className="mt-3 inline-block text-xs text-zinc-500 underline">Sample redemptions CSV</a>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Import history</h2>
        {imports.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing imported yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="py-2">When</th><th>Type</th><th>File</th><th className="text-right">Rows</th><th className="text-right">Imported</th><th className="pl-4">Notes</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {imports.map((b) => (
                <tr key={b.id}>
                  <td className="py-2 text-xs text-zinc-600">{fmtDateTime(b.created_at)}</td>
                  <td className="capitalize">{b.kind}</td>
                  <td className="max-w-48 truncate text-xs">{b.filename ?? "—"}</td>
                  <td className="text-right tabular-nums">{fmtInt(b.rows_total)}</td>
                  <td className="text-right tabular-nums">{fmtInt(b.rows_imported)}</td>
                  <td className="pl-4 text-xs text-zinc-500">{b.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
