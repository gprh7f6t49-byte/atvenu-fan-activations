import { ActionForm } from "@/components/action-form";
import { ActivationFields } from "@/components/activation-fields";
import { getActivation, listShows } from "@/lib/activations";
import { updateActivationAction } from "../../../actions";

export default async function SettingsPage({ params }: PageProps<"/admin/activations/[id]/settings">) {
  const { id } = await params;
  const a = getActivation(id)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="card">
        <ActionForm action={updateActivationAction.bind(null, id)} submitLabel="Save changes" className="space-y-8">
          <ActivationFields a={a} shows={listShows(id)} />
        </ActionForm>
      </div>
      <aside className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Wallet artwork preview</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/activations/${id}/art/hero?v=${encodeURIComponent(a.updated_at)}`} alt="Google Wallet hero" className="w-full rounded-lg ring-1 ring-zinc-200" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/activations/${id}/art/strip?v=${encodeURIComponent(a.updated_at)}`} alt="Apple Wallet strip" className="w-full rounded-lg ring-1 ring-zinc-200" />
        <p className="text-xs text-zinc-500">Generated from the brand colours. Save to refresh.</p>
      </aside>
    </div>
  );
}
