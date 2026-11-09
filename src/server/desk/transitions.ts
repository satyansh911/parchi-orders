// Desk decisions on an order (D30, D33, D24, D32). One transaction per
// decision, under the retailer + order locks and an optimistic version check,
// so a double click or two desk users can never apply a stock effect twice.

import type { PrismaClient } from "@/generated/prisma/client";
import { creditPosition, decideCredit } from "@/domain/credit/credit";
import { DomainError } from "@/domain/errors";
import { assertTransition, type OrderStatus } from "@/domain/orders/status-machine";
import { AccessError } from "../auth/access-error";
import { creditPositionFor } from "../data/credit";
import { PLACEMENT_TX } from "../orders/place-order";
import { deductReservedStock, releaseReservation, restoreDeductedStock } from "../stock/reservation";
import { lockOrderForDesk, stockOf, VersionConflictError, type DeskActor, type Tx } from "./lock";

export type Decision = "APPROVE" | "REJECT" | "CANCEL_APPROVED";
export type DecisionInput = { orderId: string; version: number; decision: Decision; reason?: string };
export type DecisionResult =
  | { outcome: "DONE"; status: OrderStatus }
  | { outcome: "MOVED_TO_CREDIT_HOLD"; overByPaise: number }
  | { outcome: "AWAITING_RETAILER" }
  | { outcome: "CONFLICT" };

export async function decideOrder(db: PrismaClient, desk: DeskActor, input: DecisionInput, now: Date): Promise<DecisionResult> {
  try {
    return await db.$transaction((tx) => decide(tx, desk, input, now), PLACEMENT_TX);
  } catch (error) {
    if (error instanceof VersionConflictError) return { outcome: "CONFLICT" };
    throw error;
  }
}

async function decide(tx: Tx, desk: DeskActor, input: DecisionInput, now: Date): Promise<DecisionResult> {
  const order = await lockOrderForDesk(tx, input.orderId, input.version);
  const to: OrderStatus = input.decision === "APPROVE" ? "APPROVED" : "CANCELLED";
  if ((input.decision === "CANCEL_APPROVED") !== (order.status === "APPROVED")) throw new AccessError("NOT_ALLOWED");

  let rule;
  try {
    rule = assertTransition(order.status, to, "DESK", input.reason);
  } catch (error) {
    if (error instanceof DomainError) throw new AccessError("NOT_ALLOWED");
    throw error;
  }

  if (to === "APPROVED") {
    // D32: never approve a raised total the retailer hasn't accepted.
    if (order.awaitingRetailerAck) return { outcome: "AWAITING_RETAILER" };
    // D33: re-check credit, not counting this order twice. Releasing a hold is the desk's override.
    if (order.status !== "CREDIT_HOLD") {
      const position = await creditPositionFor(tx, order.retailerId);
      const without = creditPosition({ limitPaise: position.limitPaise, outstandingPaise: position.outstandingPaise, openOrdersPaise: position.openOrdersPaise - order.totalPaise });
      const credit = decideCredit(without, order.totalPaise);
      if (credit.hold) {
        assertTransition(order.status, "CREDIT_HOLD", "SYSTEM");
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CREDIT_HOLD", version: { increment: 1 },
            creditLimitPaise: without.limitPaise, availableCreditPaise: without.availablePaise, overLimitPaise: credit.overByPaise, creditCheckedAt: now,
            events: { create: { type: "STATUS_CHANGED", actorId: null, fromStatus: order.status, toStatus: "CREDIT_HOLD", reason: "Over available credit at approval", payload: { overByPaise: credit.overByPaise, availablePaise: without.availablePaise }, createdAt: now } },
          },
        });
        return { outcome: "MOVED_TO_CREDIT_HOLD", overByPaise: credit.overByPaise };
      }
    }
  }

  const items = stockOf(order.lines);
  if (rule.stock === "DEDUCT") await deductReservedStock(tx, items);
  else if (rule.stock === "RELEASE") await releaseReservation(tx, items);
  else if (rule.stock === "RESTORE") await restoreDeductedStock(tx, items);

  const reason = input.reason?.trim() || (order.status === "CREDIT_HOLD" && to === "APPROVED" ? "Credit hold released" : null);
  await tx.order.update({
    where: { id: order.id },
    data: {
      status: to,
      version: { increment: 1 },
      ...(to === "APPROVED" ? { approvedAt: now, approvedById: desk.userId } : { reason }),
      events: { create: { type: "STATUS_CHANGED", actorId: desk.userId, fromStatus: order.status, toStatus: to, reason, payload: { stock: rule.stock }, createdAt: now } },
    },
  });
  return { outcome: "DONE", status: to };
}
