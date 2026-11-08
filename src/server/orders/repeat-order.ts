// "Order again" (D9, D78): the lines of one of the retailer's own past orders,
// for the cart. Prices, schemes and stock are NOT copied: the cart re-prices
// at today's values. Unavailable items are flagged, never dropped silently.

import type { PrismaClient } from "@/generated/prisma/client";
import { availableCases } from "@/domain/stock/line-stock";
import type { Viewer } from "../auth/session-store";
import { getOrder } from "../data/orders";

export type RepeatLine = { skuId: string; paidCases: number; flag: "OUT_OF_STOCK" | "INACTIVE" | null };

export async function repeatOrderLines(db: PrismaClient, viewer: Viewer, orderId: string): Promise<RepeatLine[]> {
  const order = await getOrder(db, viewer, orderId); // NOT_FOUND unless it's the viewer's own (D62)
  const skus = await db.sku.findMany({
    where: { id: { in: order.lines.map((l) => l.skuId) } },
    select: { id: true, active: true, stockCases: true, reservedCases: true },
  });
  const byId = new Map(skus.map((s) => [s.id, s]));
  return order.lines.map((line) => {
    const sku = byId.get(line.skuId);
    const flag = !sku || !sku.active ? "INACTIVE" : availableCases(sku.stockCases, sku.reservedCases) === 0 ? "OUT_OF_STOCK" : null;
    return { skuId: line.skuId, paidCases: line.paidCases, flag };
  });
}
