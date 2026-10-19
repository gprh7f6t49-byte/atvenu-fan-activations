import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Fan Activations" };

export default function LoginPage() {
  return (
    <AuthCard title="Fan Activations">
      <LoginForm />
    </AuthCard>
  );
}
