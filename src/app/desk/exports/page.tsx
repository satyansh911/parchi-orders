import { Suspense } from "react";
import { formatPaise } from "@/i18n/format";
import { requirePageViewer } from "@/server/auth/viewer";
import { exportBatches } from "@/server/data/desk";
import { db } from "@/server/db";
import { exportPreview } from "@/server/desk/export";
import { dateTime } from "../status";
import { ExportButton } from "./export-button";

export const metadata = { title: "Tally export · Parchi Orders" };

export default function ExportsPage() {
  return (
    <main className="px-4 pb-12">
      <Suspense fallback={<div className="mt-4 h-48 animate-pulse rounded-card bg-paper-dim" />}>
        <Exports />
      </Suspense>
    </main>
  );
}

async function Exports() {
  const viewer = await requirePageViewer("DESK", "/desk/exports");
  const [preview, batches] = await Promise.all([exportPreview(db), exportBatches(db, viewer)]);
  return (
    <div className="flex flex-col gap-6 pt-4">
      <section className="flex flex-col gap-3 rounded-card border border-line p-4">
        <h1 className="text-xl font-semibold">Tally export</h1>
        <p className="text-sm text-ink-muted">Exports every approved order not yet exported as one CSV batch (sales vouchers, amounts incl. GST split into CGST/SGST). Exported orders can&apos;t be exported again.</p>
        <ExportButton orderCount={preview.orderCount} totalPaise={preview.totalPaise} totalLabel={formatPaise(preview.totalPaise)} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Past batches</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-ink-muted">No batches yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">Batch {b.number} · {b.orderCount} orders · {formatPaise(b.totalPaise)}</p>
                  <p className="text-xs text-ink-muted">{dateTime(b.createdAt)} · {b.createdBy.name}</p>
                </div>
                <a href={`/api/exports/${b.id}`} className="flex min-h-11 items-center rounded-card border border-accent px-4 text-sm font-medium text-accent">Download CSV</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
