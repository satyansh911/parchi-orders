import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken, isWellFormedToken } from "./tokens";

describe("session tokens (D59)", () => {
  it("are 32 random bytes encoded as 43 base64url characters", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("are unique across many generations", () => {
    const tokens = new Set(Array.from({ length: 10_000 }, generateSessionToken));
    expect(tokens.size).toBe(10_000);
  });

  it("hash to SHA-256 hex, which never equals the token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("hash differently when a single character changes", () => {
    const token = generateSessionToken();
    const tampered = (token[0] === "A" ? "B" : "A") + token.slice(1);
    expect(hashSessionToken(tampered)).not.toBe(hashSessionToken(token));
  });

  it("reject malformed values before any database work", () => {
    for (const bad of [undefined, "", "short", `${generateSessionToken()}x`, "a".repeat(42) + "=", 42, null]) {
      expect(isWellFormedToken(bad)).toBe(false);
    }
    expect(isWellFormedToken(generateSessionToken())).toBe(true);
  });
});
