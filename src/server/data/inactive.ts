// D112: retailers with no order in 14 days. Desk: all shops; salesman: only
// his assigned shops (D109). Cancelled orders don't count as activity.

import type { PrismaClient } from "@/generated/prisma/client";
import { byLongestGap, inactivity } from "@/domain/retailers/inactivity";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";

export async function inactiveRetailers(db: PrismaClient, viewer: Viewer, now: Date) {
  const where = viewer.role === "DESK" ? {} : viewer.role === "SALESMAN" ? { salesmanId: viewer.userId } : null;
  if (!where) throw new AccessError("NOT_FOUND");
  const [shops, last] = await Promise.all([
    db.retailer.findMany({
      where,
      select: {
        id: true, code: true, shopName: true, ownerName: true, area: true, outstandingPaise: true,
        users: { where: { role: "RETAILER" }, select: { phone: true }, take: 1 },
        salesman: { select: { name: true } },
      },
    }),
    db.order.groupBy({ by: ["retailerId"], where: { status: { not: "CANCELLED" }, retailer: where }, _max: { placedAt: true } }),
  ]);
  const lastBy = new Map(last.map((l) => [l.retailerId, l._max.placedAt]));
  return shops
    .map((s) => ({ ...s, phone: s.users[0]?.phone ?? null, lastOrderAt: lastBy.get(s.id) ?? null, ...inactivity(lastBy.get(s.id) ?? null, now) }))
    .filter((s) => s.inactive)
    .sort(byLongestGap);
}
