import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./origin";

const h = (values: Record<string, string>) => new Headers(values);

describe("isSameOriginRequest (CSRF, D69.11)", () => {
  it("allows safe methods without an Origin", () => {
    for (const m of ["GET", "HEAD", "OPTIONS", "get"]) expect(isSameOriginRequest(m, h({}), false)).toBe(true);
  });

  it("accepts a POST from this site's own origin", () => {
    expect(isSameOriginRequest("POST", h({ origin: "http://localhost:3000", host: "localhost:3000" }), false)).toBe(true);
  });

  it.each([
    ["missing Origin", {}],
    ["Origin: null (sandboxed or file)", { origin: "null" }],
    ["another site", { origin: "https://evil.example" }],
    ["a look-alike subdomain", { origin: "http://localhost:3000.evil.example" }],
    ["same host, other port", { origin: "http://localhost:4000" }],
    ["a malformed Origin", { origin: "not a url" }],
  ])("rejects a POST with %s", (_label, extra) => {
    expect(isSameOriginRequest("POST", h({ host: "localhost:3000", ...extra }), false)).toBe(false);
  });

  it("rejects state changes for every unsafe method", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(isSameOriginRequest(m, h({ host: "localhost:3000", origin: "https://evil.example" }), false)).toBe(false);
    }
  });

  it("uses x-forwarded-host only on Vercel", () => {
    const headers = h({ origin: "https://parchi.example", host: "internal:3000", "x-forwarded-host": "parchi.example" });
    expect(isSameOriginRequest("POST", headers, true)).toBe(true);
    expect(isSameOriginRequest("POST", headers, false)).toBe(false); // spoofable off Vercel
  });
});
