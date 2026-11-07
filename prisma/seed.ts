// Demo seed. Run with `pnpm db:seed`.
// It RESETS the database first (TRUNCATE all tables), so the demo always starts
// from the same known state. Only ever point it at a demo database.
// Past orders are seeded after Phase 2, priced by the domain engine (D36).

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { seedCatalogue } from "./seed-data/seed-catalogue";
import { seedPeople } from "./seed-data/seed-people";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const tables = Object.values(Prisma.ModelName).map((name) => `"${name}"`).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);

    const catalogue = await seedCatalogue(db);
    console.log(
      `Seeded catalogue: ${catalogue.brands} brands, ${catalogue.categories} categories, ` +
        `${catalogue.skus} SKUs, ${catalogue.schemes} schemes`,
    );

    const people = await seedPeople(db);
    console.log(
      `Seeded people: ${people.tiers} price tiers, ${people.retailers} retailers, ${people.users} users`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
