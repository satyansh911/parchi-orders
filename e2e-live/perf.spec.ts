import { expect, test, type Page } from "@playwright/test";

// First-load measurements on the live app under emulated slow 3G
// (Chrome DevTools preset: 400 ms RTT, 400 kbit/s down, 400 kbit/s up)
// and 4x CPU slowdown, with an empty cache. Chromium emulation only:
// not a real low-end Android device.

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

async function measure(page: Page, path: string) {
  await page.addInitScript(() => {
    (window as unknown as { __lcp: number }).__lcp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as unknown as { __lcp: number }).__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(path, { waitUntil: "load", timeout: 120_000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const js = res.filter((r) => r.initiatorType === "script" || r.name.endsWith(".js"));
    const kb = (n: number) => Math.round(n / 1024);
    return {
      ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp), lcp: Math.round((window as unknown as { __lcp: number }).__lcp),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd),
      htmlKB: kb(nav.transferSize), jsKB: kb(js.reduce((s, r) => s + r.transferSize, 0)), jsFiles: js.length,
      totalKB: kb(nav.transferSize + res.reduce((s, r) => s + r.transferSize, 0)),
    };
  });
}

test("first load: login page (cold, slow 3G, 4x CPU)", async ({ page }) => {
  await throttle(page);
  const m = await measure(page, "/login");
  console.log("LOGIN", JSON.stringify(m));
  expect(m.fcp).toBeGreaterThan(0);
});

test("first load: catalogue after login (cold cache, slow 3G, 4x CPU)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/मोबाइल नंबर|Mobile number/).fill("9999900110");
  await page.getByRole("button", { name: /कोड भेजें|Get code/ }).click();
  await page.getByLabel(/6 अंकों का कोड|6-digit code/).fill("123456");
  await page.getByRole("button", { name: /लॉग इन करें|Log in/ }).click();
  await page.waitForURL(/\/catalogue/);
  await throttle(page);
  const m = await measure(page, "/catalogue");
  console.log("CATALOGUE", JSON.stringify(m));
  const headers = (await page.request.get("/catalogue")).headers();
  console.log("CATALOGUE cache-control:", headers["cache-control"]);
  const login = (await page.request.get("/login")).headers();
  console.log("LOGIN cache-control:", login["cache-control"]);
});
