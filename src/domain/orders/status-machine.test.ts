import { describe, expect, it } from "vitest";
import { assertTransition, findTransition, type Actor, type From, type OrderStatus } from "./status-machine";

const STATUSES: OrderStatus[] = ["DRAFT", "PENDING_REVIEW", "CREDIT_HOLD", "REVIEW_REQUIRED", "APPROVED", "CANCELLED", "EXPORTED"];
const FROMS: From[] = ["NEW", ...STATUSES];
const ACTORS: Actor[] = ["SYSTEM", "RETAILER", "DESK"];

// The complete allowed set (D30 + D33 + D77). Everything else must be refused.
const ALLOWED = new Set([
  "NEW>PENDING_REVIEW:SYSTEM", "NEW>CREDIT_HOLD:SYSTEM", "NEW>REVIEW_REQUIRED:SYSTEM",
  "PENDING_REVIEW>CREDIT_HOLD:SYSTEM", "REVIEW_REQUIRED>CREDIT_HOLD:SYSTEM",
  "PENDING_REVIEW>APPROVED:DESK", "REVIEW_REQUIRED>APPROVED:DESK", "CREDIT_HOLD>APPROVED:DESK",
  "PENDING_REVIEW>CANCELLED:RETAILER", "PENDING_REVIEW>CANCELLED:DESK", "CREDIT_HOLD>CANCELLED:DESK",
  "REVIEW_REQUIRED>CANCELLED:DESK", "APPROVED>CANCELLED:DESK", "APPROVED>EXPORTED:DESK",
]);

describe("order status machine (D30)", () => {
  const cases = FROMS.flatMap((from) => STATUSES.flatMap((to) => ACTORS.map((actor) => ({ from, to, actor, key: `${from}>${to}:${actor}` }))));

  it.each(cases.filter((c) => ALLOWED.has(c.key)))("allows $key", ({ from, to, actor }) => {
    expect(findTransition(from, to, actor)).not.toBeNull();
  });

  it(`refuses all ${cases.length - ALLOWED.size} other combinations`, () => {
    const wronglyAllowed = cases.filter((c) => !ALLOWED.has(c.key) && findTransition(c.from, c.to, c.actor)).map((c) => c.key);
    expect(wronglyAllowed).toEqual([]);
  });

  it("never moves out of CANCELLED or EXPORTED, and never uses DRAFT (D12)", () => {
    for (const from of ["CANCELLED", "EXPORTED", "DRAFT"] as const) {
      for (const to of STATUSES) for (const actor of ACTORS) expect(findTransition(from, to, actor), `${from}>${to}:${actor}`).toBeNull();
    }
    for (const actor of ACTORS) expect(findTransition("NEW", "DRAFT", actor)).toBeNull();
  });

  it("never lets a retailer approve, export, release a hold or cancel a held or approved order", () => {
    for (const [from, to] of [["PENDING_REVIEW", "APPROVED"], ["CREDIT_HOLD", "APPROVED"], ["APPROVED", "EXPORTED"], ["CREDIT_HOLD", "CANCELLED"], ["REVIEW_REQUIRED", "CANCELLED"], ["APPROVED", "CANCELLED"]] as const) {
      expect(findTransition(from, to, "RETAILER"), `${from}>${to}`).toBeNull();
    }
  });

  it("refuses with a typed error", () => {
    expect(() => assertTransition("EXPORTED", "CANCELLED", "DESK", "too late")).toThrow(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("requires a reason for desk rejections and cancellations, not for a retailer's own cancel", () => {
    expect(() => assertTransition("APPROVED", "CANCELLED", "DESK")).toThrow(expect.objectContaining({ code: "REASON_REQUIRED" }));
    expect(() => assertTransition("CREDIT_HOLD", "CANCELLED", "DESK", "  ")).toThrow(expect.objectContaining({ code: "REASON_REQUIRED" }));
    expect(assertTransition("CREDIT_HOLD", "CANCELLED", "DESK", "Retailer asked to cancel").to).toBe("CANCELLED");
    expect(assertTransition("PENDING_REVIEW", "CANCELLED", "RETAILER").to).toBe("CANCELLED");
  });

  it("states the stock effect of each change (D4, D24)", () => {
    expect(findTransition("NEW", "CREDIT_HOLD", "SYSTEM")?.stock).toBe("RESERVE");
    expect(findTransition("CREDIT_HOLD", "APPROVED", "DESK")?.stock).toBe("DEDUCT");
    expect(findTransition("PENDING_REVIEW", "CANCELLED", "RETAILER")?.stock).toBe("RELEASE");
    expect(findTransition("APPROVED", "CANCELLED", "DESK")?.stock).toBe("RESTORE");
    expect(findTransition("APPROVED", "EXPORTED", "DESK")?.stock).toBe("NONE");
    expect(findTransition("PENDING_REVIEW", "CREDIT_HOLD", "SYSTEM")?.stock).toBe("NONE");
  });
});
