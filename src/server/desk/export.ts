// Tally export batches (D29). One transaction: lock every APPROVED,
// not-yet-exported order, check the desk saw the same count and total,
// build and reconcile the CSV, store it, then mark exactly those orders
// EXPORTED. Any failure rolls back: no order is ever marked exported without
// a stored batch. A second, concurrent export waits on the row locks and then
// finds nothing left to export.

import type { PrismaClient } from "@/generated/prisma/client";
import { buildTallyCsv } from "@/domain/export/tally-csv";
import { assertTransition } from "@/domain/orders/status-machine";
import type { DeskActor } from "./lock";

export type ExportPreview = { orderCount: number; totalPaise: number };
export type ExportResult =
  | { outcome: "EXPORTED"; batchId: string; number: number; orderCount: number; totalPaise: number }
  | { outcome: "CHANGED"; preview: ExportPreview }
  | { outcome: "NOTHING_TO_EXPORT" };

const ELIGIBLE = { status: "APPROVED" as const, exportBatchId: null };

export async function exportPreview(db: PrismaClient): Promise<ExportPreview> {
  const agg = await db.order.aggregate({ where: ELIGIBLE, _count: true, _sum: { totalPaise: true } });
  return { orderCount: agg._count, totalPaise: agg._sum.totalPaise ?? 0 };
}

export async function createExportBatch(db: PrismaClient, desk: DeskActor, expected: ExportPreview, now: Date): Promise<ExportResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Order" WHERE status = 'APPROVED' AND "exportBatchId" IS NULL ORDER BY number FOR UPDATE`;
    if (locked.length === 0) return { outcome: "NOTHING_TO_EXPORT" as const };
    const ids = locked.map((r) => r.id);
    const orders = await tx.order.findMany({
      where: { id: { in: ids }, ...ELIGIBLE },
      include: { lines: { orderBy: { createdAt: "asc" } }, retailer: { select: { code: true, shopName: true, area: true } } },
    });
    const totalPaise = orders.reduce((s, o) => s + o.totalPaise, 0);
    if (orders.length !== expected.orderCount || totalPaise !== expected.totalPaise) {
      return { outcome: "CHANGED" as const, preview: { orderCount: orders.length, totalPaise } };
    }
    for (const o of orders) assertTransition(o.status, "EXPORTED", "DESK");

    const batch = await tx.exportBatch.create({ data: { createdById: desk.userId, orderCount: orders.length, totalPaise, csv: "", createdAt: now } });
    const built = buildTallyCsv(batch.number, orders); // throws on any mismatch → rollback
    await tx.exportBatch.update({ where: { id: batch.id }, data: { csv: built.csv } });
    const marked = await tx.order.updateMany({
      where: { id: { in: ids }, ...ELIGIBLE },
      data: { status: "EXPORTED", exportBatchId: batch.id, exportedAt: now, version: { increment: 1 } },
    });
    if (marked.count !== orders.length) throw new Error("export: order set changed under lock");
    await tx.orderEvent.createMany({
      data: orders.map((o) => ({ orderId: o.id, actorId: desk.userId, type: "EXPORTED" as const, fromStatus: "APPROVED" as const, toStatus: "EXPORTED" as const, payload: { batch: batch.number }, createdAt: now })),
    });
    return { outcome: "EXPORTED" as const, batchId: batch.id, number: batch.number, orderCount: orders.length, totalPaise };
  }, { maxWait: 5_000, timeout: 20_000 });
}
