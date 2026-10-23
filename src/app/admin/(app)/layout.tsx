import Link from "next/link";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { getOrganisation } from "@/lib/orgs";
import { appVersion, storageWarning } from "@/lib/runtime";
import { logout } from "../login/actions";
import { NavLinks } from "@/components/nav-links";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  const platform = isPlatformAdmin(user);
  const org = user.organisation_id ? getOrganisation(user.organisation_id) : undefined;
  const storage = platform ? storageWarning() : null;
  return (
    <div className="atv min-h-screen flex-1">
      <header className="bg-black">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3">
          <Link href="/admin" className="shrink-0" aria-label="atVenu Activations home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/atvenu-wordmark-white.png" alt="atVenu" className="h-6 w-auto" />
          </Link>
          <NavLinks links={[
            { href: "/admin", label: "Activations" },
            ...(platform ? [{ href: "/admin/clients", label: "Clients" }] : []),
            ...(user.role === "org_admin" ? [{ href: "/admin/team", label: "Team" }] : []),
            { href: "/admin/changes", label: "Change log" },
            { href: "/admin/privacy", label: "Data requests" },
          ]} />
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/admin/account" className="text-right leading-tight text-zinc-600 hover:text-[#a2e5ff]">
              <span className="block text-xs font-semibold">{platform ? "atVenu admin" : org?.name}</span>
              <span className="block text-xs text-zinc-500">{user.email}</span>
            </Link>
            <form action={logout}>
              <button className="btn-secondary">Sign out</button>
            </form>
          </div>
        </div>
        <div className="atv-gradient-rule" />
      </header>
      {storage && (
        <div className="bg-red-50 px-5 py-2 text-center text-sm font-semibold text-red-700">⚠ {storage}</div>
      )}
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
      <footer className="mx-auto flex max-w-6xl items-center gap-2 px-5 pb-8 text-xs text-zinc-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/atvenu-mark-white.png" alt="" className="h-3.5 w-auto opacity-60" />
        atVenu Activations · version {appVersion}
      </footer>
    </div>
  );
}
