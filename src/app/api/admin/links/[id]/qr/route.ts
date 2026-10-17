import QRCode from "qrcode";
import { isAdmin } from "@/lib/auth";
import { getSignupLink, signupUrl } from "@/lib/signup-links";

/** Printable QR for a city sign-up link (e.g. for the production office wall). */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/links/[id]/qr">) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const link = getSignupLink((await ctx.params).id);
  if (!link) return new Response("Not found", { status: 404 });
  const png = await QRCode.toBuffer(signupUrl(link), { width: 800, margin: 2 });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
}
