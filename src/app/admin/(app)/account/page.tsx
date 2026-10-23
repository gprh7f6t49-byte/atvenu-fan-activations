import { PasswordInput } from "@/components/password-input";
import { ActionForm } from "@/components/action-form";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { config, emailProvider } from "@/lib/config";
import { getOrganisation } from "@/lib/orgs";
import { ROLE_LABELS } from "@/lib/users";
import { changePasswordAction, sendTestEmailAction, updateProfileAction } from "../team/actions";

export const metadata = { title: "Account · Activations" };

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
      {isPlatformAdmin(me) && (
        <section className="card">
          <h2 className="mb-1 font-semibold">Email delivery</h2>
          <p className="mb-4 text-sm text-zinc-600">
            {emailProvider() ? (
              <>Connected via <b className="capitalize">{emailProvider()}</b>, sending from <code>{config.emailFrom}</code>.</>
            ) : (
              <>Not connected. Emails are only saved to each activation&apos;s outbox. Add <code>POSTMARK_SERVER_TOKEN</code> or{" "}
              <code>RESEND_API_KEY</code>, plus <code>EMAIL_FROM</code>, in Railway.</>
            )}
          </p>
          <ActionForm action={sendTestEmailAction} submitLabel="Send test email to me" pendingLabel="Sending…">
            <span />
          </ActionForm>
        </section>
      )}
      <section className="card">
        <h2 className="mb-3 font-semibold">Change password</h2>
        <ActionForm action={changePasswordAction} submitLabel="Change password">
          <label className="block"><span className="label">Current password</span><PasswordInput name="current" autoComplete="current-password" required className="input" /></label>
          <label className="block"><span className="label">New password (10+ characters)</span><PasswordInput name="password" autoComplete="new-password" required minLength={10} className="input" /></label>
          <label className="block"><span className="label">Confirm new password</span><PasswordInput name="confirm" autoComplete="new-password" required className="input" /></label>
          <p className="text-xs text-zinc-500">You&apos;ll be signed out everywhere and asked to sign in again.</p>
        </ActionForm>
      </section>
    </div>
  );
}
