import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the guarded Neon test branch (D49).
// The global setup refuses to run unless TEST_DATABASE_URL is a separate,
// marked test database.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/server/testing/integration-global-setup.ts"],
    setupFiles: ["dotenv/config"],
    // Files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
