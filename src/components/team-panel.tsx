import { ActionForm } from "@/components/action-form";
import { LinkButton } from "@/components/link-button";
import { fmtDateTime } from "@/lib/format";
import { hasPendingInvite, listUsers, ROLE_LABELS, type PublicUser } from "@/lib/users";
import { inviteUserAction, passwordLinkAction, setUserDisabledAction, setUserRoleAction } from "@/app/admin/(app)/team/actions";

/** Users of one client (orgId) or the atVenu admins (orgId null), with invite and management controls. */
export function TeamPanel({ orgId, me }: { orgId: string | null; me: PublicUser }) {
  const users = listUsers(orgId);
  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="font-semibold">{orgId ? "Invite a teammate" : "Invite an atVenu admin"}</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-600">
          {orgId
            ? "They get an email link to choose a password. Client admins can also invite and manage teammates; members manage activations only."
            : "atVenu admins can see and manage every client."}
        </p>
        <ActionForm action={inviteUserAction.bind(null, orgId)} submitLabel="Send invite" pendingLabel="Inviting…" resetOnSuccess>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
            <label className="block"><span className="label">Name</span><input name="name" className="input" placeholder="Optional" /></label>
            {orgId ? (
              <label className="block">
                <span className="label">Role</span>
                <select name="role" defaultValue="org_member" className="input">
                  <option value="org_member">Member: manages activations</option>
                  <option value="org_admin">Admin: also manages the team</option>
                </select>
              </label>
            ) : (
              <input type="hidden" name="role" value="platform_admin" />
            )}
          </div>
        </ActionForm>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-4 py-3">Person</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Last sign-in</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((u) => {
              const pending = hasPendingInvite(u.id);
              const self = u.id === me.id;
              return (
                <tr key={u.id} className={u.disabled ? "text-zinc-400" : undefined}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{u.name ?? "—"}{self && <span className="ml-2 text-xs text-zinc-400">(you)</span>}</div>
                    <div className="text-xs text-zinc-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{ROLE_LABELS[u.role]}</td>
                  <td className="px-3 py-2 text-xs">{u.disabled ? "Disabled" : pending && !u.last_login_at ? "Invited" : "Active"}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{fmtDateTime(u.last_login_at)}</td>
                  <td className="px-4 py-2">
                    {!self && (
                      <div className="flex flex-wrap items-start justify-end gap-3 text-xs">
                        {!u.disabled && <LinkButton action={passwordLinkAction.bind(null, u.id)} label={u.last_login_at ? "Reset link" : "Invite link"} />}
                        {orgId && !u.disabled && (
                          <form action={setUserRoleAction.bind(null, u.id, u.role === "org_admin" ? "org_member" : "org_admin")}>
                            <button className="underline">{u.role === "org_admin" ? "Make member" : "Make admin"}</button>
                          </form>
                        )}
                        <form action={setUserDisabledAction.bind(null, u.id, !u.disabled)}>
                          <button className={u.disabled ? "underline" : "text-red-600 underline"}>{u.disabled ? "Re-enable" : "Disable"}</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
