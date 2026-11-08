// Fixed-window counters in Postgres (D14, D56). Every change is a single
// atomic statement, so concurrent requests on any number of serverless
// instances can't race past a limit. Keys are SHA-256 hashed: no phone
// numbers or IP addresses are stored in the table.

import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Adds one and returns the new count for this window. */
export async function incrementCounter(db: Db, key: string, windowMs: number, now: Date): Promise<number> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitHit" ("key", "windowStart", "count")
    VALUES (${hashKey(key)}, ${windowStart(now, windowMs)}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitHit"."count" + 1
    RETURNING "count"`;
  return rows[0].count;
}

/** Gives one back (never below zero). */
export async function decrementCounter(db: Db, key: string, windowMs: number, now: Date): Promise<void> {
  await db.$executeRaw`
    UPDATE "RateLimitHit" SET "count" = "count" - 1
    WHERE "key" = ${hashKey(key)} AND "windowStart" = ${windowStart(now, windowMs)} AND "count" > 0`;
}
