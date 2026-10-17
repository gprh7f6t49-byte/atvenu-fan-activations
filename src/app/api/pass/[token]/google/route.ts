import { getActivation, listShows } from "@/lib/activations";
import { getPassByToken, markPassEvent } from "@/lib/fans";
import { buildGoogleSaveUrl, googleWalletEnabled } from "@/lib/wallet/google";

export async function GET(_req: Request, ctx: RouteContext<"/api/pass/[token]/google">) {
  const pass = getPassByToken((await ctx.params).token);
  if (!pass) return new Response("Not found", { status: 404 });
  if (!googleWalletEnabled()) return new Response("Google Wallet is not configured yet", { status: 503 });

  const a = getActivation(pass.activation_id)!;
  const url = await buildGoogleSaveUrl(a, listShows(a.id), pass);
  markPassEvent(pass.opt_in_id, "google");
  return Response.redirect(url, 302);
}
