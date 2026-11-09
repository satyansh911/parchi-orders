// The whole demo seed, for any already-chosen database client. It RESETS the
// database first (TRUNCATE of every Prisma model). Callers decide the target:
// prisma/seed.ts (DATABASE_URL, the demo database) or scripts/test-e2e-seed.ts
// (guarded test branch only).

import { Prisma, type PrismaClient } from "../../src/generated/prisma/client";
import { seedCatalogue } from "./seed-catalogue";
import { seedPastOrders } from "./seed-past-orders";
import { seedFieldTeam } from "./seed-field-team";
import { seedPeople } from "./seed-people";

export async function runSeed(db: PrismaClient, log: (line: string) => void = console.log) {
  const tables = Object.values(Prisma.ModelName).map((name) => `"${name}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);

  const catalogue = await seedCatalogue(db);
  log(`Seeded catalogue: ${catalogue.brands} brands, ${catalogue.categories} categories, ${catalogue.skus} SKUs, ${catalogue.schemes} schemes`);
  const people = await seedPeople(db);
  log(`Seeded people: ${people.tiers} price tiers, ${people.retailers} retailers, ${people.users} users`);
  const team = await seedFieldTeam(db);
  log(`Seeded field team: ${team.vans} vans, ${team.salesmen} salesmen, ${team.assigned} shops assigned`);
  const history = await seedPastOrders(db);
  log(`Seeded past orders: ${history.orders} exported orders, ${history.lines} lines`);
}
