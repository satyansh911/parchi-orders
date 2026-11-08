import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getTranslator, pickStrings } from "@/i18n/server";
import { otpProviderFromEnv } from "@/server/auth/otp";
import { homeFor } from "@/server/auth/redirects";
import { getViewer } from "@/server/auth/viewer";
import { LocaleToggle } from "@/ui/locale-toggle";
import { LoginForm } from "./login-form";
import { LOGIN_STRING_KEYS } from "./strings";

export const metadata = { title: "Log in · Parchi Orders" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-4 pt-10">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-card bg-paper-dim" />}>
        <LoginContent />
      </Suspense>
    </main>
  );
}

async function LoginContent() {
  await connection(); // demo banner reads the environment at request time
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer.role)); // already signed in → home
  const { locale, t } = await getTranslator();
  const demoCode = otpProviderFromEnv()?.demoCode;
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("app.name")}</h1>
        <LocaleToggle current={locale} label={t("locale.switchTo")} ariaLabel={t("locale.switchLabel")} />
      </div>
      {demoCode && (
        <p role="note" className="rounded-card border border-warn/40 bg-warn-soft p-3 text-sm">
          {t("login.demoBanner", { code: demoCode })}
        </p>
      )}
      <Suspense fallback={<p className="text-sm text-ink-muted">{t("common.loading")}</p>}>
        <LoginForm strings={pickStrings(t, LOGIN_STRING_KEYS)} />
      </Suspense>
    </div>
  );
}
