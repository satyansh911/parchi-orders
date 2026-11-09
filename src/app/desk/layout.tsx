import { Suspense, type ReactNode } from "react";
import { LogoutButton } from "@/ui/logout-button";
import { ThemeToggle } from "@/ui/theme-toggle";
import { DeskNav } from "./desk-nav";

// Desk shell: sidebar on desktop, top bar + scrollable tabs on phones.
// Each page enforces the DESK role itself (D73).
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-paper px-3 py-3 md:h-dvh md:border-b-0 md:border-r md:py-4">
        <div className="flex items-center gap-2 px-1">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent text-white" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
          </span>
          <p className="mr-auto font-bold leading-tight">Order desk</p>
          <ThemeToggle labels={{ change: "Change theme", auto: "Auto (system)", light: "Light", dark: "Dark" }} />
          <span className="md:hidden"><LogoutButton /></span>
        </div>
        <Suspense fallback={<div className="min-h-11 md:min-h-48" />}>
          <DeskNav />
        </Suspense>
        <div className="mt-auto hidden md:block"><LogoutButton /></div>
      </aside>
      <div className="mx-auto w-full max-w-6xl md:px-4">{children}</div>
    </div>
  );
}
