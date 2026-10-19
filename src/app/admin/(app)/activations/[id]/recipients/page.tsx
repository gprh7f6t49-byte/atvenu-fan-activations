import { requireActivation } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { getActivationStats } from "@/lib/activations";
import { COMP_GROUPS, KIND_LABELS } from "@/lib/discount";
import { listFans } from "@/lib/fans";
import { fmtDateTime, fmtInt, fmtRevenue } from "@/lib/format";
import { bulkIssueAction, issueRecipientAction, resendPassEmailAction, setRevokedAction } from "../../../actions";

const Tick = ({ on }: { on: unknown }) =>
  on ? <span className="text-emerald-600" aria-label="yes">✓</span> : <span className="text-zinc-300" aria-label="no">–</span>;

export default async function RecipientsPage({ params, searchParams }: PageProps<"/admin/activations/[id]/recipients">) {
  const { id } = await params;
  const { activation: a } = await requireActivation(id);
  if (a.kind === "fan") redirect(`/admin/activations/${id}/fans`);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const people = listFans(id, q || undefined);
  const stats = getActivationStats(id);
  const crew = a.kind === "crew";
  const labels = KIND_LABELS[a.kind];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">Issue a pass</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600">
            Assigns the next atVenu code ({fmtInt(stats.codes_available)} left) and creates a wallet pass for this {labels.person}.
          </p>
          <ActionForm action={issueRecipientAction.bind(null, id)} submitLabel="Issue pass" pendingLabel="Issuing…" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="firstName" label="First name" required />
              <Field name="lastName" label="Last name" />
              <div className="sm:col-span-2"><Field name="email" label="Email" type="email" required /></div>
              {crew ? (
                <div className="sm:col-span-2">
                  <Field name="role" label="Department / role" placeholder="Lighting, Audio, Catering, Production…" />
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="label">Group</span>
                    <select name="group" defaultValue="Venue" className="input">
                      {COMP_GROUPS.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </label>
                  <Field name="organisation" label="Organisation" placeholder="e.g. Wembley Stadium, Ignition Management" />
                  <div className="sm:col-span-2"><Field name="role" label="Job title (optional)" placeholder="e.g. Venue Manager" /></div>
                </>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="send_email" defaultChecked /> Email the pass to them now
            </label>
          </ActionForm>
        </section>

        <section className="card">
          <h2 className="font-semibold">Bulk issue from CSV</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600">
            Upload a {crew ? "crew list" : "comp list"} with columns <code>name</code> (or first name / last name) and <code>email</code>,
            plus optional {crew ? <code>department</code> : <><code>group</code>, <code>organisation</code>, <code>role</code></>}.
            Anyone who already has a pass is skipped, so you can re-upload an updated list.
          </p>
          <ActionForm action={bulkIssueAction.bind(null, id)} submitLabel="Upload & issue" pendingLabel="Issuing…" resetOnSuccess>
            <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="send_email" defaultChecked /> Email each pass
            </label>
          </ActionForm>
          <a href={crew ? "/samples/crew-list.csv" : "/samples/comp-list.csv"} className="mt-3 inline-block text-xs text-zinc-500 underline">
            Sample {crew ? "crew" : "comp"} list CSV
          </a>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder={`Search name, email, code${crew ? ", department" : ", organisation"}`} className="input w-80" />
          <button className="btn-secondary">Search</button>
        </form>
        <span className="text-sm text-zinc-500">
          {fmtInt(people.length)} pass(es){stats.revoked ? ` · ${fmtInt(stats.revoked)} revoked` : ""}
        </span>
        <a href={`/api/admin/activations/${id}/fans`} className="btn ml-auto">Export CSV</a>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">{crew ? "Crew member" : "Recipient"}</th>
              <th className="px-3 py-3">{crew ? "Department" : "Group"}</th>
              <th className="px-3 py-3">Code</th>
              <th className="px-3 py-3">Issued</th>
              <th className="px-3 py-3 text-center">Emailed</th>
              <th className="px-3 py-3 text-center">Wallet</th>
              <th className="px-3 py-3 text-right">Orders</th>
              <th className="px-3 py-3 text-right">Spend</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {people.map((p) => (
              <tr key={p.opt_in_id} className={p.revoked_at ? "bg-zinc-50 text-zinc-400" : undefined}>
                <td className="px-4 py-2">
                  <div className="font-medium">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</div>
                  <div className="text-xs text-zinc-500">{p.email}</div>
                  {p.link_city && <div className="text-[11px] text-violet-700">Self sign-up · {p.link_city} link</div>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {crew ? (p.role ?? "—") : (
                    <>
                      <div className="font-medium">{p.recipient_group ?? "—"}</div>
                      <div className="text-zinc-500">{[p.organisation, p.role].filter(Boolean).join(" · ")}</div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {p.code}
                  {p.revoked_at && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase text-red-700">revoked</span>}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">{fmtDateTime(p.opted_in_at)}</td>
                <td className="px-3 py-2 text-center"><Tick on={p.email_sent_at} /></td>
                <td className="px-3 py-2 text-center"><Tick on={p.apple_pass_at || p.google_pass_at} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{p.orders}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.orders ? fmtRevenue(p.spend) : "—"}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-3 text-xs">
                    {!p.revoked_at && <a href={`/p/${p.pass_token}`} target="_blank" className="underline">Pass</a>}
                    {!p.revoked_at && (
                      <form action={resendPassEmailAction.bind(null, id, p.pass_token)}>
                        <button className="underline">Email</button>
                      </form>
                    )}
                    <form action={setRevokedAction.bind(null, id, p.opt_in_id, !p.revoked_at)}>
                      <button className={p.revoked_at ? "underline" : "text-red-600 underline"}>{p.revoked_at ? "Reinstate" : "Revoke"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">{q ? "No matches" : "No passes issued yet"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Revoking stops the pass page and wallet downloads working. A pass already in someone&apos;s wallet keeps its QR code, so also
        disable that code in atVenu.
      </p>
    </div>
  );
}

function Field(props: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <input name={props.name} type={props.type ?? "text"} required={props.required} placeholder={props.placeholder} className="input" />
    </label>
  );
}
