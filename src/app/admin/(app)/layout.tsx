import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../login/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="min-h-screen flex-1 bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <Link href="/admin" className="font-black tracking-tight">
            atVenu <span className="font-medium text-zinc-500">Fan Activations</span>
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600">
            <Link href="/admin" className="hover:text-zinc-900">Activations</Link>
            <Link href="/admin/tours" className="hover:text-zinc-900">Tours</Link>
            <Link href="/admin/privacy" className="hover:text-zinc-900">Data requests</Link>
          </nav>
          <form action={logout} className="ml-auto">
            <button className="text-sm text-zinc-500 hover:text-zinc-900">Sign out</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
