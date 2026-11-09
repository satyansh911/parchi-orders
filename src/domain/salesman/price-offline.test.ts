import { describe, expect, it } from "vitest";
import type { PackShop, PackSku } from "./pack";
import { priceOfflineOrder } from "./price-offline";

const NOW = new Date("2026-11-09T06:00:00Z");
const biscuit: PackSku = {
  id: "b", code: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", nameHi: "ग्लूकोज़", active: true, dealerPricePaise: 810, dealerPriceUnit: "PIECE", piecesPerCase: 96, gstBps: 500,
  schemes: [{ id: "s", type: "FREE_GOODS", buyCases: 10, freeCases: 1, labelEn: "Buy 10 get 1", labelHi: "", active: true, startsAt: null, endsAt: null }],
  packSize: "75 g", brand: "Rewa", imageKey: "box", categoryEn: "Biscuits", categoryHi: "बिस्कुट", mrpPaise: null, availableCases: 22,
};
const shop: PackShop = {
  id: "r", code: "R-1", shopName: "Shop", ownerName: "O", area: "A", phone: null, tierName: "Standard", tierDiscountBps: 0, lastOrderAt: null,
  credit: { limitPaise: 1_000_000, outstandingPaise: 0, openOrdersPaise: 0, availablePaise: 1_000_000, alreadyOverPaise: 0 },
};
const none = { skuCases: new Map<string, number>(), shopPaise: 0 };

describe("offline pricing on the phone (D108)", () => {
  it("prices with the same engine: 10 cases → 1 free, case price ₹777.60 + 5% GST", () => {
    const p = priceOfflineOrder([biscuit], shop, [{ skuId: "b", paidCases: 10 }], none, NOW);
    expect(p.lines[0]).toMatchObject({ status: "OK", line: { freeCases: 1, taxablePaise: 777_600, gstPaise: 38_880 } });
    expect(p.expectation).toEqual({ lines: [{ skuId: "b", paidCases: 10, freeCases: 1, lineTotalPaise: 816_480 }], totalPaise: 816_480, hold: false });
  });

  it("counts stock already promised to orders in the outbox", () => {
    const p = priceOfflineOrder([biscuit], shop, [{ skuId: "b", paidCases: 10 }], { skuCases: new Map([["b", 12]]), shopPaise: 0 }, NOW);
    expect(p.lines[0]).toMatchObject({ status: "STOCK_SHORT", maxPaidCases: 9 }); // 10 left: 10 + 1 free doesn't fit
    expect(p.expectation).toBeNull();
  });

  it("counts credit already used by orders in the outbox", () => {
    const p = priceOfflineOrder([biscuit], shop, [{ skuId: "b", paidCases: 10 }], { skuCases: new Map(), shopPaise: 500_000 }, NOW);
    expect(p.credit).toMatchObject({ hold: true, overByPaise: 316_480 });
    expect(p.expectation?.hold).toBe(true);
  });
});
