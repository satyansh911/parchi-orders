// Order lifecycle (D30, consolidated; D21, D33, D77, D1, D24).
// DRAFT is never used (D12). CANCELLED and EXPORTED are final.
// "NEW" = the order is being created.

import { DomainError } from "../errors";

export type OrderStatus = "DRAFT" | "PENDING_REVIEW" | "CREDIT_HOLD" | "REVIEW_REQUIRED" | "APPROVED" | "CANCELLED" | "EXPORTED";
export type Actor = "SYSTEM" | "RETAILER" | "DESK";
export type From = OrderStatus | "NEW";

/** What a change does to stock (D4, D24). */
export type StockEffect = "RESERVE" | "DEDUCT" | "RELEASE" | "RESTORE" | "NONE";

type Rule = { from: From; to: OrderStatus; actor: Actor; reasonRequired: boolean; stock: StockEffect };

const rule = (from: From, to: OrderStatus, actor: Actor, stock: StockEffect, reasonRequired = false): Rule => ({ from, to, actor, reasonRequired, stock });

export const TRANSITIONS: readonly Rule[] = [
  // Creation: the system decides the starting status (D21).
  rule("NEW", "PENDING_REVIEW", "SYSTEM", "RESERVE"),
  rule("NEW", "CREDIT_HOLD", "SYSTEM", "RESERVE"),
  rule("NEW", "REVIEW_REQUIRED", "SYSTEM", "RESERVE"),
  // Credit re-checks (D21 after review, D33 at approval).
  rule("PENDING_REVIEW", "CREDIT_HOLD", "SYSTEM", "NONE"),
  rule("REVIEW_REQUIRED", "CREDIT_HOLD", "SYSTEM", "NONE"),
  // Approval and release move reserved stock out (D4).
  rule("PENDING_REVIEW", "APPROVED", "DESK", "DEDUCT"),
  rule("REVIEW_REQUIRED", "APPROVED", "DESK", "DEDUCT"),
  rule("CREDIT_HOLD", "APPROVED", "DESK", "DEDUCT"),
  // Cancellation before approval releases the reservation.
  rule("PENDING_REVIEW", "CANCELLED", "RETAILER", "RELEASE"), // own order (D77)
  rule("PENDING_REVIEW", "CANCELLED", "DESK", "RELEASE", true), // reject with reason
  rule("CREDIT_HOLD", "CANCELLED", "DESK", "RELEASE", true),
  rule("REVIEW_REQUIRED", "CANCELLED", "DESK", "RELEASE", true),
  // Approved but not exported: desk only, with a reason; goods go back (D1, D24).
  rule("APPROVED", "CANCELLED", "DESK", "RESTORE", true),
  rule("APPROVED", "EXPORTED", "DESK", "NONE"),
];

export function findTransition(from: From, to: OrderStatus, actor: Actor): Rule | null {
  return TRANSITIONS.find((t) => t.from === from && t.to === to && t.actor === actor) ?? null;
}

/** The rule for this change, or a typed error. A reason is checked where required. */
export function assertTransition(from: From, to: OrderStatus, actor: Actor, reason?: string): Rule {
  const found = findTransition(from, to, actor);
  if (!found) throw new DomainError("INVALID_TRANSITION", `${actor} cannot move an order from ${from} to ${to}`);
  if (found.reasonRequired && !(reason && reason.trim().length >= 3)) {
    throw new DomainError("REASON_REQUIRED", `moving from ${from} to ${to} needs a reason`);
  }
  return found;
}

export const FINAL_STATUSES: readonly OrderStatus[] = ["CANCELLED", "EXPORTED"];
