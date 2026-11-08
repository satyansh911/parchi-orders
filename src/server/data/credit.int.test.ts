// Credit position on real Postgres (test branch only, D49).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSession, findViewerByToken } from "../auth/session-store";
import { makeDeskUser, makeOrder, makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { getCreditSummary } from "./credit";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
beforeEach(() => resetTestDatabase(db));
const NOW = new Date("2026-11-09T06:00:00Z");
const viewerOf = async (userId: string) => (await findViewerByToken(db, (await createSession(db, userId, NOW)).token, NOW))!;

async function orderWithStatus(retailerId: string, userId: string, ref: string, status: "PENDING_REVIEW" | "CREDIT_HOLD" | "REVIEW_REQUIRED" | "APPROVED" | "CANCELLED" | "EXPORTED", totalPaise: number) {
  const o = await makeOrder(db, retailerId, userId, ref);
  await db.order.update({ where: { id: o.id }, data: { status, totalPaise } });
}

describe("getCreditSummary (D20)", () => {
  it("subtracts open orders (pending, held, review, approved) and ignores cancelled and exported ones", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101", { creditLimitPaise: 10_000_000, outstandingPaise: 3_000_000 });
    await orderWithStatus(a.retailer.id, a.user.id, "1", "PENDING_REVIEW", 100_000);
    await orderWithStatus(a.retailer.id, a.user.id, "2", "CREDIT_HOLD", 200_000);
    await orderWithStatus(a.retailer.id, a.user.id, "3", "REVIEW_REQUIRED", 300_000);
    await orderWithStatus(a.retailer.id, a.user.id, "4", "APPROVED", 400_000);
    await orderWithStatus(a.retailer.id, a.user.id, "5", "CANCELLED", 9_000_000);
    await orderWithStatus(a.retailer.id, a.user.id, "6", "EXPORTED", 9_000_000);
    expect(await getCreditSummary(db, await viewerOf(a.user.id))).toMatchObject({
      openOrdersPaise: 1_000_000,
      availablePaise: 10_000_000 - 3_000_000 - 1_000_000,
    });
  });

  it("never mixes in another retailer's orders", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101", { creditLimitPaise: 5_000_000, outstandingPaise: 0 });
    const b = await makeRetailer(db, "R-B", "9999900102");
    await orderWithStatus(b.retailer.id, b.user.id, "b1", "PENDING_REVIEW", 4_000_000);
    expect((await getCreditSummary(db, await viewerOf(a.user.id))).availablePaise).toBe(5_000_000);
  });

  it("refuses a retailer naming another retailer, and requires the desk to name one", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101");
    const b = await makeRetailer(db, "R-B", "9999900102", { creditLimitPaise: 30_000_000, outstandingPaise: 11_800_000 });
    await expect(getCreditSummary(db, await viewerOf(a.user.id), b.retailer.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const desk = await viewerOf((await makeDeskUser(db)).id);
    await expect(getCreditSummary(db, desk)).rejects.toMatchObject({ code: "RETAILER_REQUIRED" });
    expect(await getCreditSummary(db, desk, b.retailer.id)).toMatchObject({ availablePaise: 18_200_000 });
  });

  it("reports an already-over retailer as ₹0 available and how far over", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101", { creditLimitPaise: 6_500_000, outstandingPaise: 7_350_000 });
    expect(await getCreditSummary(db, await viewerOf(a.user.id))).toMatchObject({ availablePaise: 0, alreadyOverPaise: 850_000 });
  });
});
