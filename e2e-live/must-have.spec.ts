import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Live check of the MUST HAVE additions with the REAL model. Media files are
// passed in by path (a rendered handwritten list and a TTS Hindi voice note).
const PHOTO = process.env.LIVE_PHOTO;
const VOICE = process.env.LIVE_VOICE;

async function login(page: Page, phone: string, home: RegExp) {
  await page.goto("/login");
  await page.getByLabel(/मोबाइल नंबर|Mobile number/).fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Get code/ }).click();
  await page.getByLabel(/6 अंकों का कोड|6-digit code/).fill("123456");
  await page.getByRole("button", { name: /लॉग इन करें|Log in/ }).click();
  await page.waitForURL(home);
}

async function readLines(page: Page, label: string) {
  await expect(page.getByRole("heading", { name: /ऑर्डर जाँचें|यह संदेश नहीं पढ़ पाए/ })).toBeVisible({ timeout: 45_000 });
  if (await page.getByRole("heading", { name: "यह संदेश नहीं पढ़ पाए" }).isVisible()) return console.log(`${label}: FAILED (manual path shown)`);
  console.log(`${label} transcript: ${(await page.locator("section").first().innerText()).replace(/\s+/g, " ")}`);
  for (const t of await page.getByTestId("capture-line").allInnerTexts()) console.log(`  ${label} line: ${t.split("\n").slice(0, 3).join(" | ").slice(0, 160)}`);
}

test("live: photo of a handwritten list", async ({ page }) => {
  test.skip(!PHOTO);
  await login(page, "9999900108", /\/catalogue/);
  await page.goto("/capture");
  await page.getByRole("tab", { name: "फ़ोटो" }).click();
  await page.getByTestId("photo-input").setInputFiles({ name: "parchi.jpg", mimeType: "image/jpeg", buffer: readFileSync(PHOTO!) });
  const t = Date.now();
  await page.getByRole("button", { name: "ऑर्डर समझें" }).click();
  await readLines(page, "PHOTO");
  console.log(`PHOTO round trip ${Date.now() - t} ms`);
  await page.screenshot({ path: "docs/screenshots/10-photo-review.png" });
});

test("live: Hindi voice note", async ({ page }) => {
  test.skip(!VOICE);
  await login(page, "9999900109", /\/catalogue/);
  await page.goto("/capture");
  await page.getByRole("tab", { name: "आवाज़" }).click();
  await page.getByTestId("voice-input").setInputFiles({ name: "voice.m4a", mimeType: "audio/mp4", buffer: readFileSync(VOICE!) });
  const t = Date.now();
  await page.getByRole("button", { name: "ऑर्डर समझें" }).click();
  await readLines(page, "VOICE");
  console.log(`VOICE round trip ${Date.now() - t} ms`);
  await page.screenshot({ path: "docs/screenshots/11-voice-review.png" });
});

test("live: salesman order taken offline syncs on reconnect", async ({ page, context }) => {
  await login(page, "9999900202", /\/salesman/);
  await expect(page.getByText(/ऑफ़लाइन के लिए तैयार/)).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match("/salesman"))), { timeout: 20_000 }).toBe(true);
  await page.screenshot({ path: "docs/screenshots/12-salesman-shops.png" });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/ऑफ़लाइन: ऑर्डर सेव हैं/)).toBeVisible();
  await page.getByRole("button", { name: /Agrawal Super Store/ }).click();
  const row = page.getByTestId("sm-sku").filter({ hasText: /डिटर्जेंट पाउडर 1/ }).first();
  await row.getByRole("button", { name: "जोड़ें" }).click();
  for (let i = 0; i < 4; i++) await row.getByRole("button", { name: /और/ }).click();
  await page.screenshot({ path: "docs/screenshots/13-salesman-offline-order.png" });
  await page.getByRole("button", { name: /ऑर्डर सेव करें/ }).click();
  const entry = page.getByTestId("sm-outbox-entry").first();
  await expect(entry).toContainText("सिग्नल का इंतज़ार");
  await context.setOffline(false);
  await expect(entry).toContainText(/भेजा गया · ऑर्डर #\d+/, { timeout: 45_000 });
  console.log(`SALESMAN: ${(await entry.innerText()).replace(/\s+/g, " ")}`);
  await page.screenshot({ path: "docs/screenshots/14-salesman-synced.png" });
});

test("live: desk van loading list and inactive dashboard", async ({ browser }) => {
  const desk = await (await browser.newContext({ viewport: { width: 1024, height: 900 } })).newPage();
  await login(desk, "9999900001", /\/desk/);
  await desk.goto("/desk/loading");
  await expect(desk.getByRole("heading", { name: "Van loading lists" })).toBeVisible();
  await desk.screenshot({ path: "docs/screenshots/15-van-loading.png", fullPage: true });
  console.log(`LOADING: ${(await desk.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
  await desk.goto("/desk/inactive");
  await expect(desk.getByRole("heading", { name: "No order in 14 days" })).toBeVisible();
  console.log(`INACTIVE: ${(await desk.locator("main p").first().innerText())}`);
  await desk.screenshot({ path: "docs/screenshots/16-inactive.png" });
});
