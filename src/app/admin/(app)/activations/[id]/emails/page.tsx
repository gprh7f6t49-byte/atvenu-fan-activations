import { requireActivation } from "@/lib/auth";
import { listEmails } from "@/lib/email";
import { config } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";

export default async function EmailsPage({ params }: PageProps<"/admin/activations/[id]/emails">) {
  const { id } = await params;
  await requireActivation(id);
  const emails = listEmails(id);
  return (
    <div className="space-y-4">
      {!config.smtp && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          SMTP isn&apos;t configured, so emails are saved here instead of being sent. Add SMTP settings to <code>.env.local</code> to
          deliver them.
        </p>
      )}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-4 py-3">When</th><th className="px-3 py-3">To</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {emails.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-xs text-zinc-600">{fmtDateTime(e.created_at)}</td>
                <td className="px-3 py-2">{e.to_email}</td>
                <td className="px-3 py-2">{e.subject}</td>
                <td className="px-3 py-2 text-xs" title={e.error ?? undefined}>{e.status}</td>
                <td className="px-4 py-2 text-right"><a href={`/api/admin/emails/${e.id}`} target="_blank" className="text-xs underline">View</a></td>
              </tr>
            ))}
            {emails.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No emails yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
