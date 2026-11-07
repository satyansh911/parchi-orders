import { describe, expect, it } from "vitest";
import { DESK_USER, RETAILERS, TIERS, retailerPhone } from "./people";

const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const FAKE_PATTERN = /^99999\d{5}$/;

describe("seed people", () => {
  it("has 20 retailers, 4 of them key accounts", () => {
    expect(RETAILERS).toHaveLength(20);
    expect(RETAILERS.filter((r) => r.tier === "KEY_ACCOUNT")).toHaveLength(4);
  });

  it("has the two demo tiers from D5", () => {
    expect(TIERS).toEqual([
      { code: "STANDARD", name: "Standard", discountBps: 0 },
      { code: "KEY_ACCOUNT", name: "Key account", discountBps: 200 },
    ]);
  });

  it("uses unique codes and unique, obviously fake phone numbers", () => {
    expect(new Set(RETAILERS.map((r) => r.code)).size).toBe(20);
    const phones = [DESK_USER.phone, ...RETAILERS.map((r) => retailerPhone(r.code))];
    expect(new Set(phones).size).toBe(phones.length);
    for (const phone of phones) {
      expect(phone).toMatch(FAKE_PATTERN);
      expect(phone).toMatch(INDIAN_MOBILE); // must pass the login validator
    }
  });

  it("maps retailer codes to the documented phone numbers", () => {
    expect(retailerPhone("R-0001")).toBe("9999900101");
    expect(retailerPhone("R-0020")).toBe("9999900120");
  });

  it("stores credit as non-negative integer paise within ₹50k–₹3 lakh limits", () => {
    for (const r of RETAILERS) {
      expect(Number.isInteger(r.creditLimitPaise) && Number.isInteger(r.outstandingPaise)).toBe(true);
      expect(r.creditLimitPaise).toBeGreaterThanOrEqual(5_000_000);
      expect(r.creditLimitPaise).toBeLessThanOrEqual(30_000_000);
      expect(r.outstandingPaise).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes exactly 3 retailers at or over their limit, for the credit-hold demo", () => {
    const atOrOver = RETAILERS.filter((r) => r.outstandingPaise >= r.creditLimitPaise);
    expect(atOrOver.map((r) => r.code)).toEqual(["R-0007", "R-0012", "R-0018"]);
  });
});
