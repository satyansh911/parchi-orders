// What a retailer can do to their own open orders in Phase 4 (D23, D77).
// Every function re-checks ownership from the session's retailerId (D69) and
// the status machine (D30). Cancelling locks the retailer row, then the order,
// then SKUs (sorted): the same order as placement, so they can't deadlock.

import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/domain/errors";
import { assertTransition } from "@/domain/orders/status-machine";
import { AccessError } from "../auth/access-error";
import { releaseReservation } from "../stock/reservation";
import { PLACEMENT_TX } from "./place-order";

type RetailerActor = { userId: string; retailerId: string };

/** Retailer cancels their own PENDING_REVIEW order; the reservation is released exactly once. */
export async function cancelOwnOrder(db: PrismaClient, viewer: RetailerActor, orderId: string, now: Date) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Retailer" WHERE id = ${viewer.retailerId} FOR UPDATE`;
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Order" WHERE id = ${orderId} AND "retailerId" = ${viewer.retailerId} FOR UPDATE`;
    if (locked.length === 0) throw new AccessError("NOT_FOUND");

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: { select: { skuId: true, paidCases: true, freeCases: true } } } });
    try {
      assertTransition(order.status, "CANCELLED", "RETAILER");
    } catch (error) {
      if (error instanceof DomainError) throw new AccessError("NOT_ALLOWED");
      throw error;
    }
    await releaseReservation(tx, order.lines.map((l) => ({ skuId: l.skuId, cases: l.paidCases + l.freeCases })));
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        reason: "Cancelled by the retailer",
        version: { increment: 1 },
        events: { create: { type: "STATUS_CHANGED", actorId: viewer.userId, fromStatus: order.status, toStatus: "CANCELLED", reason: "Cancelled by the retailer", createdAt: now } },
      },
    });
    return { status: "CANCELLED" as const };
  }, PLACEMENT_TX);
}

const ASK_THE_DESK = ["CREDIT_HOLD", "REVIEW_REQUIRED"] as const;

async function ownOrderAwaitingDesk(db: PrismaClient, viewer: RetailerActor, orderId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, retailerId: viewer.retailerId }, select: { id: true, status: true, cancelRequestedAt: true } });
  if (!order) throw new AccessError("NOT_FOUND");
  if (!(ASK_THE_DESK as readonly string[]).includes(order.status)) throw new AccessError("NOT_ALLOWED");
  return order;
}

/** Held or under-review order: ask the desk to cancel it. No status or stock change (D77). */
export async function requestCancellation(db: PrismaClient, viewer: RetailerActor, orderId: string, note: string | undefined, now: Date) {
  const order = await ownOrderAwaitingDesk(db, viewer, orderId);
  if (order.cancelRequestedAt) return { cancelRequestedAt: order.cancelRequestedAt, alreadyRequested: true };
  // Conditional update: two simultaneous requests record one.
  const updated = await db.order.updateMany({
    where: { id: orderId, retailerId: viewer.retailerId, cancelRequestedAt: null, status: { in: [...ASK_THE_DESK] } },
    data: { cancelRequestedAt: now },
  });
  if (updated.count === 0) return { cancelRequestedAt: order.cancelRequestedAt ?? now, alreadyRequested: true };
  await db.orderEvent.create({ data: { orderId, actorId: viewer.userId, type: "CANCEL_REQUESTED", reason: note?.trim() || null, createdAt: now } });
  return { cancelRequestedAt: now, alreadyRequested: false };
}

/** Held or under-review order: a clarification note for the desk (D23). */
export async function addNoteForDesk(db: PrismaClient, viewer: RetailerActor, orderId: string, note: string, now: Date) {
  await ownOrderAwaitingDesk(db, viewer, orderId);
  await db.orderEvent.create({ data: { orderId, actorId: viewer.userId, type: "NOTE", reason: note.trim(), createdAt: now } });
  return { sent: true as const };
}
