import { describe, expect, it } from "vitest";
import { priceOrder } from "../../src/domain/pricing/price-order";
import type { CatalogueSku } from "../../src/domain/pricing/price-line";
import type { Scheme } from "../../src/domain/schemes/types";
import { BRIEF_SKU_CODES, DEMO_GST_BPS, SCHEMES, SKUS } from "./catalogue";
import { planPastOrders } from "./past-orders";
import { RETAILERS, TIERS } from "./people";

const plans = planPastOrders();
const DEMO_START = new Date("2026-11-08T00:00:00+05:30");

// Test-only: seed data in the engine's shape (the real seed reads it back from the DB).
const catalogue = new Map<string, CatalogueSku>(
  SKUS.map((s) => [
    s.code,
    {
      id: s.code, code: s.code, nameEn: s.nameEn, nameHi: s.nameHi, active: true,
      dealerPricePaise: s.dealerPricePaise, dealerPriceUnit: "PIECE", piecesPerCase: s.piecesPerCase,
      gstBps: DEMO_GST_BPS[s.category],
      schemes: SCHEMES.filter((x) => x.skuCode === s.code).map(
        (x, i): Scheme => ({ ...x, id: `${s.code}-${i}`, active: true, startsAt: x.startsAt ?? null, endsAt: x.endsAt ?? null }),
      ),
    },
  ]),
);

describe("past order plan (D36)", () => {
  it("is deterministic", () => {
    expect(planPastOrders()).toEqual(plans);
  });

  it("gives every retailer 3–6 orders", () => {
    for (const r of RETAILERS) {
      const n = plans.filter((p) => p.retailerCode === r.code).length;
      expect(n, r.code).toBeGreaterThanOrEqual(3);
      expect(n, r.code).toBeLessThanOrEqual(6);
    }
  });

  it("places every order before the demo starts, in IST shop hours", () => {
    for (const p of plans) {
      expect(p.placedAt.getTime()).toBeLessThan(DEMO_START.getTime());
      const istHour = (p.placedAt.getUTCHours() + 5.5 + p.placedAt.getUTCMinutes() / 60) % 24;
      expect(istHour).toBeGreaterThanOrEqual(9);
      expect(istHour).toBeLessThan(20);
    }
  });

  it("uses known SKUs, one line per SKU, 1–3 lines of 1–3 cases (D52)", () => {
    for (const p of plans) {
      const codes = p.lines.map((l) => l.skuCode);
      expect(new Set(codes).size).toBe(codes.length);
      expect(p.lines.length).toBeGreaterThanOrEqual(1);
      expect(p.lines.length).toBeLessThanOrEqual(3);
      for (const l of p.lines) {
        expect(catalogue.has(l.skuCode)).toBe(true);
        expect([1, 2, 3]).toContain(l.paidCases);
      }
    }
  });

  it("gives the main demo retailer a history with all three brief SKUs (D10)", () => {
    const ordered = new Set(plans.filter((p) => p.retailerCode === "R-0001").flatMap((p) => p.lines.map((l) => l.skuCode)));
    for (const code of BRIEF_SKU_CODES) expect(ordered.has(code), code).toBe(true);
  });

  it("gives R-0003 tea dust, not tea leaf, so history can disambiguate 'chai patti 250'", () => {
    const ordered = new Set(plans.filter((p) => p.retailerCode === "R-0003").flatMap((p) => p.lines.map((l) => l.skuCode)));
    expect(ordered.has("SKU-TD-250")).toBe(true);
    expect(ordered.has("SKU-TE-250")).toBe(false);
  });

  it("prices every planned order with the domain engine at the retailer's tier and order date", () => {
    const tierOf = new Map(RETAILERS.map((r) => [r.code, TIERS.find((t) => t.code === r.tier)!.discountBps]));
    const totals = plans.map((p) => {
      const order = priceOrder(
        p.lines.map((l) => ({ sku: catalogue.get(l.skuCode)!, paidCases: l.paidCases })),
        { tierDiscountBps: tierOf.get(p.retailerCode)!, now: p.placedAt },
      );
      expect(order.totalPaise).toBe(order.lines.reduce((sum, l) => sum + l.lineTotalPaise, 0));
      return order.totalPaise;
    });
    // Typical kirana orders (D52): the median stays within a few thousand rupees of the brief's ₹5,000.
    const median = [...totals].sort((a, b) => a - b)[Math.floor(totals.length / 2)];
    expect(median).toBeGreaterThan(200_000); // ₹2,000
    expect(median).toBeLessThan(1_500_000); // ₹15,000
  });
});
