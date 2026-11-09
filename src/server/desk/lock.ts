// Shared locking for desk changes. Lock order everywhere: retailer, then
// order, then SKUs (sorted) — the same as placement, so nothing deadlocks.

import type { Prisma } from "@/generated/prisma/client";
import { AccessError } from "../auth/access-error";

export type Tx = Prisma.TransactionClient;
export type DeskActor = { userId: string };

export class VersionConflictError extends Error {
  constructor() {
    super("order changed since it was read");
    this.name = "VersionConflictError";
  }
}

/** Lock the order's retailer and the order; the caller's version must still be current. */
export async function lockOrderForDesk(tx: Tx, orderId: string, version: number) {
  const head = await tx.order.findUnique({ where: { id: orderId }, select: { retailerId: true } });
  if (!head) throw new AccessError("NOT_FOUND");
  await tx.$queryRaw`SELECT id FROM "Retailer" WHERE id = ${head.retailerId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: { orderBy: { createdAt: "asc" } } } });
  if (order.version !== version) throw new VersionConflictError();
  return order;
}

export const stockOf = (lines: readonly { skuId: string; paidCases: number; freeCases: number }[]) =>
  lines.map((l) => ({ skuId: l.skuId, cases: l.paidCases + l.freeCases }));
