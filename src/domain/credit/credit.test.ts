import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { OPEN_ORDER_STATUSES, creditPosition, decideCredit } from "./credit";

const rupees = (r: number) => r * 100;

describe("creditPosition (D20)", () => {
  it("available = limit − outstanding − open orders", () => {
    expect(creditPosition({ limitPaise: rupees(100_000), outstandingPaise: rupees(32_400), openOrdersPaise: rupees(10_000) })).toMatchObject({
      availablePaise: rupees(57_600),
      alreadyOverPaise: 0,
    });
  });

  it("never shows available credit below ₹0; reports how far over instead", () => {
    // R-0012 in the seed: limit ₹65,000, outstanding ₹73,500.
    expect(creditPosition({ limitPaise: rupees(65_000), outstandingPaise: rupees(73_500), openOrdersPaise: 0 })).toMatchObject({
      availablePaise: 0,
      alreadyOverPaise: rupees(8_500),
    });
  });

  it("treats exactly-at-the-limit as zero available, not over", () => {
    expect(creditPosition({ limitPaise: rupees(60_000), outstandingPaise: rupees(60_000), openOrdersPaise: 0 })).toMatchObject({ availablePaise: 0, alreadyOverPaise: 0 });
  });

  it("counts open orders: pending, credit hold, review required and approved-not-exported", () => {
    expect(OPEN_ORDER_STATUSES).toEqual(["PENDING_REVIEW", "CREDIT_HOLD", "REVIEW_REQUIRED", "APPROVED"]);
  });

  it("rejects non-integer or negative money", () => {
    expect(() => creditPosition({ limitPaise: -1, outstandingPaise: 0, openOrdersPaise: 0 })).toThrow(DomainError);
    expect(() => creditPosition({ limitPaise: 100.5, outstandingPaise: 0, openOrdersPaise: 0 })).toThrow(DomainError);
  });
});

describe("decideCredit (D21, D79)", () => {
  const pos = creditPosition({ limitPaise: rupees(100_000), outstandingPaise: rupees(90_000), openOrdersPaise: 0 }); // ₹10,000 available

  it("does not hold an order that fits, including exactly the available amount", () => {
    expect(decideCredit(pos, rupees(9_999))).toEqual({ hold: false, overByPaise: 0 });
    expect(decideCredit(pos, rupees(10_000))).toEqual({ hold: false, overByPaise: 0 });
  });

  it("holds an order one paisa over, and says by how much", () => {
    expect(decideCredit(pos, rupees(10_000) + 1)).toEqual({ hold: true, overByPaise: 1 });
    expect(decideCredit(pos, rupees(12_500))).toEqual({ hold: true, overByPaise: rupees(2_500) });
  });

  it("holds every order when the retailer is already at or over the limit, or has no credit", () => {
    const atLimit = creditPosition({ limitPaise: rupees(60_000), outstandingPaise: rupees(60_000), openOrdersPaise: 0 });
    expect(decideCredit(atLimit, 1)).toEqual({ hold: true, overByPaise: 1 });
    const zeroLimit = creditPosition({ limitPaise: 0, outstandingPaise: 0, openOrdersPaise: 0 });
    expect(decideCredit(zeroLimit, rupees(500)).hold).toBe(true);
  });

  it("never counts the current order twice: it is only the second argument", () => {
    const withOther = creditPosition({ limitPaise: rupees(100_000), outstandingPaise: rupees(80_000), openOrdersPaise: rupees(15_000) });
    expect(decideCredit(withOther, rupees(5_000))).toEqual({ hold: false, overByPaise: 0 }); // 5,000 available, 5,000 order
  });
});
