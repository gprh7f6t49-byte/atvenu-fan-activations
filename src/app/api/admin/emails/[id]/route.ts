import { canAccessOrg, getCurrentUser } from "@/lib/auth";
import { getEmail } from "@/lib/email";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/emails/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const email = getEmail((await ctx.params).id);
  // Account emails (no activation) are visible to atVenu admins only.
  if (!email || !canAccessOrg(user, email.organisation_id)) return new Response("Not found", { status: 404 });
  return new Response(email.html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'" },
  });
}
