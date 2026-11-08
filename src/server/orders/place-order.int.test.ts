// Order placement on real Postgres (test branch only, D49).
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { priceCart, type CartLineInput } from "../cart/price-cart";
import { QUOTE_TTL_MS, signQuote } from "../cart/quote";
import { makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { placeOrder, type PlaceOrderResult } from "./place-order";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
const KEY = randomBytes(32);
const T0 = new Date("2026-11-09T06:00:00Z");

type R = Awaited<ReturnType<typeof makeRetailer>>;
let ids: Record<"biscuit" | "detergent" | "cream" | "small", string>;
let A: R;
let B: R;

async function sku(code: string, f: { piecesPerCase: number; dealerPricePaise: number; gstBps: number; stockCases: number }) {
  const brand = await db.brand.upsert({ where: { name: "Rewa Foods" }, update: {}, create: { name: "Rewa Foods" } });
  const category = await db.category.upsert({ where: { slug: "biscuits" }, update: {}, create: { slug: "biscuits", nameEn: "Biscuits", nameHi: "बिस्कुट", sortOrder: 1 } });
  return db.sku.create({ data: { code, nameEn: code, nameHi: `${code} हिं`, brandId: brand.id, categoryId: category.id, packSize: "1", imageKey: "box", ...f } });
}

beforeEach(async () => {
  await resetTestDatabase(db);
  const biscuit = await sku("SKU-BS-075", { piecesPerCase: 96, dealerPricePaise: 810, gstBps: 500, stockCases: 340 });
  const detergent = await sku("SKU-DT-1KG", { piecesPerCase: 20, dealerPricePaise: 10_150, gstBps: 1800, stockCases: 85 });
  const cream = await sku("SKU-CR-100", { piecesPerCase: 60, dealerPricePaise: 2_430, gstBps: 500, stockCases: 50 });
  const small = await sku("SKU-SMALL", { piecesPerCase: 10, dealerPricePaise: 1_000, gstBps: 500, stockCases: 10 });
  await db.scheme.createMany({
    data: [
      { skuId: biscuit.id, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" },
      { skuId: cream.id, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" },
      { skuId: cream.id, type: "SLAB_DISCOUNT", minCases: 5, discountBps: 300, labelEn: "3% off 5+", labelHi: "5+ पर 3%" },
      { skuId: detergent.id, type: "SLAB_DISCOUNT", minCases: 5, discountBps: 300, labelEn: "3% off 5+", labelHi: "5+ पर 3%", endsAt: new Date("2026-11-09T12:00:00Z") },
    ],
  });
  ids = { biscuit: biscuit.id, detergent: detergent.id, cream: cream.id, small: small.id };
  A = await makeRetailer(db, "R-A", "9999900101", { creditLimitPaise: 10_000_000, outstandingPaise: 3_240_000 }); // ₹67,600 available
  B = await makeRetailer(db, "R-B", "9999900102", { creditLimitPaise: 10_000_000, outstandingPaise: 0 });
});

const who = (r: R) => ({ userId: r.user.id, retailerId: r.retailer.id });
const preview = async (r: R, lines: CartLineInput[], now = T0) =>
  (await priceCart({ db, key: KEY, now }, { id: r.retailer.id, tierDiscountBps: r.retailer.tier.discountBps }, lines)).preview;
const place = (r: R, input: { lines: CartLineInput[]; quote: string; clientRequestId?: string; confirmCreditHold?: boolean }, now = T0) =>
  placeOrder({ db, key: KEY, now }, who(r), { clientRequestId: input.clientRequestId ?? randomUUID(), confirmCreditHold: input.confirmCreditHold ?? false, lines: input.lines, quote: input.quote });
const stock = async (id: string) => db.sku.findUniqueOrThrow({ where: { id }, select: { stockCases: true, reservedCases: true } });
const placed = (r: PlaceOrderResult) => (r.outcome === "PLACED" ? r : null);

describe("placing an order", () => {
  it("creates the order with frozen lines, reserves paid + free stock, and records the event", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 10 }, { skuId: ids.detergent, paidCases: 2 }];
    const p = await preview(A, lines);
    const result = await place(A, { lines, quote: p.quote! });
    expect(result).toMatchObject({ outcome: "PLACED", status: "PENDING_REVIEW", alreadyPlaced: false });
    const order = await db.order.findUniqueOrThrow({ where: { id: placed(result)!.orderId }, include: { lines: true, events: true } });
    expect(order).toMatchObject({ retailerId: A.retailer.id, source: "CATALOGUE", totalPaise: p.totals.totalPaise, originalTotalPaise: p.totals.totalPaise });
    const biscuitLine = order.lines.find((l) => l.skuId === ids.biscuit)!;
    expect(biscuitLine).toMatchObject({ paidCases: 10, freeCases: 1, casePricePaise: 77_760, lineTotalPaise: 816_480, appliedLabel: "Buy 10 get 1", offerSelection: "BEST_OFFER", nameHi: "SKU-BS-075 हिं" });
    expect(await stock(ids.biscuit)).toEqual({ stockCases: 340, reservedCases: 11 });
    expect(order.events.map((e) => e.type)).toEqual(["PLACED"]);
  });

  it("places 'without free goods' when the retailer chose it because free goods don't fit", async () => {
    const lines = [{ skuId: ids.cream, paidCases: 50, choice: "WITHOUT_FREE_GOODS" as const }];
    // ≈ ₹74,249 incl. GST: above R-A's ₹67,600 available, so R-A gets a credit confirmation…
    expect(await place(A, { lines, quote: (await preview(A, lines)).quote! })).toMatchObject({ outcome: "NOT_PLACED", problem: "CREDIT_CONFIRMATION_REQUIRED" });
    // …while R-B (₹1,00,000 available) places it directly.
    const p = await preview(B, lines);
    const result = await place(B, { lines, quote: p.quote! });
    const line = await db.orderLine.findFirstOrThrow({ where: { orderId: placed(result)!.orderId } });
    expect(line).toMatchObject({ paidCases: 50, freeCases: 0, discountBps: 300, offerSelection: "WITHOUT_FREE_GOODS_STOCK_SHORT" });
    expect(await stock(ids.cream)).toEqual({ stockCases: 50, reservedCases: 50 });
  });
});

describe("credit (D20, D21, D79)", () => {
  const big = () => [{ skuId: ids.detergent, paidCases: 30 }]; // ≈ ₹70k > ₹67,600 available (ids exist only after beforeEach)

  it("needs explicit confirmation for an over-limit order, and creates nothing without it", async () => {
    const p = await preview(A, big());
    expect(p.credit.hold).toBe(true);
    expect(await place(A, { lines: big(), quote: p.quote! })).toMatchObject({ outcome: "NOT_PLACED", problem: "CREDIT_CONFIRMATION_REQUIRED" });
    expect(await db.order.count()).toBe(0);
    expect((await stock(ids.detergent)).reservedCases).toBe(0);
  });

  it("with confirmation, creates a CREDIT_HOLD order and a system event recording the excess", async () => {
    const p = await preview(A, big());
    const result = await place(A, { lines: big(), quote: p.quote!, confirmCreditHold: true });
    expect(result).toMatchObject({ outcome: "PLACED", status: "CREDIT_HOLD" });
    const order = await db.order.findUniqueOrThrow({ where: { id: placed(result)!.orderId }, include: { events: { orderBy: { type: "asc" } } } });
    expect(order.overLimitPaise).toBe(p.credit.overByPaise);
    const system = order.events.find((e) => e.type === "STATUS_CHANGED")!;
    expect(system).toMatchObject({ actorId: null, toStatus: "CREDIT_HOLD", payload: { overByPaise: p.credit.overByPaise } });
  });

  it("a stale 'fits' quote can't bypass a hold: credit used up meanwhile → QUOTE_CHANGED, nothing created", async () => {
    const lines = [{ skuId: ids.detergent, paidCases: 20 }]; // ≈ ₹46,544: fits alone
    const p = await preview(A, lines);
    expect(p.credit.hold).toBe(false);
    const other = [{ skuId: ids.biscuit, paidCases: 30 }]; // ≈ ₹24k
    await place(A, { lines: other, quote: (await preview(A, other)).quote! });
    const result = await place(A, { lines, quote: p.quote!, confirmCreditHold: true }); // confirmation can't help a stale quote
    expect(result).toMatchObject({ outcome: "NOT_PLACED", problem: "QUOTE_CHANGED", preview: { credit: { hold: true } } });
    expect(await db.order.count()).toBe(1);
  });

  it("never counts the current order twice: exactly the available amount is not held", async () => {
    await db.retailer.update({ where: { id: A.retailer.id }, data: { creditLimitPaise: 3_240_000 + 163_296 } }); // available = 2 biscuit cases incl. GST
    const lines = [{ skuId: ids.biscuit, paidCases: 2 }];
    const p = await preview(A, lines);
    expect(p.credit).toMatchObject({ availablePaise: 163_296, hold: false });
    expect(await place(A, { lines, quote: p.quote! })).toMatchObject({ outcome: "PLACED", status: "PENDING_REVIEW" });
  });
});

describe("idempotency (D16, D76)", () => {
  it("a retried request returns the same order and reserves stock once", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 10 }];
    const p = await preview(A, lines);
    const clientRequestId = randomUUID();
    const first = await place(A, { lines, quote: p.quote!, clientRequestId });
    const retry = await place(A, { lines, quote: p.quote!, clientRequestId });
    expect(retry).toEqual({ ...first, alreadyPlaced: true });
    expect(await db.order.count()).toBe(1);
    expect((await stock(ids.biscuit)).reservedCases).toBe(11);
  });

  it("10 simultaneous submissions with the same ID create exactly one order", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 10 }];
    const p = await preview(A, lines);
    const clientRequestId = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, () => place(A, { lines, quote: p.quote!, clientRequestId })));
    expect(new Set(results.map((r) => placed(r)?.orderId)).size).toBe(1);
    expect(results.filter((r) => placed(r)?.alreadyPlaced === false)).toHaveLength(1);
    expect(await db.order.count()).toBe(1);
    expect((await stock(ids.biscuit)).reservedCases).toBe(11);
  });

  it("returns an already-placed order even after its quote has expired", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 1 }];
    const p = await preview(A, lines);
    const clientRequestId = randomUUID();
    await place(A, { lines, quote: p.quote!, clientRequestId });
    const later = new Date(T0.getTime() + QUOTE_TTL_MS + 60_000);
    expect(await place(A, { lines, quote: p.quote!, clientRequestId }, later)).toMatchObject({ outcome: "PLACED", alreadyPlaced: true });
  });

  it("refuses another retailer's request ID without revealing anything", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 1 }];
    const clientRequestId = randomUUID();
    await place(A, { lines, quote: (await preview(A, lines)).quote!, clientRequestId });
    expect(await place(B, { lines, quote: (await preview(B, lines)).quote!, clientRequestId })).toEqual({ outcome: "REJECTED" });
    expect(await db.order.count()).toBe(1);
  });
});

describe("concurrency", () => {
  it("two retailers racing for the last 10 cases: exactly one wins, the other gets STOCK_CHANGED", async () => {
    const lines = [{ skuId: ids.small, paidCases: 6 }];
    const [pa, pb] = await Promise.all([preview(A, lines), preview(B, lines)]);
    const results = await Promise.all([place(A, { lines, quote: pa.quote! }), place(B, { lines, quote: pb.quote! })]);
    expect(results.filter((r) => r.outcome === "PLACED")).toHaveLength(1);
    const loser = results.find((r) => r.outcome === "NOT_PLACED")!;
    expect(loser).toMatchObject({ problem: "STOCK_CHANGED", preview: { lines: [{ status: "STOCK_SHORT" }] } });
    expect(await stock(ids.small)).toEqual({ stockCases: 10, reservedCases: 6 });
  });

  it("one shop, two simultaneous orders that fit alone but not together: one placed, the other must re-confirm", async () => {
    const lines1 = [{ skuId: ids.detergent, paidCases: 15 }]; // ≈ ₹35k each, ₹67.6k available
    const lines2 = [{ skuId: ids.detergent, paidCases: 14 }, { skuId: ids.biscuit, paidCases: 1 }];
    const [p1, p2] = await Promise.all([preview(A, lines1), preview(A, lines2)]);
    expect(p1.credit.hold || p2.credit.hold).toBe(false);
    const results = await Promise.all([place(A, { lines: lines1, quote: p1.quote! }), place(A, { lines: lines2, quote: p2.quote! })]);
    expect(results.filter((r) => r.outcome === "PLACED")).toHaveLength(1);
    expect(results.find((r) => r.outcome === "NOT_PLACED")).toMatchObject({ problem: "QUOTE_CHANGED", preview: { credit: { hold: true } } });
  });
});

describe("the quote must match what is charged (D75)", () => {
  it("a scheme that expired between preview and placement → QUOTE_CHANGED, nothing created", async () => {
    const lines = [{ skuId: ids.detergent, paidCases: 5 }];
    const p = await preview(A, lines); // 3% slab active until 12:00
    const result = await place(A, { lines, quote: p.quote! }, new Date("2026-11-09T12:05:00Z"));
    expect(result).toMatchObject({ outcome: "NOT_PLACED", problem: "QUOTE_CHANGED", preview: { totals: { discountPaise: 0 } } });
    expect(await db.order.count()).toBe(0);
  });

  it("a tier price change between preview and placement → QUOTE_CHANGED", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 2 }];
    const p = await preview(A, lines);
    await db.priceTier.update({ where: { id: A.retailer.tier.id }, data: { discountBps: 200 } });
    expect(await place(A, { lines, quote: p.quote! })).toMatchObject({ outcome: "NOT_PLACED", problem: "QUOTE_CHANGED" });
  });

  it("rejects another retailer's quote, a tampered quote and an expired quote", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 2 }];
    const pa = await preview(A, lines);
    expect(await place(B, { lines, quote: pa.quote! })).toMatchObject({ problem: "QUOTE_CHANGED" });
    const tampered = pa.quote!.slice(0, -3) + (pa.quote!.endsWith("A") ? "BBB" : "AAA");
    expect(await place(A, { lines, quote: tampered })).toMatchObject({ problem: "QUOTE_CHANGED" });
    expect(await place(A, { lines, quote: pa.quote! }, new Date(T0.getTime() + QUOTE_TTL_MS + 1))).toMatchObject({ problem: "QUOTE_CHANGED" });
    expect(await db.order.count()).toBe(0);
  });

  it("rejects a quote for a different cart, even if correctly signed", async () => {
    const quoted = [{ skuId: ids.biscuit, paidCases: 2 }];
    const p = await preview(A, quoted);
    expect(await place(A, { lines: [{ skuId: ids.biscuit, paidCases: 20 }], quote: p.quote! })).toMatchObject({ problem: "QUOTE_CHANGED" });
  });

  it("a hand-made quote with an invented digest is useless without the key", async () => {
    const lines = [{ skuId: ids.biscuit, paidCases: 2 }];
    const forged = signQuote({ retailerId: A.retailer.id, lines: [], totals: { taxablePaise: 0, discountPaise: 0, gstPaise: 0, totalPaise: 0 }, credit: { hold: false, overByPaise: 0 } }, randomBytes(32), T0);
    expect(await place(A, { lines, quote: forged })).toMatchObject({ problem: "QUOTE_CHANGED" });
  });
});
