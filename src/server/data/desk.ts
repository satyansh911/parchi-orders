// Desk-only reads (D62). Every function refuses non-desk viewers with
// NOT_FOUND, so a retailer can never reach the cross-retailer queue.

import type { PrismaClient } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";

const requireDesk = (viewer: Viewer) => {
  if (viewer.role !== "DESK") throw new AccessError("NOT_FOUND");
};

export const QUEUE_FILTERS = {
  action: { label: "Needs action", where: { status: { in: ["PENDING_REVIEW", "REVIEW_REQUIRED"] as OrderStatus[] }, awaitingRetailerAck: false } },
  hold: { label: "Credit hold", where: { status: "CREDIT_HOLD" as OrderStatus } },
  awaiting: { label: "Awaiting retailer", where: { awaitingRetailerAck: true, status: { in: ["PENDING_REVIEW", "CREDIT_HOLD", "REVIEW_REQUIRED"] as OrderStatus[] } } },
  approved: { label: "Approved", where: { status: "APPROVED" as OrderStatus } },
  exported: { label: "Exported", where: { status: "EXPORTED" as OrderStatus } },
  cancelled: { label: "Cancelled", where: { status: "CANCELLED" as OrderStatus } },
} as const;
export type QueueFilter = keyof typeof QUEUE_FILTERS;
export const isQueueFilter = (v: unknown): v is QueueFilter => typeof v === "string" && v in QUEUE_FILTERS;

export async function deskQueue(db: PrismaClient, viewer: Viewer, filter: QueueFilter) {
  requireDesk(viewer);
  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where: { ...QUEUE_FILTERS[filter].where, source: { not: "HISTORICAL_SEED" } },
      orderBy: { placedAt: filter === "action" || filter === "hold" || filter === "awaiting" ? "asc" : "desc" },
      take: 100,
      select: {
        id: true, number: true, status: true, source: true, totalPaise: true, placedAt: true, overLimitPaise: true,
        awaitingRetailerAck: true, cancelRequestedAt: true, captureId: true,
        retailer: { select: { code: true, shopName: true, area: true } },
        _count: { select: { lines: true } },
      },
    }),
    Promise.all((Object.keys(QUEUE_FILTERS) as QueueFilter[]).map(async (k) => [k, await db.order.count({ where: { ...QUEUE_FILTERS[k].where, source: { not: "HISTORICAL_SEED" } } })] as const)),
  ]);
  return { orders, counts: Object.fromEntries(counts) as Record<QueueFilter, number> };
}

export async function deskOrder(db: PrismaClient, viewer: Viewer, orderId: string) {
  requireDesk(viewer);
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } },
      retailer: { select: { id: true, code: true, shopName: true, ownerName: true, area: true, tier: { select: { name: true } } } },
      capture: { include: { lines: { orderBy: { position: "asc" } } } },
      exportBatch: { select: { id: true, number: true } },
    },
  });
  if (!order) throw new AccessError("NOT_FOUND");
  return order;
}

export async function exportBatches(db: PrismaClient, viewer: Viewer) {
  requireDesk(viewer);
  return db.exportBatch.findMany({ orderBy: { number: "desc" }, take: 50, select: { id: true, number: true, orderCount: true, totalPaise: true, createdAt: true, createdBy: { select: { name: true } } } });
}

export async function exportBatchCsv(db: PrismaClient, viewer: Viewer, batchId: string) {
  requireDesk(viewer);
  const batch = await db.exportBatch.findUnique({ where: { id: batchId }, select: { number: true, csv: true } });
  if (!batch) throw new AccessError("NOT_FOUND");
  return batch;
}
