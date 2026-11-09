import { defineConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { PREFER_IPV4 } from "./e2e/global-setup";
import { assertSafeTestDatabase, parseProtectedHosts } from "./src/server/testing/db-guard";

// End-to-end tests (D88): a 360 px touch phone, against the guarded TEST
// BRANCH only. The guard runs here, before the app server starts, and again in
// the seed script (which also requires the test marker). Never the primary.
loadEnv({ quiet: true });
const testUrl = assertSafeTestDatabase({
  testUrl: process.env.TEST_DATABASE_URL,
  protectedUrls: [process.env.DATABASE_URL, process.env.DIRECT_URL],
  protectedHosts: parseProtectedHosts(process.env.PROTECTED_DATABASE_HOSTS),
}).toString();

const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1, // tests share one seeded database
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "hi-IN",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    // The app talks ONLY to the guarded test branch; other env comes from .env.
    env: { DATABASE_URL: testUrl, DIRECT_URL: testUrl, AUTH_DEMO_OTP: "true", AI_CAPTURE_PROVIDER: "fake", NODE_OPTIONS: PREFER_IPV4 },
    stdout: "ignore",
    stderr: "pipe",
  },
});
