// Desk lifecycle and Tally export on real Postgres (test branch only, D49).
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { priceCart, type CartLineInput } from "../cart/price-cart";
import { placeOrder } from "../orders/place-order";
import { acceptChanges } from "../orders/retailer-order-actions";
import { makeDeskUser, makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { editOrderLine } from "./edit-line";
import { createExportBatch, exportPreview } from "./export";
import { decideOrder } from "./transitions";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
const KEY = randomBytes(32);
const NOW = new Date("2026-11-09T06:00:00Z");

type R = Awaited<ReturnType<typeof makeRetailer>>;
let A: R;
let desk: { userId: string };
let biscuit: string;
let detergent: string;

beforeEach(async () => {
  await resetTestDatabase(db);
  const brand = await db.brand.create({ data: { name: "Rewa Foods" } });
  const category = await db.category.create({ data: { slug: "c", nameEn: "C", nameHi: "C", sortOrder: 1 } });
  const mk = (code: string, piecesPerCase: number, dealerPricePaise: number, gstBps: number, stockCases: number) =>
    db.sku.create({ data: { code, nameEn: code, nameHi: code, brandId: brand.id, categoryId: category.id, packSize: "1", imageKey: "box", piecesPerCase, dealerPricePaise, gstBps, stockCases } });
  biscuit = (await mk("SKU-BS-075", 96, 810, 500, 340)).id;
  detergent = (await mk("SKU-DT-1KG", 20, 10_150, 1800, 85)).id;
  await db.scheme.createMany({
    data: [
      { skuId: biscuit, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" },
      { skuId: detergent, type: "SLAB_DISCOUNT", minCases: 5, discountBps: 300, labelEn: "3% off 5+", labelHi: "5+ पर 3%" },
    ],
  });
  A = await makeRetailer(db, "R-A", "9999900101", { creditLimitPaise: 10_000_000 });
  desk = { userId: (await makeDeskUser(db)).id };
});

async function place(lines: CartLineInput[], r: R = A) {
  const { preview } = await priceCart({ db, key: KEY, now: NOW }, { id: r.retailer.id, tierDiscountBps: 0 }, lines);
  const res = await placeOrder({ db, key: KEY, now: NOW }, { userId: r.user.id, retailerId: r.retailer.id }, { clientRequestId: randomUUID(), lines, quote: preview.quote!, confirmCreditHold: preview.credit.hold });
  if (res.outcome !== "PLACED") throw new Error(res.outcome);
  return db.order.findUniqueOrThrow({ where: { id: res.orderId }, include: { lines: true } });
}
const stock = async (id: string) => db.sku.findUniqueOrThrow({ where: { id }, select: { stockCases: true, reservedCases: true } });
const version = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).version;
const decide = async (orderId: string, decision: "APPROVE" | "REJECT" | "CANCEL_APPROVED", reason?: string) =>
  decideOrder(db, desk, { orderId, version: await version(orderId), decision, reason }, NOW);

describe("desk decisions (D30)", () => {
  it("approve moves reserved stock out exactly once; a stale version is a CONFLICT", async () => {
    const o = await place([{ skuId: biscuit, paidCases: 10 }]);
    expect(await stock(biscuit)).toEqual({ stockCases: 340, reservedCases: 11 });
    const v = o.version;
    const [one, two] = await Promise.all([
      decideOrder(db, desk, { orderId: o.id, version: v, decision: "APPROVE" }, NOW),
      decideOrder(db, desk, { orderId: o.id, version: v, decision: "APPROVE" }, NOW),
    ]);
    expect([one.outcome, two.outcome].sort()).toEqual(["CONFLICT", "DONE"]);
    expect(await stock(biscuit)).toEqual({ stockCases: 329, reservedCases: 0 });
    const events = await db.orderEvent.findMany({ where: { orderId: o.id, type: "STATUS_CHANGED" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: desk.userId, fromStatus: "PENDING_REVIEW", toStatus: "APPROVED" });
  });

  it("reject needs a reason and releases the reservation", async () => {
    const o = await place([{ skuId: biscuit, paidCases: 10 }]);
    await expect(decide(o.id, "REJECT")).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(await decide(o.id, "REJECT", "Shop closed")).toEqual({ outcome: "DONE", status: "CANCELLED" });
    expect(await stock(biscuit)).toEqual({ stockCases: 340, reservedCases: 0 });
    await expect(decide(o.id, "APPROVE")).rejects.toMatchObject({ code: "NOT_ALLOWED" }); // CANCELLED is final
  });

  it("cancelling an approved order restores the deducted stock (D24)", async () => {
    const o = await place([{ skuId: biscuit, paidCases: 10 }]);
    await decide(o.id, "APPROVE");
    expect(await decide(o.id, "CANCEL_APPROVED", "Van breakdown")).toEqual({ outcome: "DONE", status: "CANCELLED" });
    expect(await stock(biscuit)).toEqual({ stockCases: 340, reservedCases: 0 });
  });

  it("re-checks credit at approval (D33): over the limit moves to CREDIT_HOLD; releasing the hold approves", async () => {
    const o = await place([{ skuId: biscuit, paidCases: 10 }]);
    await db.retailer.update({ where: { id: A.retailer.id }, data: { outstandingPaise: 9_500_000 } });
    const r = await decide(o.id, "APPROVE");
    expect(r).toMatchObject({ outcome: "MOVED_TO_CREDIT_HOLD" });
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("CREDIT_HOLD");
    expect(await stock(biscuit)).toEqual({ stockCases: 340, reservedCases: 11 }); // still reserved
    expect(await decide(o.id, "APPROVE")).toEqual({ outcome: "DONE", status: "APPROVED" });
    expect(await stock(biscuit)).toEqual({ stockCases: 329, reservedCases: 0 });
  });
});

describe("desk line edits (D22, D32)", () => {
  it("re-prices only the edited line, moves the reservation, and a raised total blocks approval until the retailer accepts", async () => {
    const o = await place([{ skuId: biscuit, paidCases: 9 }, { skuId: detergent, paidCases: 2 }]);
    const line = o.lines.find((l) => l.skuId === biscuit)!;
    const r = await editOrderLine(db, desk, { orderId: o.id, version: o.version, lineId: line.id, paidCases: 10 }, NOW);
    expect(r).toMatchObject({ outcome: "DONE", awaitingRetailerAck: true });
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { lines: true } });
    expect(after.lines.find((l) => l.id === line.id)).toMatchObject({ paidCases: 10, freeCases: 1, taxablePaise: 777_600 });
    expect(after.totalPaise).toBe(after.lines.reduce((s, l) => s + l.lineTotalPaise, 0));
    expect(after.originalTotalPaise).toBe(o.totalPaise);
    expect(await stock(biscuit)).toEqual({ stockCases: 340, reservedCases: 11 });

    expect(await decide(o.id, "APPROVE")).toEqual({ outcome: "AWAITING_RETAILER" });
    expect(await acceptChanges(db, { userId: A.user.id, retailerId: A.retailer.id }, o.id, NOW)).toEqual({ accepted: true });
    expect(await decide(o.id, "APPROVE")).toEqual({ outcome: "DONE", status: "APPROVED" });
    const types = (await db.orderEvent.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "asc" } })).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["LINE_EDITED", "ACK_REQUESTED", "ACK_ACCEPTED", "STATUS_CHANGED"]));
  });

  it("a lower quantity releases stock and needs no acknowledgement; the last line can't be removed", async () => {
    const o = await place([{ skuId: biscuit, paidCases: 5 }, { skuId: detergent, paidCases: 2 }]);
    const d = o.lines.find((l) => l.skuId === detergent)!;
    expect(await editOrderLine(db, desk, { orderId: o.id, version: o.version, lineId: d.id, paidCases: 0 }, NOW)).toMatchObject({ outcome: "DONE", awaitingRetailerAck: false });
    expect(await stock(detergent)).toEqual({ stockCases: 85, reservedCases: 0 });
    const b = o.lines.find((l) => l.skuId === biscuit)!;
    await expect(editOrderLine(db, desk, { orderId: o.id, version: await version(o.id), lineId: b.id, paidCases: 0 }, NOW)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("refuses more than the stock allows, changing nothing", async () => {
    const o = await place([{ skuId: detergent, paidCases: 2 }]);
    expect(await editOrderLine(db, desk, { orderId: o.id, version: o.version, lineId: o.lines[0].id, paidCases: 200 }, NOW)).toEqual({ outcome: "STOCK_SHORT" });
    expect(await stock(detergent)).toEqual({ stockCases: 85, reservedCases: 2 });
  });

  it("refuses to edit an approved order", async () => {
    const o = await place([{ skuId: detergent, paidCases: 2 }]);
    await decide(o.id, "APPROVE");
    await expect(editOrderLine(db, desk, { orderId: o.id, version: await version(o.id), lineId: o.lines[0].id, paidCases: 3 }, NOW)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });
});

describe("Tally export (D29)", () => {
  it("exports approved orders once, stores the CSV, and a concurrent second export finds nothing", async () => {
    const a = await place([{ skuId: biscuit, paidCases: 10 }]);
    const b = await place([{ skuId: detergent, paidCases: 5 }]);
    const held = await place([{ skuId: detergent, paidCases: 1 }]); // stays PENDING_REVIEW: not eligible
    await decide(a.id, "APPROVE");
    await decide(b.id, "APPROVE");
    const preview = await exportPreview(db);
    expect(preview).toEqual({ orderCount: 2, totalPaise: a.totalPaise + b.totalPaise });

    const [one, two] = await Promise.all([createExportBatch(db, desk, preview, NOW), createExportBatch(db, desk, preview, NOW)]);
    const outcomes = [one.outcome, two.outcome].sort();
    expect(outcomes).toEqual(["EXPORTED", "NOTHING_TO_EXPORT"]);
    const batches = await db.exportBatch.findMany({ include: { orders: true } });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ orderCount: 2, totalPaise: preview.totalPaise });
    expect(batches[0].csv.trimEnd().split("\r\n")).toHaveLength(3);
    expect((await db.order.findUniqueOrThrow({ where: { id: held.id } })).status).toBe("PENDING_REVIEW");
    expect(await db.order.count({ where: { status: "EXPORTED" } })).toBe(2);
    expect(await createExportBatch(db, desk, preview, NOW)).toEqual({ outcome: "NOTHING_TO_EXPORT" });
  });

  it("refuses when the set changed since the desk looked, and marks nothing", async () => {
    const a = await place([{ skuId: biscuit, paidCases: 10 }]);
    await decide(a.id, "APPROVE");
    const stale = await exportPreview(db);
    const b = await place([{ skuId: detergent, paidCases: 5 }]);
    await decide(b.id, "APPROVE");
    expect(await createExportBatch(db, desk, stale, NOW)).toMatchObject({ outcome: "CHANGED", preview: { orderCount: 2 } });
    expect(await db.exportBatch.count()).toBe(0);
    expect(await db.order.count({ where: { status: "EXPORTED" } })).toBe(0);
  });

  it("an order that doesn't reconcile aborts the whole batch: no batch, no EXPORTED status", async () => {
    const a = await place([{ skuId: biscuit, paidCases: 10 }]);
    await decide(a.id, "APPROVE");
    await db.order.update({ where: { id: a.id }, data: { totalPaise: { increment: 1 } } }); // corrupt the frozen total
    await expect(createExportBatch(db, desk, await exportPreview(db), NOW)).rejects.toThrow(/does not reconcile/);
    expect(await db.exportBatch.count()).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("APPROVED");
  });
});
