import { Suspense } from "react";
import { getTranslator, pickStrings } from "@/i18n/server";
import { requirePageViewer } from "@/server/auth/viewer";
import { LocaleToggle } from "@/ui/locale-toggle";
import { LogoutButton } from "@/ui/logout-button";
import { SalesmanApp } from "./salesman-app";
import { SALESMAN_KEYS } from "./strings";

export const metadata = { title: "Salesman · Parchi Orders" };

// D108: the salesman app. This page holds no shop data itself: the client
// downloads the pack, keeps it on the phone and works from it with or
// without signal. A service worker keeps this page and its scripts available offline.
export default function SalesmanPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      <Suspense fallback={<div className="m-4 h-64 animate-pulse rounded-card bg-paper-dim" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const viewer = await requirePageViewer("SALESMAN", "/salesman");
  const { locale, t } = await getTranslator();
  return (
    <div lang={locale}>
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-line bg-paper/95 px-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{viewer.name}</p>
          <p className="text-xs text-ink-muted">{t("sm.title")}</p>
        </div>
        <LocaleToggle current={locale} label={t("locale.switchTo")} ariaLabel={t("locale.switchLabel")} />
        <LogoutButton label={t("shell.logout")} pendingLabel={t("shell.loggingOut")} />
      </header>
      <SalesmanApp userId={viewer.userId} locale={locale} s={pickStrings(t, SALESMAN_KEYS)} />
    </div>
  );
}
