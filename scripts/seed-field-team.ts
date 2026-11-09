// Adds vans, salesmen and shop assignments to the EXISTING demo database
// (DATABASE_URL) without resetting it. Idempotent; never deletes.
// Run once after `pnpm db:deploy`: pnpm exec tsx scripts/seed-field-team.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedFieldTeam } from "../prisma/seed-data/seed-field-team";

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    console.log(await seedFieldTeam(db));
  } finally {
    await db.$disconnect();
  }
}
main();
