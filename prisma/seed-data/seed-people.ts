import type { PrismaClient } from "../../src/generated/prisma/client";
import { DESK_USER, RETAILERS, TIERS, retailerPhone } from "./people";

export async function seedPeople(db: PrismaClient) {
  const tierIds = new Map<string, string>();
  for (const tier of TIERS) {
    const created = await db.priceTier.create({ data: tier });
    tierIds.set(tier.code, created.id);
  }

  await db.user.create({ data: { ...DESK_USER, role: "DESK" } });

  for (const { tier, ...retailer } of RETAILERS) {
    const tierId = tierIds.get(tier);
    if (!tierId) throw new Error(`Unknown tier ${tier}`);
    await db.retailer.create({
      data: {
        ...retailer,
        tierId,
        users: {
          create: { phone: retailerPhone(retailer.code), name: retailer.ownerName, role: "RETAILER" },
        },
      },
    });
  }

  return { tiers: TIERS.length, retailers: RETAILERS.length, users: RETAILERS.length + 1 };
}
