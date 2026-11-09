"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { exportBatchAction } from "@/app/actions/desk";

/** The desk confirms the exact count and total it sees; the server refuses if the set changed (D29). */
export function ExportButton({ orderCount, totalPaise, totalLabel }: { orderCount: number; totalPaise: number; totalLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function run() {
    startTransition(async () => {
      try {
        const r = await exportBatchAction({ orderCount, totalPaise });
        if (!r.ok) return setMessage("Export failed. Nothing was marked exported; please try again.");
        if (r.data.outcome === "EXPORTED") {
          setMessage(`Batch ${r.data.number} created: ${r.data.orderCount} orders. Download it below.`);
        } else if (r.data.outcome === "CHANGED") setMessage("Orders changed since this page loaded. Check the new count and export again.");
        else setMessage("Nothing left to export.");
        router.refresh();
      } catch {
        setMessage("Export failed. Nothing was marked exported; please try again.");
      }
    });
  }
  // Stays mounted when the count drops to 0 after an export, so the result message survives the refresh.
  if (orderCount === 0) {
    return (
      <div className="flex flex-col gap-2">
        {message && <p role="status" className="text-sm text-ok">{message}</p>}
        <p className="rounded-card bg-paper-dim p-3 text-sm">No approved orders waiting for export.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg"><span className="font-semibold">{orderCount}</span> approved orders · <span className="font-semibold tabular-nums">{totalLabel}</span></p>
      {message && <p role="status" className="text-sm text-warn">{message}</p>}
      <button type="button" disabled={pending} onClick={run} className="min-h-12 self-start rounded-card bg-accent px-5 font-semibold text-paper disabled:opacity-60">
        {pending ? "Exporting…" : `Export ${orderCount} orders to CSV`}
      </button>
    </div>
  );
}
