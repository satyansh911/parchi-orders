import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: pure and fast, never touch a database.
// Integration tests (*.int.test.ts) run separately: vitest.integration.config.mts.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Test-only: Next.js enforces server-only in its build.
      "server-only": fileURLToPath(new URL("./src/server/testing/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.int.test.ts"],
  },
});
