import { getActivation } from "@/lib/activations";
import { isAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { listFans } from "@/lib/fans";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/activations/[id]/fans">) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const a = getActivation((await ctx.params).id);
  if (!a) return new Response("Not found", { status: 404 });
  const rows = listFans(a.id).map((f) => ({
    email: f.email,
    first_name: f.first_name ?? "",
    last_name: f.last_name ?? "",
    country: f.country ?? "",
    promo_code: f.code,
    code_status: f.code_status,
    opted_in_at: f.opted_in_at,
    source: f.source ?? "",
    consent_artist: f.consent_artist ? "yes" : "no",
    consent_promoter: f.consent_promoter ? "yes" : "no",
    consent_atvenu: f.consent_atvenu ? "yes" : "no",
    apple_wallet: f.apple_pass_at ? "yes" : "no",
    google_wallet: f.google_pass_at ? "yes" : "no",
    orders: f.orders,
    spend: f.spend,
    currency: f.currency ?? "",
    last_purchase_at: f.last_purchase_at ?? "",
  }));
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${a.slug}-fans-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
