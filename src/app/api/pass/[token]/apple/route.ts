import { getActivation, listShows } from "@/lib/activations";
import { getPassByToken, markPassEvent } from "@/lib/fans";
import { appleWalletEnabled, buildApplePass } from "@/lib/wallet/apple";

export async function GET(_req: Request, ctx: RouteContext<"/api/pass/[token]/apple">) {
  const pass = getPassByToken((await ctx.params).token);
  if (!pass) return new Response("Not found", { status: 404 });
  if (pass.revoked_at) return new Response("This pass has been revoked", { status: 410 });
  if (!appleWalletEnabled()) return new Response("Apple Wallet is not configured yet", { status: 503 });

  const a = getActivation(pass.activation_id)!;
  const buffer = await buildApplePass(a, listShows(a.id), pass);
  markPassEvent(pass.opt_in_id, "apple");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${a.slug}.pkpass"`,
      "Cache-Control": "no-store",
    },
  });
}
