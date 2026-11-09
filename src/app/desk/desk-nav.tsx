"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/desk", label: "Queue", icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { href: "/desk/loading", label: "Van loading", icon: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.7" /><circle cx="17" cy="17.5" r="1.7" /></> },
  { href: "/desk/inactive", label: "Inactive 14d", icon: <><path d="M4.5 10v10h15V10M3 10 5 4h14l2 6z" /><path d="M9.5 20v-5h5v5" /></> },
  { href: "/desk/exports", label: "Tally export", icon: <><path d="M14 3.5H6.5v17h11V7z" /><path d="M14 3.5V7h3.5M9 12.5h6M9 16h6" /></> },
];

/** Desk navigation: a sidebar on desktop, a scrollable row on phones. */
export function DeskNav() {
  const path = usePathname();
  return (
    <nav aria-label="Order desk" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map((item) => {
        const active = item.href === "/desk" ? path === "/desk" || path.startsWith("/desk/orders") : path.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-[10px] px-3 text-sm ${active ? "bg-accent-soft font-bold text-accent-strong" : "font-medium text-ink-muted hover:bg-paper-dim"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item.icon}</svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
