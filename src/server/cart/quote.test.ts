import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { QUOTE_TTL_MS, quoteDigest, quoteKeyFromEnv, signQuote, verifyQuote, type QuoteFacts } from "./quote";

const KEY = randomBytes(32);
const NOW = new Date("2026-11-09T10:00:00Z");
const line = { skuId: "sku-b", paidCases: 10, choice: "BEST" as const, freeCases: 1, casePricePaise: 77_760, appliedSchemeId: "s1", discountPaise: 0, gstBps: 500, gstPaise: 38_880, lineTotalPaise: 816_480 };
const facts: QuoteFacts = {
  retailerId: "r-a",
  lines: [line, { ...line, skuId: "sku-a", freeCases: 0, appliedSchemeId: null }],
  totals: { taxablePaise: 1_555_200, discountPaise: 0, gstPaise: 77_760, totalPaise: 1_632_960 },
  credit: { hold: false, overByPaise: 0 },
};

describe("quoteDigest", () => {
  it("is the same whatever order the lines come in", () => {
    expect(quoteDigest({ ...facts, lines: [...facts.lines].reverse() })).toBe(quoteDigest(facts));
  });

  it.each([
    ["a case price", { lines: [{ ...line, casePricePaise: 77_761 }, facts.lines[1]] }],
    ["free cases", { lines: [{ ...line, freeCases: 0 }, facts.lines[1]] }],
    ["the applied scheme (same total)", { lines: [{ ...line, appliedSchemeId: "s2" }, facts.lines[1]] }],
    ["the offer choice", { lines: [{ ...line, choice: "WITHOUT_FREE_GOODS" as const }, facts.lines[1]] }],
    ["GST", { lines: [{ ...line, gstPaise: 38_881 }, facts.lines[1]] }],
    ["the order total", { totals: { ...facts.totals, totalPaise: 1_632_961 } }],
    ["the credit outcome", { credit: { hold: true, overByPaise: 1 } }],
    ["the retailer", { retailerId: "r-b" }],
  ])("changes when %s changes", (_label, change) => {
    expect(quoteDigest({ ...facts, ...change })).not.toBe(quoteDigest(facts));
  });
});

describe("signQuote / verifyQuote (D75)", () => {
  const token = signQuote(facts, KEY, NOW);

  it("verifies for the same retailer within 30 minutes and returns the digest", () => {
    expect(verifyQuote(token, KEY, { retailerId: "r-a", now: new Date(NOW.getTime() + QUOTE_TTL_MS) })).toEqual({ ok: true, digest: quoteDigest(facts) });
  });

  it("is bound to the retailer: another retailer can't use it", () => {
    expect(verifyQuote(token, KEY, { retailerId: "r-b", now: NOW })).toEqual({ ok: false, reason: "WRONG_RETAILER" });
  });

  it("expires after 30 minutes and rejects tokens from the future", () => {
    expect(verifyQuote(token, KEY, { retailerId: "r-a", now: new Date(NOW.getTime() + QUOTE_TTL_MS + 1) })).toEqual({ ok: false, reason: "EXPIRED" });
    expect(verifyQuote(token, KEY, { retailerId: "r-a", now: new Date(NOW.getTime() - 1) })).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects a token signed with another key", () => {
    expect(verifyQuote(signQuote(facts, randomBytes(32), NOW), KEY, { retailerId: "r-a", now: NOW })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects an edited payload (e.g. swapping the retailer or digest) even with a valid-looking signature", () => {
    const [v, , sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ r: "r-b", d: "0".repeat(64), iat: NOW.getTime() })).toString("base64url");
    expect(verifyQuote(`${v}.${forgedBody}.${sig}`, KEY, { retailerId: "r-b", now: NOW })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "q1", "q1.a", "q2.a.b", "q1.a.b.c", 42 as unknown as string]) {
      expect(verifyQuote(bad, KEY, { retailerId: "r-a", now: NOW }).ok).toBe(false);
    }
  });
});

describe("quoteKeyFromEnv (fail closed)", () => {
  it("is null when missing or shorter than 32 bytes", () => {
    expect(quoteKeyFromEnv({})).toBeNull();
    expect(quoteKeyFromEnv({ QUOTE_SIGNING_KEY: randomBytes(16).toString("base64") })).toBeNull();
  });

  it("decodes a base64 key of at least 32 bytes", () => {
    expect(quoteKeyFromEnv({ QUOTE_SIGNING_KEY: KEY.toString("base64") })?.equals(KEY)).toBe(true);
  });
});
