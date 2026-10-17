import { isAdmin } from "@/lib/auth";
import { getEmailHtml } from "@/lib/email";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/emails/[id]">) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const html = getEmailHtml((await ctx.params).id);
  if (!html) return new Response("Not found", { status: 404 });
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'" },
  });
}
