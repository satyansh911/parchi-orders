"use client";

import { fill } from "@/i18n/fill";
import { Stepper } from "@/ui/stepper";
import { addCase, casesFor, removeCase } from "./cart-state";
import type { StepperStrings } from "./strings";
import { useCart } from "./use-cart";

/** Catalogue row control: tap Add, then +/− cases (writes the device cart). */
export function CatalogueStepper({ userId, skuId, name, disabled, s }: { userId: string; skuId: string; name: string; disabled: boolean; s: StepperStrings }) {
  const { cart, update } = useCart(userId);
  return (
    <Stepper
      value={casesFor(cart, skuId)}
      disabled={disabled}
      onIncrease={() => update((c) => addCase(c, skuId))}
      onDecrease={() => update((c) => removeCase(c, skuId))}
      addLabel={s["cart.add"]}
      increaseLabel={fill(s["cart.increase"], { name })}
      decreaseLabel={fill(s["cart.decrease"], { name })}
      quantityLabel={fill(s["cart.quantity"], { name })}
    />
  );
}

/** Item count on the Cart tab. */
export function CartBadge({ userId, label }: { userId: string; label: string }) {
  const { cart } = useCart(userId);
  const n = cart.lines.length;
  if (n === 0) return null;
  return (
    <span key={n} className="anim-bump absolute -top-1 left-[calc(50%+6px)] box-content min-w-5 rounded-full border-2 border-paper bg-accent px-1 text-center text-xs font-bold leading-5 text-white" aria-label={fill(label, { n })}>
      {n}
    </span>
  );
}
