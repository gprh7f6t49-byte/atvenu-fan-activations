import { activationForApi } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { listFans } from "@/lib/fans";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/activations/[id]/fans">) {
  const a = await activationForApi((await ctx.params).id);
  if (!a) return new Response("Not found", { status: 404 });
  const fan = a.kind === "fan";
  const rows = listFans(a.id).map((f) => ({
    email: f.email,
    first_name: f.first_name ?? "",
    last_name: f.last_name ?? "",
    ...(fan
      ? { country: f.country ?? "", shows: f.shows.map((s) => `${s.show_date} ${s.venue}, ${s.city}`).join("; ") }
      : { department_or_role: f.role ?? "", group: f.recipient_group ?? "", organisation: f.organisation ?? "", revoked: f.revoked_at ? "yes" : "no" }),
    promo_code: f.code,
    code_status: f.code_status,
    [fan ? "opted_in_at" : "issued_at"]: f.opted_in_at,
    ...(fan && {
      source: f.source ?? "",
      consent_artist: f.consent_artist ? "yes" : "no",
      consent_promoter: f.consent_promoter ? "yes" : "no",
    }),
    apple_wallet: f.apple_pass_at ? "yes" : "no",
    google_wallet: f.google_pass_at ? "yes" : "no",
    orders: f.orders,
    spend: f.spend.map((s) => `${s.currency ?? ""} ${s.total.toFixed(2)}`.trim()).join("; "),
    last_purchase_at: f.last_purchase_at ?? "",
  }));
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${a.slug}-${fan ? "fans" : "recipients"}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
