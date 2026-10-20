"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ id, peopleLabel, peopleHref, signupLinks }: { id: string; peopleLabel: string; peopleHref: string; signupLinks: boolean }) {
  const pathname = usePathname();
  const base = `/admin/activations/${id}`;
  const tabs = [
    { href: base, label: "Results" },
    { href: `${base}/${peopleHref}`, label: peopleLabel },
    ...(signupLinks ? [{ href: `${base}/links`, label: "City sign-up links" }] : []),
    { href: `${base}/imports`, label: "Codes & sales" },
    { href: `${base}/emails`, label: "Email outbox" },
    { href: `${base}/settings`, label: "Settings" },
  ];
  return (
    <nav className="font-display flex gap-1 overflow-x-auto border-b border-zinc-200 text-sm">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 ${active ? "border-[#26c1eb] font-medium text-[#26c1eb]" : "border-transparent text-zinc-500 hover:text-[#a2e5ff]"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
