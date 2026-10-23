import { getCurrentUser, orgScope } from "@/lib/auth";
import { listChanges } from "@/lib/audit";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const rows = listChanges({
    orgId: orgScope(user),
    groupId: url.searchParams.get("group") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    limit: 100_000,
  }).map((c) => ({
    when: c.at,
    who: c.user_name ?? "",
    email: c.user_email ?? "",
    client: c.organisation_name ?? "",
    change: c.action,
    type: c.entity_type,
    what: c.entity_name ?? "",
    details: c.details ?? "",
  }));
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="change-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
