// Stock reservation primitives (D4, D24). Always called inside the order's
// database transaction.
//
// Correctness under concurrency:
// - Each change is ONE conditional UPDATE, e.g.
//     UPDATE "Sku" SET reserved = reserved + n WHERE id = $id AND stock - reserved >= n
//   Postgres takes a row lock and re-checks the WHERE after any concurrent
//   update commits, so two orders can never both take the last cases.
// - Rows are always updated in skuId order, so two transactions touching the
//   same SKUs lock them in the same order and cannot deadlock.
// - Any shortfall throws, which rolls back the whole transaction (all-or-nothing).
// - CHECK constraints (0 <= reserved <= stock) back this up in the database.

import type { Prisma } from "@/generated/prisma/client";

/** Cases to move for one SKU: paid + free (free goods consume stock, C.11). */
export type StockItem = { skuId: string; cases: number };

/** The parts of a Prisma transaction client these functions use. */
type Tx = Pick<Prisma.TransactionClient, "$executeRaw">;

export class StockShortError extends Error {
  constructor(readonly skuIds: string[]) {
    super(`Not enough stock for ${skuIds.length} SKU(s)`);
    this.name = "StockShortError";
  }
}

export class StockInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockInvariantError";
  }
}

/** Placement: reserve paid + free cases for every line, or none (D4). */
export async function reserveStock(tx: Tx, items: readonly StockItem[]): Promise<void> {
  const short: string[] = [];
  for (const { skuId, cases } of normalise(items)) {
    const updated = await tx.$executeRaw`
      UPDATE "Sku" SET "reservedCases" = "reservedCases" + ${cases}
      WHERE id = ${skuId} AND "stockCases" - "reservedCases" >= ${cases}`;
    if (updated === 0) short.push(skuId);
  }
  if (short.length > 0) throw new StockShortError(short);
}

/** Cancel or reject before approval: give the reservation back. */
export async function releaseReservation(tx: Tx, items: readonly StockItem[]): Promise<void> {
  for (const { skuId, cases } of normalise(items)) {
    const updated = await tx.$executeRaw`
      UPDATE "Sku" SET "reservedCases" = "reservedCases" - ${cases}
      WHERE id = ${skuId} AND "reservedCases" >= ${cases}`;
    if (updated === 0) throw new StockInvariantError(`release of ${cases} cases exceeds reservation on ${skuId}`);
  }
}

/** Approval: the reserved cases leave stock (D4). */
export async function deductReservedStock(tx: Tx, items: readonly StockItem[]): Promise<void> {
  for (const { skuId, cases } of normalise(items)) {
    const updated = await tx.$executeRaw`
      UPDATE "Sku" SET "stockCases" = "stockCases" - ${cases}, "reservedCases" = "reservedCases" - ${cases}
      WHERE id = ${skuId} AND "reservedCases" >= ${cases}`;
    if (updated === 0) throw new StockInvariantError(`deduct of ${cases} cases exceeds reservation on ${skuId}`);
  }
}

/** Desk cancels an approved, not yet exported order: put the goods back (D24). */
export async function restoreDeductedStock(tx: Tx, items: readonly StockItem[]): Promise<void> {
  for (const { skuId, cases } of normalise(items)) {
    const updated = await tx.$executeRaw`
      UPDATE "Sku" SET "stockCases" = "stockCases" + ${cases} WHERE id = ${skuId}`;
    if (updated === 0) throw new StockInvariantError(`unknown SKU ${skuId}`);
  }
}

/** Merge duplicates, drop zero lines, validate, and sort by skuId (fixed lock order). */
export function normalise(items: readonly StockItem[]): StockItem[] {
  const totals = new Map<string, number>();
  for (const { skuId, cases } of items) {
    if (!Number.isSafeInteger(cases) || cases < 0) {
      throw new StockInvariantError(`cases must be a non-negative integer, got ${cases} for ${skuId}`);
    }
    totals.set(skuId, (totals.get(skuId) ?? 0) + cases);
  }
  return [...totals]
    .filter(([, cases]) => cases > 0)
    .map(([skuId, cases]) => ({ skuId, cases }))
    .sort((a, b) => (a.skuId < b.skuId ? -1 : a.skuId > b.skuId ? 1 : 0));
}
