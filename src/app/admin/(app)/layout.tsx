import Link from "next/link";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { logout } from "../login/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  const platform = isPlatformAdmin(user);
  const org = user.organisation_id ? getOrganisation(user.organisation_id) : undefined;
  return (
    <div className="min-h-screen flex-1 bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/admin" className="font-black tracking-tight">
            atVenu <span className="font-medium text-zinc-500">Fan Activations</span>
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-zinc-600">
            <Link href="/admin" className="hover:text-zinc-900">Activations</Link>
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
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
