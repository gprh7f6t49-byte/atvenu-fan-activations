import QRCode from "qrcode";
import { getPassByToken } from "@/lib/fans";

export async function GET(_req: Request, ctx: RouteContext<"/api/pass/[token]/qr">) {
  const pass = getPassByToken((await ctx.params).token);
  if (!pass) return new Response("Not found", { status: 404 });
  if (pass.revoked_at) return new Response("This pass has been revoked", { status: 410 });
  const png = await QRCode.toBuffer(pass.code, { width: 480, margin: 1, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
