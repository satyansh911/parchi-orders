// Vitest global setup for `pnpm test:integration` (D49). Runs once, before any
// integration test, and aborts the whole run unless the target is safe.

import "dotenv/config";
import { assertTestMarker, createTestClient, resolveTestDatabaseUrl } from "./test-database";

export default async function setup() {
  const url = resolveTestDatabaseUrl();
  const db = createTestClient(url);
  try {
    await assertTestMarker(db);
  } finally {
    await db.$disconnect();
  }
  console.log(`Integration tests will use ${new URL(url).hostname}`);
}
