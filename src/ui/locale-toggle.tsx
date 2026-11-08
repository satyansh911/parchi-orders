"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale";
import type { Locale } from "@/i18n/messages";

/** One tap switches हिंदी ↔ English (D72). The label is in the language you switch TO. */
export function LocaleToggle({ current, label, ariaLabel }: { current: Locale; label: string; ariaLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = current === "hi" ? "en" : "hi";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={pending}
      lang={next}
      onClick={() =>
        startTransition(async () => {
          await setLocaleAction({ locale: next });
          router.refresh();
        })
      }
      className="min-h-11 min-w-11 rounded-full border border-line px-3 text-sm font-medium text-ink disabled:opacity-60"
    >
      {label}
    </button>
  );
}
