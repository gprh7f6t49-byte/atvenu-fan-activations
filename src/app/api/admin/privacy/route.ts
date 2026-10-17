import { isAdmin } from "@/lib/auth";
import { exportFanData } from "@/lib/fans";

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const email = new URL(req.url).searchParams.get("email") ?? "";
  const data = exportFanData(email);
  if (!data) return new Response("No fan found with that email", { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fan-data-${email.replace(/[^a-z0-9@._-]/gi, "_")}.json"`,
    },
  });
}
