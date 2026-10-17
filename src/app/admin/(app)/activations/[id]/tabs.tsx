"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ id, peopleLabel, peopleHref }: { id: string; peopleLabel: string; peopleHref: string }) {
  const pathname = usePathname();
  const base = `/admin/activations/${id}`;
  const tabs = [
    { href: base, label: "Results" },
    { href: `${base}/${peopleHref}`, label: peopleLabel },
    { href: `${base}/imports`, label: "Codes & sales imports" },
    { href: `${base}/emails`, label: "Email outbox" },
    { href: `${base}/settings`, label: "Settings" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 text-sm">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 ${active ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
