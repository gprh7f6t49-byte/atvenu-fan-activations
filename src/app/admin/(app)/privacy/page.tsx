import { ActionForm } from "@/components/action-form";
import { deleteFanAction } from "../actions";

export const metadata = { title: "Data requests · Fan Activations" };

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data requests</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Handle UK GDPR / EU GDPR subject requests for fans and crew. Requests cover the data held in your
          organisation&apos;s activations (atVenu admins: every client).
        </p>
      </div>

      <section className="card">
        <h2 className="font-semibold">Access request: export a fan&apos;s data</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-600">Downloads everything held about the fan as JSON, including consent records and purchases.</p>
        <form action="/api/admin/privacy" method="get" className="flex gap-2">
          <input name="email" type="email" required placeholder="fan@example.com" className="input" />
          <button className="btn whitespace-nowrap">Download JSON</button>
        </form>
      </section>

      <section className="card">
        <h2 className="font-semibold">Erasure request: delete a fan</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-600">
          Permanently deletes the fan, their opt-ins, consent records and emails. Their promo code is not reissued, and
          sales remain in reports as anonymous, unmatched sales. This cannot be undone.
        </p>
        <ActionForm action={deleteFanAction} submitLabel="Delete fan data">
          <input name="email" type="email" required placeholder="fan@example.com" className="input" />
          <input name="confirm" type="email" required placeholder="Type the email again to confirm" className="input" />
        </ActionForm>
      </section>
    </div>
  );
}
