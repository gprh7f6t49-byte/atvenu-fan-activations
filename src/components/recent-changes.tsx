import Link from "next/link";
import { listChanges, type ChangeRow } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";

const ACTION_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  deleted: "bg-red-50 text-red-700 ring-red-300",
  "went live": "bg-sky-50 text-sky-700 ring-sky-200",
};

export function ActionBadge({ action }: { action: ChangeRow["action"] }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${ACTION_STYLE[action] ?? "bg-zinc-100 text-zinc-600 ring-zinc-300"}`}>
      {action}
    </span>
  );
}

export const who = (c: Pick<ChangeRow, "user_name" | "user_email">) => c.user_name || c.user_email || "—";

/** The latest changes to one tour or event, on its overview. */
export function RecentChanges({ groupId, orgId }: { groupId: string; orgId: string | null }) {
  const rows = listChanges({ orgId, groupId, limit: 8 });
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Recent changes</h2>
        <Link href={`/admin/changes?group=${groupId}`} className="text-xs underline">Full change log</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing recorded yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-sm">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
              <ActionBadge action={c.action} />
              <span className="font-medium">{c.entity_type === "activation" ? c.entity_name?.split(" · ").at(-1) : c.entity_type}</span>
              {c.details && <span className="min-w-0 flex-1 truncate text-zinc-500" title={c.details}>{c.details}</span>}
              <span className="ml-auto whitespace-nowrap text-xs text-zinc-500">{who(c)} · {fmtDateTime(c.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
