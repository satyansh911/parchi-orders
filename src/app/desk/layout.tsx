import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/ui/logout-button";

// Desk shell. Each page enforces the DESK role itself (D73).
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl">
      <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center gap-x-1 border-b border-line bg-paper/95 px-4 backdrop-blur">
        <p className="mr-auto font-semibold">Order desk</p>
        <Link href="/desk" className="flex min-h-11 items-center px-3 text-sm font-medium text-accent">Queue</Link>
        <Link href="/desk/loading" className="flex min-h-11 items-center px-3 text-sm font-medium text-accent">Van loading</Link>
        <Link href="/desk/inactive" className="flex min-h-11 items-center px-3 text-sm font-medium text-accent">Inactive 14d</Link>
        <Link href="/desk/exports" className="flex min-h-11 items-center px-3 text-sm font-medium text-accent">Tally export</Link>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
