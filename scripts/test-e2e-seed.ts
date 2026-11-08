// Seed the TEST BRANCH with the demo data for end-to-end runs (D88).
// Refuses unless TEST_DATABASE_URL passes the guard (separate endpoint, not the
// primary or any protected host, verify-full) AND the database carries the
// test marker. The primary database is never touched.
// Usage: pnpm test:e2e:seed

import "dotenv/config";
import { runSeed } from "../prisma/seed-data/run-seed";
import { assertTestMarker, createTestClient, resolveTestDatabaseUrl } from "../src/server/testing/test-database";

async function main() {
  const url = resolveTestDatabaseUrl();
  const db = createTestClient(url);
  try {
    await assertTestMarker(db);
    console.log(`Seeding test database: ${new URL(url).hostname}`);
    await runSeed(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
