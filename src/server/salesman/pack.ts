// D108/D109: everything a salesman needs to take orders offline, for HIS
// assigned shops only: catalogue with schemes and stock, each shop's tier,
// credit position and last order date. Built fresh on every download.

import type { PrismaClient } from "@/generated/prisma/client";
import { toJsonScheme, type SalesmanPack } from "@/domain/salesman/pack";
import { availableCases } from "@/domain/stock/line-stock";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";
import { toCatalogueSku } from "../catalogue/to-domain";
import { creditPositionFor } from "../data/credit";

export async function buildSalesmanPack(db: PrismaClient, viewer: Viewer, now: Date): Promise<SalesmanPack> {
  if (viewer.role !== "SALESMAN") throw new AccessError("NOT_FOUND");
  const [skus, shops] = await Promise.all([
    db.sku.findMany({
      where: { active: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { nameEn: "asc" }],
      include: { schemes: true, brand: { select: { name: true } }, category: { select: { nameEn: true, nameHi: true } } },
    }),
    db.retailer.findMany({
      where: { salesmanId: viewer.userId },
      orderBy: [{ area: "asc" }, { shopName: "asc" }],
      select: {
        id: true, code: true, shopName: true, ownerName: true, area: true,
        tier: { select: { name: true, discountBps: true } },
        users: { where: { role: "RETAILER" }, select: { phone: true }, take: 1 },
      },
    }),
  ]);
  const last = await db.order.groupBy({ by: ["retailerId"], where: { retailerId: { in: shops.map((s) => s.id) }, status: { not: "CANCELLED" } }, _max: { placedAt: true } });
  const lastBy = new Map(last.map((l) => [l.retailerId, l._max.placedAt]));
  const credit = await Promise.all(shops.map((s) => creditPositionFor(db, s.id)));
  return {
    v: 1,
    generatedAt: now.toISOString(),
    salesmanName: viewer.name,
    skus: skus.map((row) => {
      const sku = toCatalogueSku(row);
      return {
        ...sku,
        // Only schemes still running at download time; the server re-checks on sync anyway.
        schemes: sku.schemes.filter((s) => s.active && (!s.endsAt || s.endsAt > now)).map(toJsonScheme),
        packSize: row.packSize, brand: row.brand.name, imageKey: row.imageKey, categoryEn: row.category.nameEn, categoryHi: row.category.nameHi,
        mrpPaise: row.mrpPaise, availableCases: availableCases(row.stockCases, row.reservedCases),
      };
    }),
    shops: shops.map((s, i) => ({
      id: s.id, code: s.code, shopName: s.shopName, ownerName: s.ownerName, area: s.area, phone: s.users[0]?.phone ?? null,
      tierName: s.tier.name, tierDiscountBps: s.tier.discountBps, credit: credit[i], lastOrderAt: lastBy.get(s.id)?.toISOString() ?? null,
    })),
  };
}
