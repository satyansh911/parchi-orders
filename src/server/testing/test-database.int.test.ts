import { afterAll, describe, expect, it } from "vitest";
import { databaseIdentity } from "./db-guard";
import { createTestClient, hasTestMarker, resolveTestDatabaseUrl } from "./test-database";

const url = resolveTestDatabaseUrl();
const db = createTestClient(url);
afterAll(() => db.$disconnect());

describe("integration test database", () => {
  it("is marked as a test database", async () => {
    expect(await hasTestMarker(db)).toBe(true);
  });

  it("is a different endpoint from the primary database", () => {
    const primary = [process.env.DATABASE_URL, process.env.DIRECT_URL]
      .filter((u): u is string => Boolean(u))
      .map(databaseIdentity);
    expect(primary).not.toContain(databaseIdentity(url));
  });

  it("has the schema migrated", async () => {
    const rows = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
