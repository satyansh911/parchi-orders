// Orders, scoped to the viewer (D62, D69.3). Retailers see only their own;
// the desk sees all and may filter by retailer.

import type { PrismaClient } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";
import { ownedBy, targetRetailerId } from "./scope";

const LIST_LIMIT = 50;

export async function listOrders(
  db: PrismaClient,
  viewer: Viewer,
  filter: { status?: OrderStatus; retailerId?: string } = {},
) {
  const where = {
    ...ownedBy(viewer),
    ...(filter.status ? { status: filter.status } : {}),
    // A retailer naming another retailer gets NOT_FOUND from targetRetailerId.
    ...(filter.retailerId !== undefined ? { retailerId: targetRetailerId(viewer, filter.retailerId) } : {}),
  };
  return db.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true, number: true, status: true, source: true, totalPaise: true, placedAt: true, retailerId: true,
      awaitingRetailerAck: true,
      _count: { select: { lines: true } },
    },
  });
}

export async function getOrder(db: PrismaClient, viewer: Viewer, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, ...ownedBy(viewer) },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      // The audit trail is for the desk (D8); retailers see status, not internal notes.
      events: viewer.role === "DESK" ? { orderBy: { createdAt: "asc" } } : false,
    },
  });
  if (!order) throw new AccessError("NOT_FOUND");
  return order;
}
