// Test-only data builders for integration tests on the test branch.
// Fake names and 99999-pattern phone numbers only.

import type { PrismaClient } from "@/generated/prisma/client";

export async function makeTier(db: PrismaClient, code = "STANDARD", discountBps = 0) {
  return db.priceTier.upsert({ where: { code }, update: {}, create: { code, name: code, discountBps } });
}

export async function makeRetailer(
  db: PrismaClient,
  code: string,
  phone: string,
  options: { tierCode?: string; tierDiscountBps?: number; creditLimitPaise?: number; outstandingPaise?: number } = {},
) {
  const tier = await makeTier(db, options.tierCode ?? "STANDARD", options.tierDiscountBps ?? 0);
  const retailer = await db.retailer.create({
    data: {
      code,
      shopName: `${code} Test Kirana`,
      ownerName: `Owner ${code}`,
      area: "Test Area",
      tierId: tier.id,
      creditLimitPaise: options.creditLimitPaise ?? 5_000_000,
      outstandingPaise: options.outstandingPaise ?? 0,
      users: { create: { phone, name: `Owner ${code}`, role: "RETAILER" } },
    },
    include: { users: true, tier: true },
  });
  return { retailer, user: retailer.users[0] };
}

export async function makeDeskUser(db: PrismaClient, phone = "9999900001") {
  return db.user.create({ data: { phone, name: "Desk (test)", role: "DESK" } });
}

/** A minimal order row for access tests (money values are placeholders). */
export async function makeOrder(db: PrismaClient, retailerId: string, placedById: string, ref: string) {
  return db.order.create({
    data: {
      clientRequestId: `test-${ref}`,
      retailerId,
      placedById,
      source: "CATALOGUE",
      status: "PENDING_REVIEW",
      taxablePaise: 100_000, discountPaise: 0, gstPaise: 5_000, totalPaise: 105_000, originalTotalPaise: 105_000,
      creditLimitPaise: 5_000_000, availableCreditPaise: 5_000_000, overLimitPaise: 0, creditCheckedAt: new Date(),
      events: { create: { type: "PLACED", actorId: placedById, toStatus: "PENDING_REVIEW", reason: `internal note ${ref}` } },
    },
  });
}

export async function makeCapture(db: PrismaClient, retailerId: string, createdById: string, rawText: string) {
  return db.capture.create({ data: { retailerId, createdById, rawText, status: "PARSED" } });
}
