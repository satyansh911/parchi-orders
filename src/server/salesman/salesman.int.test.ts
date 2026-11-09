// Salesman mode on real Postgres (test branch only): pack scoping, offline
// sync parity with the phone's pricing, re-confirmation, access (D108, D109),
// plus the inactive dashboard (D112) and van loading lists (D110).
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { priceOfflineOrder } from "@/domain/salesman/price-offline";
import type { Viewer } from "../auth/session-store";
import { inactiveRetailers } from "../data/inactive";
import { vanLoadingLists } from "../data/loading";
import { decideOrder } from "../desk/transitions";
import { makeDeskUser, makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { buildSalesmanPack } from "./pack";
import { syncSalesmanOrder } from "./sync";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
const KEY = randomBytes(32);
const NOW = new Date("2026-11-09T06:00:00Z");

let salesman: Viewer;
let other: Viewer;
let mine: Awaited<ReturnType<typeof makeRetailer>>;
let notMine: Awaited<ReturnType<typeof makeRetailer>>;
let biscuit: string;

const viewer = (u: { id: string; name: string }, role: "SALESMAN" | "DESK"): Viewer => ({ userId: u.id, sessionId: "s", name: u.name, role, retailerId: null });

beforeEach(async () => {
  await resetTestDatabase(db);
  const brand = await db.brand.create({ data: { name: "Rewa Foods" } });
  const category = await db.category.create({ data: { slug: "c", nameEn: "C", nameHi: "C", sortOrder: 1 } });
  biscuit = (await db.sku.create({ data: { code: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", nameHi: "ग्लूकोज़", brandId: brand.id, categoryId: category.id, packSize: "75 g", imageKey: "box", piecesPerCase: 96, dealerPricePaise: 810, gstBps: 500, stockCases: 340 } })).id;
  await db.scheme.create({ data: { skuId: biscuit, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" } });
  const s1 = await db.user.create({ data: { phone: "9999900201", name: "Salesman One", role: "SALESMAN" } });
  const s2 = await db.user.create({ data: { phone: "9999900202", name: "Salesman Two", role: "SALESMAN" } });
  salesman = viewer(s1, "SALESMAN");
  other = viewer(s2, "SALESMAN");
  const van = await db.van.create({ data: { code: "VAN-1", name: "Van 1" } });
  mine = await makeRetailer(db, "R-A", "9999900101");
  notMine = await makeRetailer(db, "R-B", "9999900102");
  await db.retailer.update({ where: { id: mine.retailer.id }, data: { salesmanId: s1.id, vanId: van.id } });
  await db.retailer.update({ where: { id: notMine.retailer.id }, data: { salesmanId: s2.id } });
});

async function offlineOrder(paidCases: number) {
  const pack = await buildSalesmanPack(db, salesman, NOW);
  const shop = pack.shops.find((s) => s.id === mine.retailer.id)!;
  const cart = [{ skuId: biscuit, paidCases }];
  const priced = priceOfflineOrder(pack.skus, shop, cart, { skuCases: new Map(), shopPaise: 0 }, NOW);
  return { pack, cart, priced, input: { clientRequestId: randomUUID(), retailerId: shop.id, lines: cart, expected: priced.expectation!, confirmCreditHold: priced.credit.hold, takenAt: new Date(NOW.getTime() - 3_600_000) } };
}
const sync = (who: Viewer, input: Parameters<typeof syncSalesmanOrder>[2]) => syncSalesmanOrder({ db, key: KEY, now: NOW }, who, input);

describe("salesman pack (D109)", () => {
  it("contains only his assigned shops, with tier and credit, and the catalogue with stock and schemes", async () => {
    const pack = await buildSalesmanPack(db, salesman, NOW);
    expect(pack.shops.map((s) => s.code)).toEqual(["R-A"]);
    expect(pack.shops[0]).toMatchObject({ tierDiscountBps: 0, credit: { limitPaise: 5_000_000 } });
    expect(pack.skus[0]).toMatchObject({ code: "SKU-BS-075", availableCases: 340 });
    expect(pack.skus[0].schemes).toHaveLength(1);
  });

  it("refuses non-salesmen", async () => {
    await expect(buildSalesmanPack(db, { ...salesman, role: "DESK" }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("offline order sync (D108)", () => {
  it("the phone's pricing matches the server exactly: placed as SALESMAN with free goods reserved, idempotently", async () => {
    const { priced, input } = await offlineOrder(10);
    expect(priced.lines[0]).toMatchObject({ status: "OK", line: { freeCases: 1 } });
    const first = await sync(salesman, input);
    expect(first).toMatchObject({ outcome: "PLACED", alreadyPlaced: false, status: "PENDING_REVIEW" });
    expect(await sync(salesman, input)).toMatchObject({ outcome: "PLACED", alreadyPlaced: true }); // resent after lost signal
    const order = await db.order.findFirstOrThrow({ include: { lines: true } });
    expect(order).toMatchObject({ source: "SALESMAN", placedById: salesman.userId, retailerId: mine.retailer.id, totalPaise: priced.totals.totalPaise, takenAt: input.takenAt });
    expect((await db.sku.findUniqueOrThrow({ where: { id: biscuit } })).reservedCases).toBe(11);
  });

  it("if the price changed since the pack was downloaded, nothing is placed and the new total comes back", async () => {
    const { priced, input } = await offlineOrder(5);
    await db.sku.update({ where: { id: biscuit }, data: { dealerPricePaise: 850 } });
    const r = await sync(salesman, input);
    expect(r).toMatchObject({ outcome: "NOT_PLACED", problem: "QUOTE_CHANGED" });
    if (r.outcome !== "NOT_PLACED") throw new Error();
    expect(r.preview.totals.totalPaise).toBeGreaterThan(priced.totals.totalPaise);
    expect(await db.order.count()).toBe(0);
    expect((await db.sku.findUniqueOrThrow({ where: { id: biscuit } })).reservedCases).toBe(0);
  });

  it("refuses a shop that isn't his (NOT_FOUND), whatever the input says", async () => {
    const { input } = await offlineOrder(5);
    await expect(sync(other, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(sync(salesman, { ...input, retailerId: notMine.retailer.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.order.count()).toBe(0);
  });

  it("never records a 'taken' time in the future", async () => {
    const { input } = await offlineOrder(5);
    await sync(salesman, { ...input, takenAt: new Date(NOW.getTime() + 86_400_000) });
    expect((await db.order.findFirstOrThrow()).takenAt).toEqual(NOW);
  });
});

describe("inactive dashboard (D112) and van loading lists (D110)", () => {
  it("a salesman sees only his inactive shops; the desk sees all; ordering makes a shop active", async () => {
    const desk = viewer(await makeDeskUser(db), "DESK");
    expect((await inactiveRetailers(db, salesman, NOW)).map((s) => s.code)).toEqual(["R-A"]);
    expect((await inactiveRetailers(db, desk, NOW)).map((s) => s.code).sort()).toEqual(["R-A", "R-B"]);
    await sync(salesman, (await offlineOrder(5)).input);
    expect(await inactiveRetailers(db, salesman, NOW)).toEqual([]);
    await expect(inactiveRetailers(db, { ...salesman, role: "RETAILER" }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("loads approved orders on the van for their approval day, including free goods; desk only", async () => {
    const desk = viewer(await makeDeskUser(db), "DESK");
    await sync(salesman, (await offlineOrder(10)).input);
    const order = await db.order.findFirstOrThrow();
    await decideOrder(db, desk, { orderId: order.id, version: order.version, decision: "APPROVE" }, NOW);
    const [van] = await vanLoadingLists(db, desk, "2026-11-09");
    expect(van).toMatchObject({ vanCode: "VAN-1", orderCount: 1, totalCases: 11 });
    expect(van.skus[0]).toMatchObject({ skuCode: "SKU-BS-075", paidCases: 10, freeCases: 1 });
    expect(await vanLoadingLists(db, desk, "2026-11-10")).toEqual([]);
    await expect(vanLoadingLists(db, salesman, "2026-11-09")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
