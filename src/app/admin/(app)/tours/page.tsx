import Link from "next/link";
import { listTours } from "@/lib/tours";
import { formatShowDate } from "@/lib/wallet/content";

export const metadata = { title: "Tours · Fan Activations" };

export default function ToursPage() {
  const tours = listTours();
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tours</h1>
        <Link href="/admin/tours/new" className="btn">New tour</Link>
      </div>
      {tours.length === 0 ? (
        <div className="card text-center text-zinc-600">
          No tours yet. Create a tour with its dates and cities, then attach fan, crew and comp activations to it.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Tour</th>
                <th className="px-3 py-3">Dates</th>
                <th className="px-3 py-3 text-right">Shows</th>
                <th className="px-3 py-3 text-right">Cities</th>
                <th className="px-5 py-3 text-right">Activations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tours.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/tours/${t.id}`} className="font-semibold hover:underline">{t.artist_name}</Link>
                    <div className="text-xs text-zinc-500">{t.name}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-600">
                    {t.first_date ? `${formatShowDate(t.first_date)} – ${formatShowDate(t.last_date!)}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{t.date_count}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{t.city_count}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{t.activation_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
