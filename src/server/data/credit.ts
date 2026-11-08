// Credit position (D20) from the database. The open-orders sum uses the
// Order(retailerId, status) index (D89).

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { OPEN_ORDER_STATUSES, creditPosition, type CreditPosition } from "@/domain/credit/credit";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";
import { targetRetailerId } from "./scope";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Internal: no access check. Only for code that has already established which
 * retailer it is acting for (e.g. order placement after locking the retailer row).
 */
export async function creditPositionFor(db: Db, retailerId: string): Promise<CreditPosition> {
  const retailer = await db.retailer.findUnique({ where: { id: retailerId }, select: { creditLimitPaise: true, outstandingPaise: true } });
  if (!retailer) throw new AccessError("NOT_FOUND");
  const open = await db.order.aggregate({
    where: { retailerId, status: { in: [...OPEN_ORDER_STATUSES] } },
    _sum: { totalPaise: true },
  });
  return creditPosition({
    limitPaise: retailer.creditLimitPaise,
    outstandingPaise: retailer.outstandingPaise,
    openOrdersPaise: open._sum.totalPaise ?? 0,
  });
}

/** Viewer-scoped: a retailer sees only their own; the desk must name the retailer. */
export async function getCreditSummary(db: Db, viewer: Viewer, retailerId?: string): Promise<CreditPosition> {
  return creditPositionFor(db, targetRetailerId(viewer, retailerId));
}
