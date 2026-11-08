import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: pure and fast, never touch a database.
// Integration tests (*.int.test.ts) run separately: vitest.integration.config.mts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.int.test.ts"],
  },
});
