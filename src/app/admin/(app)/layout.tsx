import Link from "next/link";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { appVersion, storageWarning } from "@/lib/runtime";
import { logout } from "../login/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  const platform = isPlatformAdmin(user);
  const org = user.organisation_id ? getOrganisation(user.organisation_id) : undefined;
  const storage = platform ? storageWarning() : null;
  return (
    <div className="min-h-screen flex-1 bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <span className="font-black tracking-tight">atVenu</span>
          <nav className="flex flex-wrap gap-4 text-sm text-zinc-600">
            <Link href="/admin" className="hover:text-zinc-900">Fan Activations</Link>
            <Link href="/admin/tours" className="hover:text-zinc-900">Tours</Link>
            {platform && <Link href="/admin/clients" className="hover:text-zinc-900">Clients</Link>}
            {user.role === "org_admin" && <Link href="/admin/team" className="hover:text-zinc-900">Team</Link>}
            <Link href="/admin/privacy" className="hover:text-zinc-900">Data requests</Link>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/admin/account" className="text-right leading-tight text-zinc-600 hover:text-zinc-900">
              <span className="block text-xs font-semibold">{platform ? "atVenu admin" : org?.name}</span>
              <span className="block text-xs text-zinc-500">{user.email}</span>
            </Link>
            <form action={logout}>
              <button className="text-zinc-500 hover:text-zinc-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      {storage && (
        <div className="bg-red-600 px-5 py-2 text-center text-sm font-semibold text-white">⚠ {storage}</div>
      )}
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
      <footer className="mx-auto max-w-6xl px-5 pb-8 text-xs text-zinc-400">Fan Activations · version {appVersion}</footer>
    </div>
  );
}
