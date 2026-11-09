"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; badge?: ReactNode };

/** Four large tabs in thumb reach (D81); the active one sits in a soft pill. */
export function BottomNav({ items, ariaLabel }: { items: NavItem[]; ariaLabel: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={ariaLabel} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper px-1 pb-[calc(env(safe-area-inset-bottom)+4px)] pt-1">
      <ul className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-bold text-accent-strong" : "font-medium text-ink-faint"}`}
              >
                <span className={`relative grid h-[30px] w-14 place-items-center rounded-full transition-colors ${active ? "bg-accent-soft" : ""}`} aria-hidden="true">
                  {item.icon}
                  {item.badge}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
