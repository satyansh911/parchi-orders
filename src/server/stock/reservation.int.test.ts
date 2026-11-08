// Integration tests on the guarded Neon test branch (D49): real Postgres
// locking, real CHECK constraints. Run with `pnpm test:integration`.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import {
  StockInvariantError,
  StockShortError,
  deductReservedStock,
  releaseReservation,
  reserveStock,
  restoreDeductedStock,
  type StockItem,
} from "./reservation";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());

async function makeSku(code: string, stockCases: number) {
  const brand = await db.brand.upsert({ where: { name: "Test brand" }, update: {}, create: { name: "Test brand" } });
  const category = await db.category.upsert({
    where: { slug: "test" }, update: {}, create: { slug: "test", nameEn: "Test", nameHi: "टेस्ट", sortOrder: 0 },
  });
  return db.sku.create({
    data: {
      code, nameEn: code, nameHi: code, brandId: brand.id, categoryId: category.id, packSize: "1", piecesPerCase: 1,
      dealerPricePaise: 100, gstBps: 0, stockCases, imageKey: "box",
    },
  });
}
const stockOf = async (id: string) => db.sku.findUniqueOrThrow({ where: { id }, select: { stockCases: true, reservedCases: true } });
// These tests check locking, not connection-pool capacity. Bursts of 20–30
// transactions share a 10-connection pool over a ~80 ms link from the dev
// machine, so queued transactions can wait longer than Prisma's 2 s default
// `maxWait`. Explicit limits keep pool waits from masquerading as failures.
const TX_OPTIONS = { maxWait: 30_000, timeout: 30_000 };
const reserve = (items: StockItem[]) => db.$transaction((tx) => reserveStock(tx, items), TX_OPTIONS);
const isDeadlock = (reason: unknown) => /40P01|deadlock/i.test(String(reason));

beforeEach(() => resetTestDatabase(db));

describe("reserveStock on Postgres", () => {
  it("reserves paid + free cases when they fit", async () => {
    const biscuit = await makeSku("BISCUIT", 340);
    await reserve([{ skuId: biscuit.id, cases: 200 + 20 }]);
    expect(await stockOf(biscuit.id)).toEqual({ stockCases: 340, reservedCases: 220 });
  });

  it("refuses to over-reserve and changes nothing", async () => {
    const sku = await makeSku("SMALL", 10);
    await expect(reserve([{ skuId: sku.id, cases: 11 }])).rejects.toBeInstanceOf(StockShortError);
    expect(await stockOf(sku.id)).toEqual({ stockCases: 10, reservedCases: 0 });
  });

  it("is all-or-nothing across lines: a short second line rolls back the first", async () => {
    const a = await makeSku("A", 100);
    const b = await makeSku("B", 5);
    await expect(reserve([{ skuId: a.id, cases: 50 }, { skuId: b.id, cases: 6 }])).rejects.toBeInstanceOf(StockShortError);
    expect(await stockOf(a.id)).toEqual({ stockCases: 100, reservedCases: 0 });
    expect(await stockOf(b.id)).toEqual({ stockCases: 5, reservedCases: 0 });
  });

  it("two simultaneous 220-case orders against 340 cases: exactly one wins", async () => {
    const biscuit = await makeSku("BISCUIT", 340);
    const results = await Promise.allSettled([reserve([{ skuId: biscuit.id, cases: 220 }]), reserve([{ skuId: biscuit.id, cases: 220 }])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(StockShortError);
    expect(await stockOf(biscuit.id)).toEqual({ stockCases: 340, reservedCases: 220 });
  });

  it("20 simultaneous 1-case orders against 10 cases: exactly 10 succeed, never oversold", async () => {
    const sku = await makeSku("LAST10", 10);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserve([{ skuId: sku.id, cases: 1 }])));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(await stockOf(sku.id)).toEqual({ stockCases: 10, reservedCases: 10 });
  });

  it("orders listing the same SKUs in opposite orders don't deadlock", async () => {
    const x = await makeSku("X", 1_000);
    const y = await makeSku("Y", 1_000);
    const forward = [{ skuId: x.id, cases: 1 }, { skuId: y.id, cases: 1 }];
    const backward = [...forward].reverse();
    const results = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => reserve(i % 2 ? forward : backward)));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(failures.filter((f) => isDeadlock(f.reason))).toEqual([]); // no deadlock (40P01)
    expect(failures.map((f) => String(f.reason))).toEqual([]); // and no other error
    expect(await stockOf(x.id)).toEqual({ stockCases: 1_000, reservedCases: 30 });
    expect(await stockOf(y.id)).toEqual({ stockCases: 1_000, reservedCases: 30 });
  });
});

describe("release, deduct and restore on Postgres", () => {
  it("approval deducts reserved cases from stock; cancel-after-approval restores them (D4, D24)", async () => {
    const sku = await makeSku("FLOW", 85);
    await reserve([{ skuId: sku.id, cases: 5 }]);
    await db.$transaction((tx) => deductReservedStock(tx, [{ skuId: sku.id, cases: 5 }]));
    expect(await stockOf(sku.id)).toEqual({ stockCases: 80, reservedCases: 0 });
    await db.$transaction((tx) => restoreDeductedStock(tx, [{ skuId: sku.id, cases: 5 }]));
    expect(await stockOf(sku.id)).toEqual({ stockCases: 85, reservedCases: 0 });
  });

  it("cancel before approval releases the reservation", async () => {
    const sku = await makeSku("CANCEL", 50);
    await reserve([{ skuId: sku.id, cases: 46 + 4 }]);
    await db.$transaction((tx) => releaseReservation(tx, [{ skuId: sku.id, cases: 50 }]));
    expect(await stockOf(sku.id)).toEqual({ stockCases: 50, reservedCases: 0 });
  });

  it("refuses to release or deduct more than is reserved", async () => {
    const sku = await makeSku("GUARD", 10);
    await reserve([{ skuId: sku.id, cases: 3 }]);
    await expect(db.$transaction((tx) => releaseReservation(tx, [{ skuId: sku.id, cases: 4 }]))).rejects.toBeInstanceOf(StockInvariantError);
    await expect(db.$transaction((tx) => deductReservedStock(tx, [{ skuId: sku.id, cases: 4 }]))).rejects.toBeInstanceOf(StockInvariantError);
    expect(await stockOf(sku.id)).toEqual({ stockCases: 10, reservedCases: 3 });
  });

  it("the database itself rejects reserved > stock, even bypassing these functions", async () => {
    const sku = await makeSku("CHECK", 5);
    await expect(db.$executeRaw`UPDATE "Sku" SET "reservedCases" = 6 WHERE id = ${sku.id}`).rejects.toThrow(/Sku_stock_check/);
  });
});
