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
