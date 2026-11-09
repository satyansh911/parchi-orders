import { Suspense } from "react";
import { getTranslator, pickStrings } from "@/i18n/server";
import { requirePageViewer } from "@/server/auth/viewer";
import { CaptureForm } from "./capture-form";
import { CAPTURE_FORM_KEYS } from "./strings";

export const metadata = { title: "Order slip · Parchi Orders" };

export default function CapturePage() {
  return (
    <main className="px-4 pb-24">
      <Suspense fallback={<div className="mt-4 h-48 animate-pulse rounded-card bg-paper-dim" />}>
        <CaptureContent />
      </Suspense>
    </main>
  );
}

async function CaptureContent() {
  await requirePageViewer("RETAILER", "/capture");
  const { locale, t } = await getTranslator();
  return (
    <div lang={locale} className="flex flex-col gap-3 pt-4">
      <h1 className="text-xl font-semibold">{t("capture.title")}</h1>
      <CaptureForm s={pickStrings(t, CAPTURE_FORM_KEYS)} />
    </div>
  );
}
