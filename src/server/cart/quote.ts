// Server-signed quote token (D75).
//
// A quote proves "this is exactly what the retailer was shown": a digest of
// every priced value, bound to the retailer, with an expiry, signed with
// HMAC-SHA256 under a server-only key (env QUOTE_SIGNING_KEY).
//
// It is a CHANGE DETECTOR, never authorization: placement checks the session
// and role first (D67), recalculates everything itself, and only compares its
// own digest with the quote's. No value is ever read from the token.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const QUOTE_TTL_MS = 30 * 60 * 1000;
const VERSION = "q1";
const MIN_KEY_BYTES = 32;

export type QuoteLine = {
  skuId: string;
  paidCases: number;
  choice: "BEST" | "WITHOUT_FREE_GOODS";
  freeCases: number;
  casePricePaise: number;
  appliedSchemeId: string | null;
  discountPaise: number;
  gstBps: number;
  gstPaise: number;
  lineTotalPaise: number;
};

export type QuoteFacts = {
  retailerId: string;
  lines: QuoteLine[];
  totals: { taxablePaise: number; discountPaise: number; gstPaise: number; totalPaise: number };
  credit: { hold: boolean; overByPaise: number };
};

/** Canonical digest: lines sorted by SKU, fixed key order, so equal facts → equal digest. */
export function quoteDigest(facts: QuoteFacts): string {
  const lines = [...facts.lines]
    .sort((a, b) => (a.skuId < b.skuId ? -1 : a.skuId > b.skuId ? 1 : 0))
    .map((l) => [l.skuId, l.paidCases, l.choice, l.freeCases, l.casePricePaise, l.appliedSchemeId, l.discountPaise, l.gstBps, l.gstPaise, l.lineTotalPaise]);
  const { taxablePaise, discountPaise, gstPaise, totalPaise } = facts.totals;
  const canonical = JSON.stringify([facts.retailerId, lines, [taxablePaise, discountPaise, gstPaise, totalPaise], [facts.credit.hold, facts.credit.overByPaise]]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** The signing key, or null if it is missing or too short (callers fail closed). */
export function quoteKeyFromEnv(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.QUOTE_SIGNING_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length >= MIN_KEY_BYTES ? key : null;
}

type Payload = { r: string; d: string; iat: number };

export function signQuote(facts: QuoteFacts, key: Buffer, now: Date): string {
  const payload: Payload = { r: facts.retailerId, d: quoteDigest(facts), iat: now.getTime() };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${VERSION}.${body}.${sign(`${VERSION}.${body}`, key)}`;
}

export type QuoteCheck =
  | { ok: true; digest: string }
  | { ok: false; reason: "MALFORMED" | "BAD_SIGNATURE" | "WRONG_RETAILER" | "EXPIRED" };

export function verifyQuote(token: string, key: Buffer, expect: { retailerId: string; now: Date }): QuoteCheck {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3 || parts[0] !== VERSION) return { ok: false, reason: "MALFORMED" };
  const [version, body, signature] = parts;

  const expected = Buffer.from(sign(`${version}.${body}`, key), "utf8");
  const given = Buffer.from(signature, "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "BAD_SIGNATURE" };

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (typeof payload?.r !== "string" || typeof payload.d !== "string" || typeof payload.iat !== "number") return { ok: false, reason: "MALFORMED" };
  if (payload.r !== expect.retailerId) return { ok: false, reason: "WRONG_RETAILER" };
  const age = expect.now.getTime() - payload.iat;
  if (age < 0 || age > QUOTE_TTL_MS) return { ok: false, reason: "EXPIRED" };
  return { ok: true, digest: payload.d };
}

function sign(data: string, key: Buffer): string {
  return createHmac("sha256", key).update(data, "utf8").digest("base64url");
}
