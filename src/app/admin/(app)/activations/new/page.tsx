import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ActivationFields } from "@/components/activation-fields";
import type { ActivationKind } from "@/lib/activations";
import { KIND_LABELS } from "@/lib/discount";
import { getTour, listTours } from "@/lib/tours";
import { createActivationAction } from "../../actions";

export const metadata = { title: "New activation · Fan Activations" };

const KINDS: ActivationKind[] = ["fan", "crew", "comp"];

export default async function NewActivationPage({ searchParams }: PageProps<"/admin/activations/new">) {
  const sp = await searchParams;
  const kind = KINDS.find((k) => k === sp.kind);
  const tour = typeof sp.tour === "string" ? getTour(sp.tour) : undefined;
  const tourQuery = tour ? `&tour=${tour.id}` : "";

  if (!kind) {
    return (
      <>
        <h1 className="mb-2 text-2xl font-bold">New activation</h1>
        <p className="mb-6 text-sm text-zinc-600">What kind of QR passes are you issuing?</p>
        <div className="grid gap-4 md:grid-cols-3">
          {KINDS.map((k) => (
            <Link key={k} href={`/admin/activations/new?kind=${k}${tourQuery}`} className="card block transition hover:border-zinc-900 hover:shadow-md">
              <p className="text-lg font-bold">{KIND_LABELS[k].name}</p>
              <p className="mt-2 text-sm text-zinc-600">{KIND_LABELS[k].blurb}</p>
              <p className="mt-4 text-sm font-semibold">Set up →</p>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <Link href={`/admin/activations/new${tour ? `?tour=${tour.id}` : ""}`} className="text-sm text-zinc-500 hover:text-zinc-900">← Change type</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">New {KIND_LABELS[kind].name.toLowerCase()}</h1>
      <p className="mb-6 text-sm text-zinc-600">{KIND_LABELS[kind].blurb}</p>
      <div className="card">
        <ActionForm action={createActivationAction} submitLabel="Create activation" className="space-y-8">
          <ActivationFields kind={kind} tours={listTours()} tour={tour} />
        </ActionForm>
      </div>
    </>
  );
}
