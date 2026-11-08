// Catalogue data on real Postgres (test branch only, D49).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSession, findViewerByToken } from "../auth/session-store";
import { makeDeskUser, makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { getCatalogue } from "./catalogue";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
const NOW = new Date("2026-11-09T06:00:00Z");

async function makeSku(code: string, fields: { stockCases: number; reservedCases?: number; active?: boolean }) {
  const brand = await db.brand.upsert({ where: { name: "Rewa Foods" }, update: {}, create: { name: "Rewa Foods" } });
  const category = await db.category.upsert({ where: { slug: "biscuits" }, update: {}, create: { slug: "biscuits", nameEn: "Biscuits", nameHi: "बिस्कुट", sortOrder: 1 } });
  return db.sku.create({
    data: {
      code, nameEn: code, nameHi: code, brandId: brand.id, categoryId: category.id, packSize: "75 g", piecesPerCase: 96,
      dealerPricePaise: 810, gstBps: 500, mrpPaise: 1000, imageKey: "box", reservedCases: 0, active: true, ...fields,
    },
  });
}
const viewerOf = async (userId: string) => (await findViewerByToken(db, (await createSession(db, userId, NOW)).token, NOW))!;

beforeEach(() => resetTestDatabase(db));

describe("getCatalogue", () => {
  it("prices each retailer at their own tier", async () => {
    await makeSku("SKU-BS-075", { stockCases: 340 });
    const a = await makeRetailer(db, "R-A", "9999900101", { tierCode: "STANDARD", tierDiscountBps: 0 });
    const b = await makeRetailer(db, "R-B", "9999900102", { tierCode: "KEY_ACCOUNT", tierDiscountBps: 200 });
    expect((await getCatalogue(db, await viewerOf(a.user.id), NOW)).items[0].casePricePaise).toBe(77_760);
    expect((await getCatalogue(db, await viewerOf(b.user.id), NOW)).items[0].casePricePaise).toBe(76_205);
  });

  it("refuses the desk without a named retailer (no 'whose prices?' guess)", async () => {
    const desk = await makeDeskUser(db);
    await expect(getCatalogue(db, await viewerOf(desk.id), NOW)).rejects.toMatchObject({ code: "RETAILER_REQUIRED" });
  });

  it("hides inactive SKUs and bands stock after reservations, never sending exact counts above 20", async () => {
    await makeSku("SKU-OFF", { stockCases: 50, active: false });
    await makeSku("SKU-LOW", { stockCases: 85, reservedCases: 70 });
    await makeSku("SKU-BIG", { stockCases: 340 });
    const a = await makeRetailer(db, "R-A", "9999900101");
    const { items } = await getCatalogue(db, await viewerOf(a.user.id), NOW);
    expect(items.map((i) => i.code).sort()).toEqual(["SKU-BIG", "SKU-LOW"]);
    expect(items.find((i) => i.code === "SKU-LOW")!.stock).toEqual({ status: "LOW", casesLeft: 15 });
    expect(items.find((i) => i.code === "SKU-BIG")!.stock).toEqual({ status: "IN_STOCK" });
    expect(JSON.stringify(items)).not.toMatch(/"(stockCases|reservedCases)"|340|"85"/);
  });

  it("shows only offers active today", async () => {
    const sku = await makeSku("SKU-BS-075", { stockCases: 340 });
    await db.scheme.create({ data: { skuId: sku.id, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" } });
    await db.scheme.create({ data: { skuId: sku.id, type: "SLAB_DISCOUNT", minCases: 5, discountBps: 200, labelEn: "old", labelHi: "old", endsAt: new Date("2026-10-31T18:30:00Z") } });
    const a = await makeRetailer(db, "R-A", "9999900101");
    expect((await getCatalogue(db, await viewerOf(a.user.id), NOW)).items[0].offers.map((o) => o.labelEn)).toEqual(["Buy 10 get 1"]);
  });
});
