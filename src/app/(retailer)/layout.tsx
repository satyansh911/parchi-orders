import { Suspense, type ReactNode } from "react";
import { getTranslator, pickStrings } from "@/i18n/server";
import { getRetailerAccount } from "@/server/data/retailers";
import { db } from "@/server/db";
import { getViewer } from "@/server/auth/viewer";
import { BottomNav } from "@/ui/bottom-nav";
import { CartIcon, GridIcon, ListIcon } from "@/ui/icons";
import { LocaleToggle } from "@/ui/locale-toggle";
import { LogoutButton } from "@/ui/logout-button";

// Retailer app shell: slim header + bottom navigation (D81). Everything that
// reads the session streams behind <Suspense>; nothing private is in the
// static shell (D73). Each page still enforces its own role check.
export default function RetailerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-20">
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-line bg-paper/95 px-4 backdrop-blur">
        <Suspense fallback={<div className="h-5 w-40 animate-pulse rounded bg-paper-dim" />}>
          <HeaderContent />
        </Suspense>
      </header>
      {children}
      <Suspense fallback={null}>
        <RetailerNav />
      </Suspense>
    </div>
  );
}

async function HeaderContent() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "RETAILER") return null; // the page shows login / not-found
  const [{ locale, t }, account] = await Promise.all([getTranslator(), getRetailerAccount(db, viewer)]);
  return (
    <>
      <p className="min-w-0 flex-1 truncate font-semibold" lang={locale}>{account.shopName}</p>
      <LocaleToggle current={locale} label={t("locale.switchTo")} ariaLabel={t("locale.switchLabel")} />
      <LogoutButton label={t("shell.logout")} pendingLabel={t("shell.loggingOut")} />
    </>
  );
}

async function RetailerNav() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "RETAILER") return null;
  const { t } = await getTranslator();
  const s = pickStrings(t, ["nav.catalogue", "nav.orders", "nav.cart", "nav.main"] as const);
  return (
    <BottomNav
      ariaLabel={s["nav.main"]}
      items={[
        { href: "/catalogue", label: s["nav.catalogue"], icon: <GridIcon /> },
        { href: "/orders", label: s["nav.orders"], icon: <ListIcon /> },
        { href: "/cart", label: s["nav.cart"], icon: <CartIcon /> },
      ]}
    />
  );
}
