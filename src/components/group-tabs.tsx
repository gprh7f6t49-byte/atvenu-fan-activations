"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface GroupTab {
  href: string;
  label: string;
  /** Status dot: live / draft / ended. */
  status?: "live" | "draft" | "ended";
  /** Matches this path and everything under it (activation tabs); otherwise exact. */
  prefix?: boolean;
  muted?: boolean;
}

const DOT = { live: "bg-emerald-600", draft: "bg-zinc-400", ended: "bg-amber-700" };

/** Tour / event tab bar: Overview, one tab per activation type, and "+ Add activation". */
export function GroupTabs({ tabs }: { tabs: GroupTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="font-display flex gap-1 overflow-x-auto border-b border-zinc-200 text-[15px]">
      {tabs.map((t) => {
        const active = t.prefix ? pathname === t.href || pathname.startsWith(`${t.href}/`) : pathname === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 ${active ? "border-[#26c1eb] font-medium text-[#26c1eb]" : `border-transparent hover:text-[#a2e5ff] ${t.muted ? "text-zinc-500" : "text-zinc-700"}`}`}>
            {t.status && <span className={`h-2 w-2 rounded-full ${DOT[t.status]}`} title={t.status} />}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
