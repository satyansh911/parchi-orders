// Demo seed. Run with `pnpm db:seed`. Targets DATABASE_URL.
// It RESETS the database first (TRUNCATE all tables), so the demo always starts
// from the same known state. Only ever point it at a demo database.
// Past orders are priced by the same domain engine the app uses (D36).

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { runSeed } from "./seed-data/run-seed";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await runSeed(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
