import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { SimpleForm } from "@/components/simple-form";
import { getOrganisation } from "@/lib/orgs";
import { findPasswordToken } from "@/lib/users";
import { acceptToken } from "../../login/actions";

export const metadata = { title: "Set your password · Activations", robots: { index: false } };

export default async function AcceptPage({ params }: PageProps<"/admin/accept/[token]">) {
  const { token } = await params;
  const found = findPasswordToken(token);
  if (!found) {
    return (
      <AuthCard title="Link expired">
        <p className="text-sm text-zinc-600">This link has expired or has already been used. Ask whoever invited you for a new one.</p>
        <Link href="/admin/login" className="btn mt-6 w-full">Go to sign in</Link>
      </AuthCard>
    );
  }
  const org = found.user.organisation_id ? getOrganisation(found.user.organisation_id) : undefined;
  const invite = found.purpose === "invite";
  return (
    <AuthCard title={invite ? "Welcome to Activations" : "Choose a new password"}>
      <p className="mb-4 text-sm text-zinc-600">
        {invite ? <>You&apos;ve been invited{org ? <> to <b>{org.name}</b></> : null}. </> : null}
        Signing in as <b>{found.user.email}</b>.
      </p>
      <SimpleForm action={acceptToken.bind(null, token)} submitLabel={invite ? "Create account" : "Save password"}>
        {invite && (
          <label className="block"><span className="label">Your name</span><input name="name" defaultValue={found.user.name ?? ""} className="input" /></label>
        )}
        <label className="block"><span className="label">Password (10+ characters)</span><input name="password" type="password" autoComplete="new-password" required minLength={10} className="input" /></label>
        <label className="block"><span className="label">Confirm password</span><input name="confirm" type="password" autoComplete="new-password" required className="input" /></label>
      </SimpleForm>
    </AuthCard>
  );
}
