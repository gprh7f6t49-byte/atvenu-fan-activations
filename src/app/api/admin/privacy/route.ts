import { getCurrentUser, orgScope } from "@/lib/auth";
import { exportFanData } from "@/lib/fans";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const email = new URL(req.url).searchParams.get("email") ?? "";
  // Clients only get what their own activations hold about the person.
  const data = exportFanData(email, orgScope(user));
  if (!data) return new Response("No fan found with that email", { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fan-data-${email.replace(/[^a-z0-9@._-]/gi, "_")}.json"`,
    },
  });
}
