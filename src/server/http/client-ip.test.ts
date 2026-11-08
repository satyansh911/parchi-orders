import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const h = (values: Record<string, string>) => new Headers(values);

describe("clientIp (D56, trusted only on Vercel)", () => {
  it("ignores forwarded headers off Vercel, where clients can set them", () => {
    expect(clientIp(h({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }), false)).toBe("local");
  });

  it("on Vercel, prefers x-real-ip", () => {
    expect(clientIp(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }), true)).toBe("203.0.113.7");
  });

  it("on Vercel, falls back to the first x-forwarded-for value", () => {
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }), true)).toBe("198.51.100.1");
  });

  it("on Vercel with no headers, uses a shared 'unknown' bucket", () => {
    expect(clientIp(h({}), true)).toBe("unknown");
  });
});
