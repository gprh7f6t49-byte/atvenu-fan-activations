import { config } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Fan Activations" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen flex-1 place-items-center bg-zinc-100 px-4">
      <div className="card w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">atVenu</p>
        <h1 className="mb-6 text-xl font-bold">Fan Activations</h1>
        {config.adminPassword ? (
          <LoginForm />
        ) : (
          <p className="text-sm text-zinc-600">
            Set <code className="rounded bg-zinc-100 px-1">ADMIN_PASSWORD</code> in <code className="rounded bg-zinc-100 px-1">.env.local</code> and
            restart the server to enable the admin.
          </p>
        )}
      </div>
    </main>
  );
}
