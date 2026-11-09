// D108: price a salesman's order on the phone, with no network, using the same
// engine as the server: tier case price, best offer, free goods that must fit
// in stock, GST, and the credit decision. Stock and credit account for orders
// already waiting in his outbox, so two offline orders can't both claim the
// same last cases or the same credit.

import { creditPosition, decideCredit, type CreditDecision, type CreditPosition } from "../credit/credit";
import { expectationOf, type OfflineExpectation } from "../orders/offline-expectation";
import type { PricedLine } from "../pricing/price-line";
import { evaluateLineStock } from "../stock/line-stock";
import { packSkuToCatalogue, type PackShop, type PackSku } from "./pack";

export type OfflineLine =
  | { skuId: string; paidCases: number; status: "OK"; line: PricedLine }
  | { skuId: string; paidCases: number; status: "OUT_OF_STOCK" | "UNKNOWN" }
  | { skuId: string; paidCases: number; status: "STOCK_SHORT"; maxPaidCases: number };

export type OfflinePricing = {
  lines: OfflineLine[];
  totals: { taxablePaise: number; discountPaise: number; gstPaise: number; totalPaise: number };
  credit: CreditPosition & CreditDecision;
  /** Only when every line can be placed as shown. */
  expectation: OfflineExpectation | null;
};

export type Pending = { skuCases: ReadonlyMap<string, number>; shopPaise: number };

export function priceOfflineOrder(skus: readonly PackSku[], shop: PackShop, cart: readonly { skuId: string; paidCases: number }[], pending: Pending, now: Date): OfflinePricing {
  const byId = new Map(skus.map((s) => [s.id, s]));
  const ctx = { tierDiscountBps: shop.tierDiscountBps, now };
  const lines: OfflineLine[] = cart.map(({ skuId, paidCases }) => {
    const sku = byId.get(skuId);
    if (!sku) return { skuId, paidCases, status: "UNKNOWN" };
    const available = Math.max(0, sku.availableCases - (pending.skuCases.get(skuId) ?? 0));
    const result = evaluateLineStock({ sku: packSkuToCatalogue(sku), requestedCases: paidCases, availableCases: available, choice: "BEST" }, ctx);
    if (result.status === "OK") return { skuId, paidCases, status: "OK", line: result.line };
    if (result.status === "OUT_OF_STOCK") return { skuId, paidCases, status: "OUT_OF_STOCK" };
    if (result.status === "STOCK_SHORT") {
      const keepFree = result.options.find((o) => o.choice === "BEST");
      return { skuId, paidCases, status: "STOCK_SHORT", maxPaidCases: keepFree?.line.paidCases ?? 0 };
    }
    return { skuId, paidCases, status: "UNKNOWN" };
  });
  const ok = lines.filter((l): l is Extract<OfflineLine, { status: "OK" }> => l.status === "OK");
  const sum = (k: "taxablePaise" | "discountPaise" | "gstPaise" | "lineTotalPaise") => ok.reduce((s, l) => s + l.line[k], 0);
  const totals = { taxablePaise: sum("taxablePaise"), discountPaise: sum("discountPaise"), gstPaise: sum("gstPaise"), totalPaise: sum("lineTotalPaise") };
  const position = creditPosition({ limitPaise: shop.credit.limitPaise, outstandingPaise: shop.credit.outstandingPaise, openOrdersPaise: shop.credit.openOrdersPaise + pending.shopPaise });
  const credit = { ...position, ...decideCredit(position, totals.totalPaise) };
  const placeable = lines.length > 0 && ok.length === lines.length;
  return { lines, totals, credit, expectation: placeable ? expectationOf(ok.map((l) => l.line), totals.totalPaise, credit.hold) : null };
}
