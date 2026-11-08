// Runtime side of the integration-test guard (D49). Used by the integration
// global setup, the test helpers and scripts/test-db-init.ts.

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  TEST_MARKER_TABLE,
  UnsafeTestDatabaseError,
  assertSafeTestDatabase,
  parseProtectedHosts,
} from "./db-guard";

/** TEST_DATABASE_URL after the guard has checked it against every protected database. */
export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  assertSafeTestDatabase({
    testUrl: env.TEST_DATABASE_URL,
    protectedUrls: [env.DATABASE_URL, env.DIRECT_URL],
    protectedHosts: parseProtectedHosts(env.PROTECTED_DATABASE_HOSTS),
  });
  return env.TEST_DATABASE_URL as string;
}

export function createTestClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** The marker table exists only in databases created by `pnpm test:db:init`. */
export async function hasTestMarker(db: PrismaClient): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('public."${TEST_MARKER_TABLE}"') IS NOT NULL AS exists`,
  );
  return rows[0]?.exists === true;
}

/**
 * Empties every app table, after re-checking the marker on this very connection.
 * The marker table itself is not a Prisma model, so it survives.
 */
export async function resetTestDatabase(db: PrismaClient): Promise<void> {
  await assertTestMarker(db);
  const tables = Object.values(Prisma.ModelName).map((name) => `"${name}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export async function assertTestMarker(db: PrismaClient): Promise<void> {
  if (!(await hasTestMarker(db))) {
    throw new UnsafeTestDatabaseError(
      `the database has no "${TEST_MARKER_TABLE}" table. Run \`pnpm test:db:init\` once against the test branch.`,
    );
  }
}
