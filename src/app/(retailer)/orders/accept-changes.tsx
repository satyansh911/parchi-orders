"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptChangesAction } from "@/app/actions/order-requests";

/** D32: desk changes that raised the total need the retailer's acceptance. */
export function AcceptChanges({ orderId, body, label, error }: { orderId: string; body: string; label: string; error: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <section className="flex flex-col gap-2 rounded-card bg-warn-soft p-3" role="status">
      <p className="text-sm">{body}</p>
      {failed && <p className="text-sm text-danger">{error}</p>}
      <button type="button" disabled={pending} className="min-h-12 rounded-card bg-accent font-semibold text-white disabled:opacity-60"
        onClick={() => startTransition(async () => {
          try {
            const r = await acceptChangesAction({ orderId });
            setFailed(!r.ok);
            router.refresh();
          } catch {
            setFailed(true);
          }
        })}>
        {label}
      </button>
    </section>
  );
}
