import { ActionForm } from "@/components/action-form";
import { ActivationFields } from "@/components/activation-fields";
import { createActivationAction } from "../../actions";

export const metadata = { title: "New activation · Fan Activations" };

export default function NewActivationPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">New activation</h1>
      <div className="card">
        <ActionForm action={createActivationAction} submitLabel="Create activation" className="space-y-8">
          <ActivationFields />
        </ActionForm>
      </div>
    </>
  );
}
