// Credit (A.6, D20, D21, D33, D79).
// available = limit − outstanding − open orders, where open orders are this
// retailer's PENDING_REVIEW, CREDIT_HOLD, REVIEW_REQUIRED and APPROVED (not
// yet exported) orders at their net payable value. The order being checked is
// passed separately and never included in openOrdersPaise, so it can't be
// counted twice. Displayed available credit never goes below ₹0.

import { assertPaise } from "../money/paise";

export const OPEN_ORDER_STATUSES = ["PENDING_REVIEW", "CREDIT_HOLD", "REVIEW_REQUIRED", "APPROVED"] as const;

export type CreditInput = { limitPaise: number; outstandingPaise: number; openOrdersPaise: number };

export type CreditPosition = CreditInput & {
  /** What the retailer can still order without a hold (never negative). */
  availablePaise: number;
  /** How far the retailer is already over the limit before any new order. */
  alreadyOverPaise: number;
};

export function creditPosition({ limitPaise, outstandingPaise, openOrdersPaise }: CreditInput): CreditPosition {
  assertPaise(limitPaise, "limitPaise");
  assertPaise(outstandingPaise, "outstandingPaise");
  assertPaise(openOrdersPaise, "openOrdersPaise");
  const headroom = limitPaise - outstandingPaise - openOrdersPaise;
  return {
    limitPaise,
    outstandingPaise,
    openOrdersPaise,
    availablePaise: Math.max(0, headroom),
    alreadyOverPaise: Math.max(0, -headroom),
  };
}

export type CreditDecision = {
  /** True → the order is created as CREDIT_HOLD (D21). */
  hold: boolean;
  /** How much this order exceeds available credit (0 if it fits). */
  overByPaise: number;
};

/** Exactly at the limit is fine; one paisa over is a hold. */
export function decideCredit(position: CreditPosition, orderTotalPaise: number): CreditDecision {
  assertPaise(orderTotalPaise, "orderTotalPaise");
  const overByPaise = Math.max(0, orderTotalPaise - position.availablePaise);
  return { hold: overByPaise > 0, overByPaise };
}
