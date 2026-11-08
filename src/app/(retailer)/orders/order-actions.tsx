"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNoteAction, cancelOrderAction, requestCancellationAction } from "@/app/actions/order-requests";
import type { OrderActionStrings } from "./strings";

type Status = "PENDING_REVIEW" | "CREDIT_HOLD" | "REVIEW_REQUIRED" | string;

/**
 * Retailer actions on their own open order (D23, D77):
 *  - PENDING_REVIEW: cancel (with an inline confirmation);
 *  - CREDIT_HOLD / REVIEW_REQUIRED: ask the office to cancel, or send a note.
 * The server re-checks ownership and status for every action.
 */
export function OrderActions({ orderId, status, cancelRequested, s }: { orderId: string; status: Status; cancelRequested: boolean; s: OrderActionStrings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<"request" | "note" | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onDone: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return setMessage(result.error === "NOT_ALLOWED" ? s["order.notAllowed"] : s["common.error"]);
      onDone();
      router.refresh();
    });

  if (status === "PENDING_REVIEW") {
    return confirming ? (
      <div role="alertdialog" aria-describedby="cancel-q" className="flex flex-col gap-3 rounded-card border-2 border-danger/50 bg-danger-soft p-3">
        <p id="cancel-q" className="text-sm font-medium">{s["order.cancel.confirm"]}</p>
        {message && <p role="alert" className="text-sm text-danger">{message}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} className="min-h-12 flex-1 rounded-card border border-line bg-paper font-medium">{s["order.cancel.no"]}</button>
          <button type="button" disabled={pending} onClick={() => run(() => cancelOrderAction({ orderId }), () => setConfirming(false))} className="min-h-12 flex-1 rounded-card bg-danger font-semibold text-paper disabled:opacity-60">{s["order.cancel.yes"]}</button>
        </div>
      </div>
    ) : (
      <button type="button" onClick={() => setConfirming(true)} className="min-h-12 rounded-card border border-danger/60 font-medium text-danger">{s["order.cancel"]}</button>
    );
  }

  if (status !== "CREDIT_HOLD" && status !== "REVIEW_REQUIRED") return null;

  return (
    <div className="flex flex-col gap-2">
      {message && <p role="status" className="text-sm text-ink-muted">{message}</p>}
      {mode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const note = text.trim();
            if (mode === "note" && !note) return;
            run(
              () => (mode === "request" ? requestCancellationAction({ orderId, ...(note ? { note } : {}) }) : addNoteAction({ orderId, note })),
              () => {
                setMode(null);
                setText("");
                if (mode === "note") setMessage(s["order.noteSent"]);
              },
            );
          }}
          className="flex flex-col gap-2 rounded-card border border-line p-3"
        >
          <label htmlFor="desk-note" className="text-sm font-medium">{mode === "request" ? s["order.noteLabel"] : s["order.noteRequiredLabel"]}</label>
          <textarea id="desk-note" maxLength={300} rows={3} value={text} onChange={(e) => setText(e.target.value)} required={mode === "note"} className="rounded-card border border-line p-2 text-base" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(null)} className="min-h-12 flex-1 rounded-card border border-line font-medium">{s["order.cancel.no"]}</button>
            <button type="submit" disabled={pending} className="min-h-12 flex-1 rounded-card bg-accent font-semibold text-paper disabled:opacity-60">{s["order.send"]}</button>
          </div>
        </form>
      ) : (
        <>
          {!cancelRequested && (
            <button type="button" onClick={() => setMode("request")} className="min-h-12 rounded-card border border-danger/60 font-medium text-danger">{s["order.requestCancel"]}</button>
          )}
          <button type="button" onClick={() => setMode("note")} className="min-h-12 rounded-card border border-line font-medium">{s["order.sendNote"]}</button>
        </>
      )}
    </div>
  );
}
