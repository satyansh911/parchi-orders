// What a retailer may see about stock (D26): "In stock", "Only N cases left"
// when 20 or fewer are available, or "Out of stock". Exact quantities above
// 20 are never exposed. `available` = stock - reserved (D4).

export const LOW_STOCK_THRESHOLD = 20;

export type StockBand =
  | { status: "IN_STOCK" }
  | { status: "LOW"; casesLeft: number }
  | { status: "OUT" };

export function stockBand(availableCases: number): StockBand {
  if (!Number.isSafeInteger(availableCases) || availableCases <= 0) return { status: "OUT" };
  if (availableCases <= LOW_STOCK_THRESHOLD) return { status: "LOW", casesLeft: availableCases };
  return { status: "IN_STOCK" };
}
