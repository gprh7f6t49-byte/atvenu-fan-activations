import { canDelete, requireActivation } from "@/lib/auth";
import { DeleteBox } from "@/components/delete-box";
import { KIND_LABELS } from "@/lib/discount";
import { ActionForm } from "@/components/action-form";
import { ActivationFields } from "@/components/activation-fields";
import { getActivationStats, listShows } from "@/lib/activations";
import { getTour } from "@/lib/tours";
import { deleteActivationAction, updateActivationAction } from "../../../actions";

export default async function SettingsPage({ params }: PageProps<"/admin/activations/[id]/settings">) {
  const { id } = await params;
  const { user, activation: a } = await requireActivation(id);
  const s = getActivationStats(id);
  const name = KIND_LABELS[a.kind].name;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <div className="card">
          <ActionForm action={updateActivationAction.bind(null, id)} submitLabel="Save changes" className="space-y-8">
            <ActivationFields kind={a.kind} a={a} shows={listShows(id)} tour={a.tour_id ? getTour(a.tour_id) : undefined} />
          </ActionForm>
        </div>
        <DeleteBox
          title={`Delete this ${name.toLowerCase()}`}
          confirmWord={name}
          buttonLabel="Delete permanently"
          action={deleteActivationAction.bind(null, id)}
          blocked={canDelete(user, a.organisation_id) ? undefined : "Only client admins can delete activations. Ask your admin, or set it to Ended instead."}
        >
          This permanently removes {s.opt_ins.toLocaleString("en-GB")} {a.kind === "fan" ? "sign-up(s)" : "pass(es)"},{" "}
          {s.codes_total.toLocaleString("en-GB")} code(s) and {s.redemptions.toLocaleString("en-GB")} imported sale(s). Passes stop working.
          It can&apos;t be undone — to stop sign-ups but keep the results, use <b>End activation</b> instead.
          {s.codes_total > 0 && " Also remove the codes in atVenu."}
        </DeleteBox>
      </div>
      <aside className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Wallet artwork preview</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/activations/${id}/art/hero?v=${encodeURIComponent(a.updated_at)}`} alt="Google Wallet hero" className="w-full rounded-lg ring-1 ring-zinc-200" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/activations/${id}/art/strip?v=${encodeURIComponent(a.updated_at)}`} alt="Apple Wallet strip" className="w-full rounded-lg ring-1 ring-zinc-200" />
        <p className="text-xs text-zinc-500">Made from your pass image (or landing image), otherwise the brand colours. Save to refresh.</p>
      </aside>
    </div>
  );
}
