"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideOrderAction, editOrderLineAction } from "@/app/actions/desk";

const MESSAGES: Record<string, string> = {
  CONFLICT: "This order changed since you opened it. The page has been refreshed.",
  AWAITING_RETAILER: "The retailer must accept the changes first.",
  STOCK_SHORT: "Not enough stock for that quantity (including free goods).",
  NOT_ALLOWED: "Not allowed for this order any more. Refresh the page.",
};

function useDeskAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: true; data: { outcome: string; overByPaise?: number } } | { ok: false; error: string }>) =>
    startTransition(async () => {
      try {
        const r = await fn();
        if (!r.ok) setMessage(MESSAGES[r.error] ?? "Something went wrong.");
        else if (r.data.outcome === "MOVED_TO_CREDIT_HOLD") setMessage("Over the credit limit now: moved to Credit hold.");
        else if (r.data.outcome !== "DONE") setMessage(MESSAGES[r.data.outcome] ?? r.data.outcome);
        else setMessage(null);
        router.refresh();
      } catch {
        setMessage("Network problem. Please try again.");
      }
    });
  return { pending, message, run };
}

export function DecisionPanel({ orderId, version, status, awaitingRetailerAck }: { orderId: string; version: number; status: string; awaitingRetailerAck: boolean }) {
  const { pending, message, run } = useDeskAction();
  const [reason, setReason] = useState("");
  const open = ["PENDING_REVIEW", "CREDIT_HOLD", "REVIEW_REQUIRED"].includes(status);
  if (!open && status !== "APPROVED") return null;
  const decide = (decision: "APPROVE" | "REJECT" | "CANCEL_APPROVED") => run(() => decideOrderAction({ orderId, version, decision, ...(reason.trim() ? { reason } : {}) }));
  const reasonOk = reason.trim().length >= 3;
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line p-3">
      <h2 className="font-semibold">Decision</h2>
      {message && <p role="status" className="text-sm text-warn">{message}</p>}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">Reason (needed to reject or cancel)</span>
        <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className="min-h-11 rounded-card border border-line px-3" />
      </label>
      <div className="flex flex-wrap gap-2">
        {open && (
          <button type="button" disabled={pending || awaitingRetailerAck} onClick={() => decide("APPROVE")} className="min-h-12 rounded-card bg-accent px-5 font-semibold text-paper disabled:opacity-50">
            {status === "CREDIT_HOLD" ? "Release hold and approve" : "Approve"}
          </button>
        )}
        {open && <button type="button" disabled={pending || !reasonOk} onClick={() => decide("REJECT")} className="min-h-12 rounded-card border border-danger px-5 font-medium text-danger disabled:opacity-50">Reject</button>}
        {status === "APPROVED" && <button type="button" disabled={pending || !reasonOk} onClick={() => decide("CANCEL_APPROVED")} className="min-h-12 rounded-card border border-danger px-5 font-medium text-danger disabled:opacity-50">Cancel order (restore stock)</button>}
      </div>
    </section>
  );
}

export function LineEditor({ orderId, version, lineId, paidCases, canRemove }: { orderId: string; version: number; lineId: string; paidCases: number; canRemove: boolean }) {
  const { pending, message, run } = useDeskAction();
  const [value, setValue] = useState(String(paidCases));
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= 999 && n !== paidCases;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor={`cases-${lineId}`}>Paid cases</label>
        <input id={`cases-${lineId}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 3))} className="min-h-11 w-16 rounded-card border border-line px-2 text-right tabular-nums" />
        <button type="button" disabled={pending || !valid} onClick={() => run(() => editOrderLineAction({ orderId, version, lineId, paidCases: n }))} className="min-h-11 rounded-card border border-accent px-3 text-sm text-accent disabled:opacity-40">Save</button>
        {canRemove && <button type="button" disabled={pending} onClick={() => run(() => editOrderLineAction({ orderId, version, lineId, paidCases: 0 }))} className="min-h-11 px-2 text-sm text-danger">Remove</button>}
      </div>
      {message && <p role="status" className="text-xs text-warn">{message}</p>}
    </div>
  );
}
