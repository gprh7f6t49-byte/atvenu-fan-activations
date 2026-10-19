import { activationForApi } from "@/lib/auth";
import { codesForAtvenu, markBatchesExported } from "@/lib/codes";
import { toCsv } from "@/lib/csv";

/** CSV of generated codes to send to atVenu for loading (one batch, or all generated batches). */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/activations/[id]/codes">) {
  const a = await activationForApi((await ctx.params).id);
  if (!a) return new Response("Not found", { status: 404 });
  const batch = new URL(req.url).searchParams.get("batch");
  const { rows, batchIds } = codesForAtvenu(a, batch);
  if (rows.length === 0) return new Response("No generated codes to download", { status: 404 });
  markBatchesExported(batchIds);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${a.slug}-codes-for-atvenu-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
