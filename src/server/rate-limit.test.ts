import { describe, expect, it } from "vitest";
import { hashKey, windowStart } from "./rate-limit";

describe("windowStart", () => {
  it("floors to the start of the fixed window", () => {
    const w = 15 * 60 * 1000;
    expect(windowStart(new Date("2026-11-09T10:14:59.999Z"), w).toISOString()).toBe("2026-11-09T10:00:00.000Z");
    expect(windowStart(new Date("2026-11-09T10:15:00.000Z"), w).toISOString()).toBe("2026-11-09T10:15:00.000Z");
  });
});

describe("hashKey", () => {
  it("stores no phone number or IP in clear", () => {
    const hashed = hashKey("otp:fail:phone:9999900101");
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toContain("9999900101");
  });
});
