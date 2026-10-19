import { readUploadFile } from "@/lib/uploads";

// Public: landing pages, pass pages, emails and Google Wallet load uploaded artwork from here.
export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[file]">) {
  const { file } = await ctx.params;
  const upload = readUploadFile(file);
  if (!upload) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(upload.data), {
    headers: {
      "Content-Type": upload.type,
      // File names are random and never reused, so they can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
