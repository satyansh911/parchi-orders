// One-time (and repeatable) setup of the integration test database (D49):
// 1. guard: TEST_DATABASE_URL must be a separate, non-protected database;
// 2. apply migrations to that database only;
// 3. create the marker table that integration tests require.
// Usage: pnpm test:db:init

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { TEST_MARKER_TABLE } from "../src/server/testing/db-guard";
import { createTestClient, resolveTestDatabaseUrl } from "../src/server/testing/test-database";

async function main() {
  const url = resolveTestDatabaseUrl();
  console.log(`Test database: ${new URL(url).hostname}`);

  // prisma.config.ts migrates whatever DIRECT_URL is; dotenv does not override
  // variables that are already set, so this targets the test database only.
  const migrate = spawnSync("pnpm", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DIRECT_URL: url },
    stdio: "inherit",
  });
  if (migrate.status !== 0) throw new Error("prisma migrate deploy failed on the test database");

  const db = createTestClient(url);
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${TEST_MARKER_TABLE}" (created_at timestamptz NOT NULL DEFAULT now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "${TEST_MARKER_TABLE}" SELECT WHERE NOT EXISTS (SELECT 1 FROM "${TEST_MARKER_TABLE}")`,
    );
    console.log(`Marker table "${TEST_MARKER_TABLE}" is present. Integration tests may use this database.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
