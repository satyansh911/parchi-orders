import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslator, pickStrings } from "@/i18n/server";
import { AccessError } from "@/server/auth/access-error";
import { requirePageViewer } from "@/server/auth/viewer";
import { getCapture } from "@/server/data/captures";
import { db } from "@/server/db";
import { CAPTURE_REVIEW_KEYS } from "../strings";
import { ReviewView, type ReviewLine, type ReviewSku } from "./review-view";

export const metadata = { title: "Check order · Parchi Orders" };

export default function CaptureReviewPage({ params }: PageProps<"/capture/[id]">) {
  return (
    <main className="px-4 pb-40">
      <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-card bg-paper-dim" />}>
        <ReviewContent params={params} />
      </Suspense>
    </main>
  );
}

async function ReviewContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePageViewer("RETAILER", `/capture/${id}`);
  let capture;
  try {
    capture = await getCapture(db, viewer, id); // another retailer's capture is NOT_FOUND (D62)
  } catch (error) {
    if (error instanceof AccessError) notFound();
    throw error;
  }
  const { locale, t } = await getTranslator();
  const s = pickStrings(t, CAPTURE_REVIEW_KEYS);

  if (capture.status === "FAILED" || capture.status === "DISCARDED") {
    return (
      <div lang={locale} className="flex flex-col gap-4 pt-6" role="alert">
        <h1 className="text-xl font-semibold">{s["capture.failed.title"]}</h1>
        <p className="text-ink-muted">{s["capture.failed.body"]}</p>
        <blockquote className="rounded-card bg-paper-dim p-3 text-sm whitespace-pre-wrap">{capture.rawText}</blockquote>
        <Link href="/capture" className="flex min-h-14 items-center justify-center rounded-card bg-accent text-lg font-semibold text-paper">{s["capture.retry"]}</Link>
        <Link href="/catalogue" className="flex min-h-12 items-center justify-center rounded-card border border-accent font-medium text-accent">{s["capture.manual"]}</Link>
      </div>
    );
  }

  const skus = await db.sku.findMany({
    where: { active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { nameEn: "asc" }],
    select: { id: true, code: true, nameEn: true, nameHi: true, packSize: true, piecesPerCase: true, stockCases: true, reservedCases: true },
  });
  const options: ReviewSku[] = skus.map((k) => ({
    id: k.id,
    name: `${locale === "hi" ? k.nameHi : k.nameEn} · ${k.packSize}`,
    piecesPerCase: k.piecesPerCase,
    inStock: k.stockCases - k.reservedCases > 0,
  }));
  const lines: ReviewLine[] = capture.lines
    .filter((l) => !l.flags.includes("MANUAL"))
    .map((l) => ({
      id: l.id,
      raw: l.raw,
      confidence: l.confidence,
      flags: l.flags,
      suggestedSkuId: l.suggestedSkuId,
      suggestedCases: l.suggestedCases,
      alternativeSkuIds: l.alternativeSkuIds,
    }));

  return (
    <div lang={locale} className="flex flex-col gap-4 pt-4">
      <h1 className="text-xl font-semibold">{t("capture.review.title")}</h1>
      <section className="rounded-card bg-paper-dim p-3">
        <h2 className="text-xs font-medium text-ink-muted">
          {capture.inputType === "PHOTO" ? s["capture.review.photo"] : capture.inputType === "VOICE" ? s["capture.review.voice"] : s["capture.review.original"]}
        </h2>
        <p className="mt-1 whitespace-pre-wrap">{capture.rawText}</p>
      </section>
      <ReviewView userId={viewer.userId} captureId={capture.id} lines={lines} skus={options} s={s} />
    </div>
  );
}
