import { describe, expect, it } from "vitest";
import {
  MAX_CASES, MAX_LINES, addCase, casesFor, chooseOption, emptyCart, hasMergedCapture, isLocked, mergeCaptureLines, mergeLines, parseCart,
  removeCase, removeLine, resolveNotCreated, resolvePlaced, setCases, startSubmission, type CartState,
} from "./cart-state";

const start = () => emptyCart("req-1");

describe("cart lines (D48: one line per SKU)", () => {
  it("adds and removes cases one at a time", () => {
    let s = addCase(addCase(start(), "a"), "a");
    expect(s.lines).toEqual([{ skuId: "a", paidCases: 2 }]);
    s = removeCase(s, "a");
    expect(casesFor(s, "a")).toBe(1);
    expect(removeCase(s, "a").lines).toEqual([]);
  });

  it("caps a line at 999 cases and never goes negative (D45)", () => {
    expect(setCases(start(), "a", 5000).lines[0].paidCases).toBe(MAX_CASES);
    expect(setCases(start(), "a", -3).lines).toEqual([]);
    expect(setCases(start(), "a", 2.9).lines[0].paidCases).toBe(2);
  });

  it("keeps one line per SKU and at most 50 lines", () => {
    let s = start();
    for (let i = 0; i < 60; i++) s = addCase(s, `sku-${i}`);
    expect(s.lines).toHaveLength(MAX_LINES);
    s = addCase(s, "sku-0");
    expect(s.lines.filter((l) => l.skuId === "sku-0")).toEqual([{ skuId: "sku-0", paidCases: 2 }]);
  });

  it("drops an offer choice when the quantity is changed by hand", () => {
    let s = chooseOption(setCases(start(), "cream", 60), "cream", 50, "WITHOUT_FREE_GOODS");
    expect(s.lines[0]).toEqual({ skuId: "cream", paidCases: 50, choice: "WITHOUT_FREE_GOODS" });
    s = addCase(s, "cream");
    expect(s.lines[0]).toEqual({ skuId: "cream", paidCases: 51 });
  });

  it("stores a BEST option without an explicit choice", () => {
    expect(chooseOption(setCases(start(), "cream", 50), "cream", 46, "BEST").lines[0]).toEqual({ skuId: "cream", paidCases: 46 });
  });

  it("removes a line", () => {
    expect(removeLine(setCases(start(), "a", 3), "a").lines).toEqual([]);
  });
});

describe("repeat order merge (D78)", () => {
  const cart = setCases(setCases(start(), "a", 2), "b", 3);

  it("replaces the cart", () => {
    expect(mergeLines(cart, [{ skuId: "c", paidCases: 1 }], "replace").lines).toEqual([{ skuId: "c", paidCases: 1 }]);
  });

  it("adds, summing cases for SKUs already in the cart, capped at 999", () => {
    const merged = mergeLines(cart, [{ skuId: "a", paidCases: 5 }, { skuId: "c", paidCases: 1 }], "add");
    expect(merged.lines).toEqual([{ skuId: "a", paidCases: 7 }, { skuId: "b", paidCases: 3 }, { skuId: "c", paidCases: 1 }]);
    expect(casesFor(mergeLines(setCases(start(), "a", 990), [{ skuId: "a", paidCases: 50 }], "add"), "a")).toBe(MAX_CASES);
  });
});

describe("pending submission (D76)", () => {
  const cart = setCases(start(), "a", 2);
  const pending = startSubmission(cart, "quote-1", false, 1000);

  it("keeps the request ID and the exact payload, and locks the cart", () => {
    expect(pending.pending).toEqual({ requestId: "req-1", lines: [{ skuId: "a", paidCases: 2 }], quote: "quote-1", confirmCreditHold: false, startedAt: 1000 });
    expect(isLocked(pending)).toBe(true);
  });

  it("ignores edits while locked, so the ID is never reused for an edited cart", () => {
    expect(addCase(pending, "a")).toBe(pending);
    expect(setCases(pending, "b", 1)).toBe(pending);
    expect(mergeLines(pending, [{ skuId: "c", paidCases: 1 }], "replace")).toBe(pending);
    expect(startSubmission(pending, "quote-2", true, 2000)).toBe(pending);
  });

  it("gets a new ID only once resolved: nothing created → same lines, unlocked, new ID", () => {
    const s = resolveNotCreated(pending, "req-2");
    expect(s).toEqual({ v: 1, requestId: "req-2", lines: [{ skuId: "a", paidCases: 2 }], pending: null, mergedCaptureIds: [] });
  });

  it("gets a new ID and an empty cart once an order is confirmed, keeping the capture ledger (D98)", () => {
    expect(resolvePlaced({ ...pending, mergedCaptureIds: ["cap-1"] }, "req-3")).toEqual(emptyCart("req-3", ["cap-1"]));
  });

  it("won't start a submission for an empty cart", () => {
    expect(startSubmission(start(), "q", false, 1).pending).toBeNull();
  });
});

describe("parseCart", () => {
  const id = () => "fresh";

  it("round-trips a stored cart, including a pending submission", () => {
    const s: CartState = startSubmission(setCases(start(), "a", 2), "q", true, 5);
    expect(parseCart(JSON.stringify(s), id)).toEqual({ ...s, mergedCaptureIds: [] });
  });

  it("turns missing, corrupt or old-format data into an empty cart", () => {
    for (const raw of [null, "", "not json", "{}", JSON.stringify({ v: 2, requestId: "x", lines: [] })]) {
      expect(parseCart(raw, id)).toEqual(emptyCart("fresh"));
    }
  });

  it("drops invalid and duplicate lines from tampered storage", () => {
    const raw = JSON.stringify({ v: 1, requestId: "r", pending: null, lines: [{ skuId: "a", paidCases: 2 }, { skuId: "a", paidCases: 9 }, { skuId: "b", paidCases: 0 }, { skuId: "c", paidCases: 1.5 }, { skuId: 7, paidCases: 1 }, { skuId: "d", paidCases: 1000 }] });
    expect(parseCart(raw, id).lines).toEqual([{ skuId: "a", paidCases: 2 }]);
  });
});

describe("capture merge guard (D98)", () => {
  const lines = [{ skuId: "a", paidCases: 5 }];

  it("adds a capture's lines once; retries, reloads and double taps add nothing more", () => {
    const once = mergeCaptureLines(start(), "cap-1", lines, "add");
    expect(once.lines).toEqual(lines);
    expect(once.captureId).toBe("cap-1");
    expect(hasMergedCapture(once, "cap-1")).toBe(true);
    expect(mergeCaptureLines(once, "cap-1", lines, "add")).toBe(once);
    const reloaded = parseCart(JSON.stringify(once), () => "x");
    expect(mergeCaptureLines(reloaded, "cap-1", lines, "add").lines).toEqual(lines);
  });

  it("still blocks a re-merge after the order was placed (ledger survives)", () => {
    const placed = resolvePlaced(mergeCaptureLines(start(), "cap-1", lines, "add"), "req-2");
    expect(mergeCaptureLines(placed, "cap-1", lines, "add").lines).toEqual([]);
    expect(placed.captureId).toBeUndefined(); // the link went with the placed order
  });

  it("a different capture still merges", () => {
    const s = mergeCaptureLines(mergeCaptureLines(start(), "cap-1", lines, "add"), "cap-2", lines, "add");
    expect(s.lines).toEqual([{ skuId: "a", paidCases: 10 }]);
    expect(s.captureId).toBe("cap-1"); // the first capture stays linked; "replace" would switch it
    expect(mergeCaptureLines(s, "cap-3", lines, "replace").captureId).toBe("cap-3");
  });
});
