// Unit tests with a fake transaction: lock order, merging and failure handling.
// Real Postgres behaviour (concurrency) is in reservation.int.test.ts.
import { describe, expect, it } from "vitest";
import { StockInvariantError, StockShortError, normalise, releaseReservation, reserveStock } from "./reservation";

/** Records each UPDATE's (skuId, cases) and returns the given row counts. */
function fakeTx(rowCounts: Record<string, number> = {}) {
  const calls: Array<{ skuId: string; cases: number }> = [];
  const tx = {
    $executeRaw: (async (_sql: TemplateStringsArray, cases: number, skuId: string) => {
      calls.push({ skuId, cases });
      return rowCounts[skuId] ?? 1;
    }) as never,
  };
  return { tx, calls };
}

describe("normalise", () => {
  it("sorts by skuId so every transaction locks rows in the same order", () => {
    expect(normalise([{ skuId: "c", cases: 1 }, { skuId: "a", cases: 2 }, { skuId: "b", cases: 3 }]).map((i) => i.skuId)).toEqual(["a", "b", "c"]);
  });

  it("merges duplicate SKUs and drops zero-case items", () => {
    expect(normalise([{ skuId: "a", cases: 10 }, { skuId: "a", cases: 1 }, { skuId: "b", cases: 0 }])).toEqual([{ skuId: "a", cases: 11 }]);
  });

  it("rejects negative or fractional cases", () => {
    expect(() => normalise([{ skuId: "a", cases: -1 }])).toThrow(StockInvariantError);
    expect(() => normalise([{ skuId: "a", cases: 1.5 }])).toThrow(StockInvariantError);
  });
});

describe("reserveStock (fake transaction)", () => {
  it("updates rows in sorted order, whatever order the lines came in", async () => {
    const { tx, calls } = fakeTx();
    await reserveStock(tx, [{ skuId: "sku-z", cases: 2 }, { skuId: "sku-a", cases: 11 }]);
    expect(calls).toEqual([{ skuId: "sku-a", cases: 11 }, { skuId: "sku-z", cases: 2 }]);
  });

  it("throws StockShortError naming every short SKU, so the transaction rolls back", async () => {
    const { tx } = fakeTx({ "sku-b": 0, "sku-c": 0 });
    await expect(reserveStock(tx, [{ skuId: "sku-a", cases: 1 }, { skuId: "sku-b", cases: 1 }, { skuId: "sku-c", cases: 1 }])).rejects.toEqual(
      new StockShortError(["sku-b", "sku-c"]),
    );
  });
});

describe("releaseReservation (fake transaction)", () => {
  it("refuses to release more than is reserved", async () => {
    const { tx } = fakeTx({ "sku-a": 0 });
    await expect(releaseReservation(tx, [{ skuId: "sku-a", cases: 5 }])).rejects.toThrow(StockInvariantError);
  });
});
