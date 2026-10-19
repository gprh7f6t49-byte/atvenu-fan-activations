import { requireActivation } from "@/lib/auth";
import { KindBadge, StatusBadge } from "@/components/status-badge";
import { setStatusAction } from "../../actions";
import { config } from "@/lib/config";
import { formatDiscount, KIND_LABELS } from "@/lib/discount";
import { AtvenuCodeWarning } from "@/components/atvenu-code-warning";
import { Tabs } from "./tabs";

export default async function ActivationLayout({ children, params }: LayoutProps<"/admin/activations/[id]">) {
  const { id } = await params;
  const { activation: a } = await requireActivation(id);
  const landing = `${config.baseUrl}/a/${a.slug}`;
  const discount = formatDiscount(a);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{a.artist_name}</h1>
            <KindBadge kind={a.kind} />
            <StatusBadge status={a.status} />
          </div>
          <p className="text-sm text-zinc-500">
            {KIND_LABELS[a.kind].name} · {a.tour_name} · {a.offer_headline}
            {discount && !a.offer_headline.includes(discount) ? ` (${discount})` : ""} · {a.single_use ? "one order per code" : "reusable all tour"}
          </p>
          {a.kind === "fan" && (
            <a href={`/a/${a.slug}`} target="_blank" className="mt-1 inline-block font-mono text-xs text-zinc-600 underline">
              {landing}
            </a>
          )}
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
      <AtvenuCodeWarning activationId={a.id} />
      <Tabs id={a.id} peopleLabel={KIND_LABELS[a.kind].people} peopleHref={a.kind === "fan" ? "fans" : "recipients"} signupLinks={a.kind !== "fan"} />
      <div className="mt-6">{children}</div>
    </>
  );
}
