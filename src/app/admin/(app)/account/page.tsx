import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { ROLE_LABELS } from "@/lib/users";
import { changePasswordAction, updateProfileAction } from "../team/actions";

export const metadata = { title: "Account · Fan Activations" };

export default async function AccountPage() {
  const me = await requireUser();
  const org = me.organisation_id ? getOrganisation(me.organisation_id) : undefined;
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your account</h1>
        <p className="mt-1 text-sm text-zinc-600">{me.email} · {ROLE_LABELS[me.role]}{org ? ` · ${org.name}` : ""}</p>
      </div>
      <section className="card">
        <h2 className="mb-3 font-semibold">Name</h2>
        <ActionForm action={updateProfileAction} submitLabel="Save">
          <input name="name" defaultValue={me.name ?? ""} className="input" />
        </ActionForm>
      </section>
      <section className="card">
        <h2 className="mb-3 font-semibold">Change password</h2>
        <ActionForm action={changePasswordAction} submitLabel="Change password">
          <label className="block"><span className="label">Current password</span><input name="current" type="password" autoComplete="current-password" required className="input" /></label>
          <label className="block"><span className="label">New password (10+ characters)</span><input name="password" type="password" autoComplete="new-password" required minLength={10} className="input" /></label>
          <label className="block"><span className="label">Confirm new password</span><input name="confirm" type="password" autoComplete="new-password" required className="input" /></label>
          <p className="text-xs text-zinc-500">You&apos;ll be signed out everywhere and asked to sign in again.</p>
        </ActionForm>
      </section>
    </div>
  );
}
