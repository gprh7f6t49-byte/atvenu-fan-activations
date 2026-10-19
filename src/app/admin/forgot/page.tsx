import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { SimpleForm } from "@/components/simple-form";
import { forgotPassword } from "../login/actions";

export const metadata = { title: "Reset password · Fan Activations" };

export default function ForgotPage() {
  return (
    <AuthCard title="Reset your password">
      <SimpleForm action={forgotPassword} submitLabel="Send reset link">
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
      </SimpleForm>
      <p className="mt-4 text-center text-xs"><Link href="/admin/login" className="text-zinc-500 underline">Back to sign in</Link></p>
    </AuthCard>
  );
}
