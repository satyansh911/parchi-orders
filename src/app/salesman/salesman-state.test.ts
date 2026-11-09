import { describe, expect, it } from "vitest";
import { acceptNewTotal, discardEntry, editEntry, emptyState, parseState, pendingFor, saveOrder, setCases, toSend, updateEntry, type SalesmanState } from "./salesman-state";

const expected = (total: number, hold = false) => ({ lines: [{ skuId: "b", paidCases: 10, freeCases: 1, lineTotalPaise: total }], totalPaise: total, hold });
const save = (s: SalesmanState, id: string, shop = "r1") =>
  saveOrder(s, { id, retailerId: shop, shopName: "Shop", lines: [{ skuId: "b", paidCases: 10 }], expected: expected(1000), confirmCreditHold: false, takenAt: "2026-11-09T06:00:00Z" });

describe("salesman phone state (D108)", () => {
  it("keeps a cart per shop and moves it to the outbox on save", () => {
    let s = setCases(setCases(emptyState(), "r1", "b", 10), "r2", "c", 2);
    s = save(s, "o1");
    expect(s.carts).toEqual({ r2: { c: 2 } });
    expect(toSend(s).map((e) => e.id)).toEqual(["o1"]);
    expect(setCases(s, "r2", "c", 0).carts.r2).toEqual({});
  });

  it("counts unsent orders against stock and that shop's credit", () => {
    const s = save(save(emptyState(), "o1"), "o2", "r2");
    expect(pendingFor(s, "r1")).toEqual({ skuCases: new Map([["b", 22]]), shopPaise: 1000 });
  });

  it("stops counting a sent order once a newer pack includes it", () => {
    let s = updateEntry(save(emptyState(), "o1"), "o1", { status: "PLACED", syncedAt: "2026-11-09T07:00:00Z", orderNumber: 5 });
    s = { ...s, pack: { v: 1, generatedAt: "2026-11-09T06:30:00Z", salesmanName: "", skus: [], shops: [] } };
    expect(pendingFor(s, "r1").shopPaise).toBe(1000);
    s = { ...s, pack: { ...s.pack!, generatedAt: "2026-11-09T08:00:00Z" } };
    expect(pendingFor(s, "r1").shopPaise).toBe(0);
  });

  it("resends a changed order with the new total and the SAME request ID", () => {
    let s = updateEntry(save(emptyState(), "o1"), "o1", { status: "CHANGED", newExpected: expected(1200, true) });
    s = acceptNewTotal(s, "o1");
    expect(s.outbox[0]).toMatchObject({ id: "o1", status: "PENDING", expected: { totalPaise: 1200 }, confirmCreditHold: true });
  });

  it("edits or discards unsent orders, never sent ones", () => {
    const s = save(emptyState(), "o1");
    expect(editEntry(s, "o1")).toMatchObject({ carts: { r1: { b: 10 } }, outbox: [] });
    expect(discardEntry(s, "o1").outbox).toEqual([]);
    const sent = updateEntry(s, "o1", { status: "PLACED" });
    expect(editEntry(sent, "o1")).toBe(sent);
    expect(discardEntry(sent, "o1").outbox).toHaveLength(1);
  });

  it("parses stored state defensively", () => {
    expect(parseState(null)).toEqual(emptyState());
    expect(parseState("{bad")).toEqual(emptyState());
    expect(parseState(JSON.stringify({ v: 2 }))).toEqual(emptyState());
  });
});
