"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { repeatOrderAction } from "@/app/actions/repeat";
import { fill } from "@/i18n/fill";
import { isLocked, mergeLines, type CartLine } from "../cart/cart-state";
import { useCart } from "../cart/use-cart";
import type { OrderAgainStrings } from "./strings";

/**
 * "Order again" (D9, D78): copies the order's lines into the cart, which then
 * re-prices them at today's price, scheme and stock. A non-empty cart asks
 * "Replace" or "Add". Unavailable items stay in, flagged by the cart.
 */
export function OrderAgainButton({ userId, orderId, s }: { userId: string; orderId: string; s: OrderAgainStrings }) {
  const router = useRouter();
  const { cart, update } = useCart(userId);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<CartLine[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function apply(lines: CartLine[], mode: "replace" | "add", unavailable: number) {
    update((c) => mergeLines(c, lines, mode));
    if (unavailable > 0) setMessage(fill(s["order.again.unavailable"], { n: unavailable }));
    router.push("/cart");
  }

  function fetchLines() {
    if (isLocked(cart)) return setMessage(s["order.again.locked"]);
    startTransition(async () => {
      const result = await repeatOrderAction({ orderId });
      if (!result.ok) return setMessage(s["common.error"]);
      const lines = result.data.map(({ skuId, paidCases }) => ({ skuId, paidCases }));
      const unavailable = result.data.filter((l) => l.flag !== null).length;
      if (cart.lines.length === 0) apply(lines, "replace", unavailable);
      else setChoice(lines);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p role="status" className="text-sm text-warn">{message}</p>}
      {choice ? (
        <div role="group" className="flex flex-col gap-2 rounded-card border border-line p-3">
          <p className="text-sm">{s["order.again.cartNotEmpty"]}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => apply(choice, "replace", 0)} className="min-h-12 flex-1 rounded-card border border-accent font-medium text-accent">{s["order.again.replace"]}</button>
            <button type="button" onClick={() => apply(choice, "add", 0)} className="min-h-12 flex-1 rounded-card bg-accent font-semibold text-white">{s["order.again.add"]}</button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={pending} onClick={fetchLines} className="min-h-14 rounded-card bg-accent px-5 text-lg font-semibold text-white disabled:opacity-60">
          {s["order.again"]}
        </button>
      )}
    </div>
  );
}
