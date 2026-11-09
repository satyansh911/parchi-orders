import { defineConfig, devices } from "@playwright/test";

// Smoke test of the deployed app (no web server, no database access from here).
// Run: LIVE_URL=https://parchi-orders.vercel.app pnpm exec playwright test -c playwright.live.config.ts
export default defineConfig({
  testDir: "e2e-live",
  timeout: 180_000,
  retries: 0,
  workers: 1,
  use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, baseURL: process.env.LIVE_URL ?? "https://parchi-orders.vercel.app", trace: "retain-on-failure" },
});
