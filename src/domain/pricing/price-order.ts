// Prices a whole order: validates it, prices each line with priceLine and sums
// the rounded line values (D6). Order total = sum of line totals.

import { DomainError } from "../errors";
import { MAX_LINES_PER_ORDER, MAX_ORDER_TOTAL_PAISE } from "./limits";
import { priceLine, type LineInput, type PriceLineOptions, type PricedLine, type PricingContext } from "./price-line";

export type OrderLineInput = LineInput & { options?: PriceLineOptions };

export type PricedOrder = {
  lines: PricedLine[];
  taxablePaise: number;
  discountPaise: number;
  gstPaise: number;
  totalPaise: number;
};

export function priceOrder(lines: readonly OrderLineInput[], ctx: PricingContext): PricedOrder {
  if (lines.length === 0) throw new DomainError("EMPTY_ORDER", "an order needs at least one line");
  if (lines.length > MAX_LINES_PER_ORDER) {
    throw new DomainError("TOO_MANY_LINES", `an order can have at most ${MAX_LINES_PER_ORDER} lines, got ${lines.length}`);
  }
  assertNoDuplicateSkus(lines);

  const priced = lines.map(({ options, ...line }) => priceLine(line, ctx, options));
  const sum = (pick: (l: PricedLine) => number) => priced.reduce((total, l) => total + pick(l), 0);

  const order: PricedOrder = {
    lines: priced,
    taxablePaise: sum((l) => l.taxablePaise),
    discountPaise: sum((l) => l.discountPaise),
    gstPaise: sum((l) => l.gstPaise),
    totalPaise: sum((l) => l.lineTotalPaise),
  };
  if (order.totalPaise > MAX_ORDER_TOTAL_PAISE) {
    throw new DomainError("ORDER_TOO_LARGE", "order total is above the ₹1 crore limit");
  }
  return order;
}

/** D48: one line per SKU; merging could silently cross a scheme threshold. */
function assertNoDuplicateSkus(lines: readonly OrderLineInput[]): void {
  const seen = new Set<string>();
  for (const { sku } of lines) {
    if (seen.has(sku.id)) throw new DomainError("DUPLICATE_SKU", `${sku.code} appears on more than one line`);
    seen.add(sku.id);
  }
}
