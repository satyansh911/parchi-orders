// Cart preview on real Postgres (test branch only, D49).
import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { priceCart, type CartLineInput, type CartLineResult } from "./price-cart";
import { verifyQuote } from "./quote";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
const NOW = new Date("2026-11-09T06:00:00Z");
const KEY = randomBytes(32);

let ids: Record<string, string>;
let retailer: { id: string; tierDiscountBps: number };

async function sku(code: string, f: { piecesPerCase: number; dealerPricePaise: number; gstBps: number; stockCases: number; active?: boolean }) {
  const brand = await db.brand.upsert({ where: { name: "Rewa Foods" }, update: {}, create: { name: "Rewa Foods" } });
  const category = await db.category.upsert({ where: { slug: "biscuits" }, update: {}, create: { slug: "biscuits", nameEn: "Biscuits", nameHi: "बिस्कुट", sortOrder: 1 } });
  return db.sku.create({ data: { code, nameEn: code, nameHi: code, brandId: brand.id, categoryId: category.id, packSize: "1", imageKey: "box", ...f } });
}

beforeEach(async () => {
  await resetTestDatabase(db);
  const biscuit = await sku("SKU-BS-075", { piecesPerCase: 96, dealerPricePaise: 810, gstBps: 500, stockCases: 340 });
  const cream = await sku("SKU-CR-100", { piecesPerCase: 60, dealerPricePaise: 2_430, gstBps: 500, stockCases: 50 });
  const detergent = await sku("SKU-DT-1KG", { piecesPerCase: 20, dealerPricePaise: 10_150, gstBps: 1800, stockCases: 85 });
  const tea = await sku("SKU-TE-250", { piecesPerCase: 40, dealerPricePaise: 11_800, gstBps: 500, stockCases: 0 });
  const old = await sku("SKU-OLD", { piecesPerCase: 10, dealerPricePaise: 100, gstBps: 500, stockCases: 10, active: false });
  await db.scheme.createMany({
    data: [
      { skuId: biscuit.id, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" },
      { skuId: cream.id, type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "10 पर 1" },
      { skuId: cream.id, type: "SLAB_DISCOUNT", minCases: 5, discountBps: 300, labelEn: "3% off 5+", labelHi: "5+ पर 3%" },
      { skuId: detergent.id, type: "SLAB_DISCOUNT", minCases: 5, discountBps: 300, labelEn: "3% off 5+", labelHi: "5+ पर 3%" },
    ],
  });
  ids = { biscuit: biscuit.id, cream: cream.id, detergent: detergent.id, tea: tea.id, old: old.id };
  const r = await makeRetailer(db, "R-A", "9999900101", { creditLimitPaise: 10_000_000, outstandingPaise: 3_240_000 });
  retailer = { id: r.retailer.id, tierDiscountBps: 0 };
});

const price = (lines: CartLineInput[]) => priceCart({ db, key: KEY, now: NOW }, retailer, lines);
const only = (lines: CartLineResult[]) => lines[0];

describe("priceCart", () => {
  it("prices an OK line with the engine, adds the nudge, and signs a verifiable quote", async () => {
    const { preview, digest } = await price([{ skuId: ids.biscuit, paidCases: 7 }]);
    expect(only(preview.lines)).toMatchObject({ status: "OK", line: { paidCases: 7, taxablePaise: 544_320, gstPaise: 27_216 }, nudge: { addCases: 3, freeCases: 1 } });
    expect(preview.problem).toBeNull();
    expect(verifyQuote(preview.quote!, KEY, { retailerId: retailer.id, now: NOW })).toEqual({ ok: true, digest });
  });

  it("offers the D18 choices when free goods don't fit (cream biscuit, 50 of 50)", async () => {
    const { preview } = await price([{ skuId: ids.cream, paidCases: 50 }]);
    expect(only(preview.lines)).toMatchObject({
      status: "STOCK_SHORT",
      reason: "FREE_GOODS_DONT_FIT",
      options: [
        { kind: "WITH_FREE_GOODS", choice: "BEST", paidCases: 46, freeCases: 4 },
        { kind: "WITHOUT_FREE_GOODS", choice: "WITHOUT_FREE_GOODS", paidCases: 50, freeCases: 0, discountBps: 300 },
      ],
    });
    expect(preview.quote).toBeNull();
    expect(preview.problem).toBe("LINES_NEED_ATTENTION");
  });

  it("accepts the 'without free goods' choice only when free goods really don't fit (D34, D47)", async () => {
    const chosen = await price([{ skuId: ids.cream, paidCases: 50, choice: "WITHOUT_FREE_GOODS" }]);
    expect(only(chosen.preview.lines)).toMatchObject({ status: "OK", selection: "WITHOUT_FREE_GOODS_STOCK_SHORT", line: { freeCases: 0, discountBps: 300 } });
    const stale = await price([{ skuId: ids.biscuit, paidCases: 10, choice: "WITHOUT_FREE_GOODS" }]);
    expect(only(stale.preview.lines)).toMatchObject({ status: "OFFER_CHANGED", current: { freeCases: 1 } });
    expect(stale.preview.quote).toBeNull();
  });

  it("flags out-of-stock, inactive and unknown SKUs, and never quotes such a cart", async () => {
    const { preview } = await price([{ skuId: ids.tea, paidCases: 1 }, { skuId: ids.old, paidCases: 1 }, { skuId: "no-such-sku", paidCases: 1 }, { skuId: ids.biscuit, paidCases: 2 }]);
    expect(preview.lines.map((l) => l.status)).toEqual(["OUT_OF_STOCK", "INACTIVE", "UNKNOWN", "OK"]);
    expect(preview.totals.totalPaise).toBe(163_296); // only the OK biscuit line: 2 × 77,760 + 5%
    expect(preview.quote).toBeNull();
  });

  it("splits GST by rate and sums totals from rounded lines (D6)", async () => {
    const { preview } = await price([{ skuId: ids.biscuit, paidCases: 5 }, { skuId: ids.detergent, paidCases: 2 }]);
    expect(preview.totals).toMatchObject({ taxablePaise: 794_800, gstPaise: 92_520, totalPaise: 887_320, gstByRate: [{ gstBps: 500, gstPaise: 19_440 }, { gstBps: 1800, gstPaise: 73_080 }] });
  });

  it("reports the credit outcome, and an over-limit cart still gets a quote that records the hold (D79)", async () => {
    // Available: ₹1,00,000 − ₹32,400 = ₹67,600. 10 detergent cases ≈ ₹23,268 fits; 30 doesn't.
    const fits = await price([{ skuId: ids.detergent, paidCases: 10 }]);
    expect(fits.preview.credit).toMatchObject({ hold: false, overByPaise: 0, availablePaise: 6_760_000 });
    const over = await price([{ skuId: ids.detergent, paidCases: 30 }]);
    expect(over.preview.credit.hold).toBe(true);
    expect(over.preview.credit.overByPaise).toBe(over.preview.totals.totalPaise - 6_760_000);
    expect(over.preview.quote).not.toBeNull();
  });

  it("is EMPTY for an empty cart", async () => {
    expect((await price([])).preview).toMatchObject({ problem: "EMPTY", quote: null });
  });

  it("never sends exact stock for lines that fit (D26)", async () => {
    const { preview } = await price([{ skuId: ids.biscuit, paidCases: 2 }, { skuId: ids.detergent, paidCases: 2 }]);
    expect(JSON.stringify(preview)).not.toMatch(/stockCases|reservedCases|\b340\b|\b85\b/);
  });
});
