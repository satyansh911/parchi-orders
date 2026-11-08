// Retailer's own order actions on real Postgres (test branch only, D49).
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { priceCart } from "../cart/price-cart";
import { makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { placeOrder } from "./place-order";
import { addNoteForDesk, cancelOwnOrder, requestCancellation } from "./retailer-order-actions";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
const KEY = randomBytes(32);
const NOW = new Date("2026-11-09T06:00:00Z");

type R = Awaited<ReturnType<typeof makeRetailer>>;
let A: R;
let B: R;
let biscuit: string;

beforeEach(async () => {
  await resetTestDatabase(db);
  const brand = await db.brand.create({ data: { name: "Rewa Foods" } });
  const category = await db.category.create({ data: { slug: "biscuits", nameEn: "Biscuits", nameHi: "बिस्कुट", sortOrder: 1 } });
  const sku = await db.sku.create({ data: { code: "SKU-BS-075", nameEn: "Biscuit", nameHi: "बिस्कुट", brandId: brand.id, categoryId: category.id, packSize: "75 g", piecesPerCase: 96, dealerPricePaise: 810, gstBps: 500, stockCases: 340, imageKey: "box" } });
  await db.scheme.create({ data: { skuId: sku.id, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" } });
  biscuit = sku.id;
  A = await makeRetailer(db, "R-A", "9999900101", { creditLimitPaise: 10_000_000, outstandingPaise: 0 });
  B = await makeRetailer(db, "R-B", "9999900102", { creditLimitPaise: 10_000_000, outstandingPaise: 0 });
});

const who = (r: R) => ({ userId: r.user.id, retailerId: r.retailer.id });
async function placed(r: R, paidCases = 10, confirmCreditHold = false) {
  const lines = [{ skuId: biscuit, paidCases }];
  const { preview } = await priceCart({ db, key: KEY, now: NOW }, { id: r.retailer.id, tierDiscountBps: 0 }, lines);
  const result = await placeOrder({ db, key: KEY, now: NOW }, who(r), { clientRequestId: randomUUID(), lines, quote: preview.quote!, confirmCreditHold });
  if (result.outcome !== "PLACED") throw new Error(`setup failed: ${JSON.stringify(result)}`);
  return result.orderId;
}
const reserved = async () => (await db.sku.findUniqueOrThrow({ where: { id: biscuit } })).reservedCases;
const setStatus = (id: string, status: "CREDIT_HOLD" | "REVIEW_REQUIRED" | "APPROVED" | "EXPORTED") => db.order.update({ where: { id }, data: { status } });

describe("cancelOwnOrder (D77)", () => {
  it("cancels a PENDING_REVIEW order, releases paid + free stock, and records who did it", async () => {
    const id = await placed(A);
    expect(await reserved()).toBe(11);
    expect(await cancelOwnOrder(db, who(A), id, NOW)).toEqual({ status: "CANCELLED" });
    expect(await reserved()).toBe(0);
    const order = await db.order.findUniqueOrThrow({ where: { id }, include: { events: { where: { type: "STATUS_CHANGED" } } } });
    expect(order.status).toBe("CANCELLED");
    expect(order.events[0]).toMatchObject({ actorId: A.user.id, fromStatus: "PENDING_REVIEW", toStatus: "CANCELLED" });
  });

  it("releases stock exactly once when two cancels arrive together", async () => {
    const id = await placed(A);
    const other = await placed(A, 5); // keeps 5 reserved, so a double release would show
    const results = await Promise.allSettled([cancelOwnOrder(db, who(A), id, NOW), cancelOwnOrder(db, who(A), id, NOW)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "NOT_ALLOWED" });
    expect(await reserved()).toBe(5);
    expect((await db.order.findUniqueOrThrow({ where: { id: other } })).status).toBe("PENDING_REVIEW");
  });

  it("refuses held, under-review, approved and exported orders (the desk decides those)", async () => {
    for (const status of ["CREDIT_HOLD", "REVIEW_REQUIRED", "APPROVED", "EXPORTED"] as const) {
      const id = await placed(A, 1);
      await setStatus(id, status);
      await expect(cancelOwnOrder(db, who(A), id, NOW), status).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    }
  });

  it("refuses another retailer's order with NOT_FOUND and changes nothing", async () => {
    const id = await placed(B);
    await expect(cancelOwnOrder(db, who(A), id, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await reserved()).toBe(11);
  });
});

describe("requestCancellation (D77)", () => {
  it("records the request on a held order without changing status or stock", async () => {
    const id = await placed(A);
    await setStatus(id, "CREDIT_HOLD");
    expect(await requestCancellation(db, who(A), id, "Galti se order ho gaya", NOW)).toEqual({ cancelRequestedAt: NOW, alreadyRequested: false });
    const order = await db.order.findUniqueOrThrow({ where: { id }, include: { events: { where: { type: "CANCEL_REQUESTED" } } } });
    expect(order).toMatchObject({ status: "CREDIT_HOLD", cancelRequestedAt: NOW });
    expect(order.events[0]).toMatchObject({ actorId: A.user.id, reason: "Galti se order ho gaya" });
    expect(await reserved()).toBe(11);
  });

  it("records only one request when asked twice, even at the same moment", async () => {
    const id = await placed(A);
    await setStatus(id, "REVIEW_REQUIRED");
    const results = await Promise.all([requestCancellation(db, who(A), id, undefined, NOW), requestCancellation(db, who(A), id, undefined, NOW)]);
    expect(results.filter((r) => !r.alreadyRequested)).toHaveLength(1);
    expect(await db.orderEvent.count({ where: { orderId: id, type: "CANCEL_REQUESTED" } })).toBe(1);
  });

  it("is refused for a pending order (cancel it directly) and for another retailer's order", async () => {
    const mine = await placed(A);
    await expect(requestCancellation(db, who(A), mine, undefined, NOW)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    const theirs = await placed(B);
    await setStatus(theirs, "CREDIT_HOLD");
    await expect(requestCancellation(db, who(A), theirs, undefined, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("addNoteForDesk (D23)", () => {
  it("adds a note on a held or under-review order", async () => {
    const id = await placed(A);
    await setStatus(id, "REVIEW_REQUIRED");
    expect(await addNoteForDesk(db, who(A), id, "  Chai patti 250 wala hi chahiye  ", NOW)).toEqual({ sent: true });
    expect(await db.orderEvent.findFirst({ where: { orderId: id, type: "NOTE" } })).toMatchObject({ reason: "Chai patti 250 wala hi chahiye", actorId: A.user.id });
  });

  it("is refused on other statuses and on another retailer's order", async () => {
    const pending = await placed(A);
    await expect(addNoteForDesk(db, who(A), pending, "x", NOW)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    const theirs = await placed(B);
    await setStatus(theirs, "REVIEW_REQUIRED");
    await expect(addNoteForDesk(db, who(A), theirs, "x", NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
