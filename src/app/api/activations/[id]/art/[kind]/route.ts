import { getActivation } from "@/lib/activations";
import { heroImage, iconImage, logoImage, stripImage } from "@/lib/wallet/images";

// Public: Google Wallet fetches pass artwork from these URLs.
const RENDERERS = {
  hero: heroImage,
  icon: (a: Parameters<typeof iconImage>[0]) => iconImage(a, 660),
  strip: (a: Parameters<typeof stripImage>[0]) => stripImage(a, 2),
  logo: (a: Parameters<typeof logoImage>[0]) => logoImage(a, 2),
};

export async function GET(_req: Request, ctx: RouteContext<"/api/activations/[id]/art/[kind]">) {
  const { id, kind } = await ctx.params;
  const a = getActivation(id);
  const render = RENDERERS[kind as keyof typeof RENDERERS];
  if (!a || !render) return new Response("Not found", { status: 404 });
  const png = await render(a);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
