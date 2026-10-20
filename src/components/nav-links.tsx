"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Admin menu; the current section is shown in atVenu light blue. */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const current = (href: string) =>
    href === "/admin"
      ? pathname === "/admin" || pathname.startsWith("/admin/activations")
      : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav className="font-display flex flex-wrap gap-6 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={current(l.href) ? "page" : undefined}
          className={current(l.href) ? "text-[#26c1eb]" : "text-zinc-700 hover:text-[#a2e5ff]"}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
