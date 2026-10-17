import { notFound } from "next/navigation";
import { getActivation } from "@/lib/activations";
import { StatusBadge } from "@/components/status-badge";
import { setStatusAction } from "../../actions";
import { config } from "@/lib/config";
import { Tabs } from "./tabs";

export default async function ActivationLayout({ children, params }: LayoutProps<"/admin/activations/[id]">) {
  const { id } = await params;
  const a = getActivation(id);
  if (!a) notFound();
  const landing = `${config.baseUrl}/a/${a.slug}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{a.artist_name}</h1>
            <StatusBadge status={a.status} />
          </div>
          <p className="text-sm text-zinc-500">{a.tour_name} · {a.offer_headline}</p>
          <a href={`/a/${a.slug}`} target="_blank" className="mt-1 inline-block font-mono text-xs text-zinc-600 underline">
            {landing}
          </a>
        </div>
        <div className="flex gap-2">
          {a.status !== "live" && (
            <form action={setStatusAction.bind(null, a.id, "live")}>
              <button className="btn">Go live</button>
            </form>
          )}
          {a.status === "live" && (
            <form action={setStatusAction.bind(null, a.id, "ended")}>
              <button className="btn-secondary">End activation</button>
            </form>
          )}
        </div>
      </div>
      <Tabs id={a.id} />
      <div className="mt-6">{children}</div>
    </>
  );
}
