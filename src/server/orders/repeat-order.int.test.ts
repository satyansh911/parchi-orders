// "Order again" on real Postgres (test branch only, D49).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSession, findViewerByToken } from "../auth/session-store";
import { makeOrder, makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { repeatOrderLines } from "./repeat-order";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
beforeEach(() => resetTestDatabase(db));
const NOW = new Date("2026-11-09T06:00:00Z");
const viewerOf = async (userId: string) => (await findViewerByToken(db, (await createSession(db, userId, NOW)).token, NOW))!;

async function sku(code: string, stockCases: number, active = true) {
  const brand = await db.brand.upsert({ where: { name: "B" }, update: {}, create: { name: "B" } });
  const category = await db.category.upsert({ where: { slug: "c" }, update: {}, create: { slug: "c", nameEn: "C", nameHi: "C", sortOrder: 0 } });
  return db.sku.create({ data: { code, nameEn: code, nameHi: code, brandId: brand.id, categoryId: category.id, packSize: "1", piecesPerCase: 1, dealerPricePaise: 100, gstBps: 500, stockCases, imageKey: "box", active } });
}

async function orderWithLines(retailerId: string, userId: string, lines: Array<{ skuId: string; code: string; paidCases: number }>) {
  const order = await makeOrder(db, retailerId, userId, `o-${Math.random()}`);
  await db.orderLine.createMany({
    data: lines.map((l) => ({ orderId: order.id, skuId: l.skuId, skuCode: l.code, nameEn: l.code, nameHi: l.code, paidCases: l.paidCases, freeCases: 1, casePricePaise: 100, taxablePaise: 100, discountBps: 0, discountPaise: 0, gstBps: 500, gstPaise: 5, lineTotalPaise: 105, freeValuePaise: 100 })),
  });
  return order;
}

describe("repeatOrderLines (D9)", () => {
  it("copies paid cases only (free goods are recalculated) and flags unavailable items without dropping them", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101");
    const ok = await sku("OK", 50);
    const out = await sku("OUT", 0);
    const gone = await sku("GONE", 50, false);
    const order = await orderWithLines(a.retailer.id, a.user.id, [
      { skuId: ok.id, code: "OK", paidCases: 10 },
      { skuId: out.id, code: "OUT", paidCases: 2 },
      { skuId: gone.id, code: "GONE", paidCases: 3 },
    ]);
    expect(await repeatOrderLines(db, await viewerOf(a.user.id), order.id)).toEqual([
      { skuId: ok.id, paidCases: 10, flag: null },
      { skuId: out.id, paidCases: 2, flag: "OUT_OF_STOCK" },
      { skuId: gone.id, paidCases: 3, flag: "INACTIVE" },
    ]);
  });

  it("treats fully reserved stock as out of stock", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101");
    const s = await sku("RES", 5);
    await db.sku.update({ where: { id: s.id }, data: { reservedCases: 5 } });
    const order = await orderWithLines(a.retailer.id, a.user.id, [{ skuId: s.id, code: "RES", paidCases: 1 }]);
    expect((await repeatOrderLines(db, await viewerOf(a.user.id), order.id))[0].flag).toBe("OUT_OF_STOCK");
  });

  it("refuses another retailer's order with NOT_FOUND", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101");
    const b = await makeRetailer(db, "R-B", "9999900102");
    const s = await sku("OK", 50);
    const orderB = await orderWithLines(b.retailer.id, b.user.id, [{ skuId: s.id, code: "OK", paidCases: 1 }]);
    await expect(repeatOrderLines(db, await viewerOf(a.user.id), orderB.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
