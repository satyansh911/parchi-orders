import { expect, test, type Page } from "@playwright/test";

// Live smoke test of the deployed app, also saving screenshots for the TDD.
// Places one real order on the demo database and exports it.
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: false });

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel(/मोबाइल नंबर|Mobile number/).fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Get code/ }).click();
  await page.getByLabel(/6 अंकों का कोड|6-digit code/).fill("123456");
  await page.getByRole("button", { name: /लॉग इन करें|Log in/ }).click();
  await page.waitForURL(/\/(catalogue|desk)(\?|$)/);
}

test("live: retailer catalogue → cart → order, AI capture, desk approve → Tally CSV", async ({ browser, page }) => {
  await page.goto("/login");
  await shot(page, "01-login");
  await login(page, "9999900103");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await shot(page, "02-catalogue");

  const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /डिटर्जेंट पाउडर 1/ }) });
  await row.getByRole("button", { name: "जोड़ें" }).click();
  for (let i = 0; i < 4; i++) await row.getByRole("button", { name: /की एक पेटी और/ }).click();
  await page.getByRole("link", { name: /कार्ट/ }).click();
  await expect(page.getByText("कुल देय (GST सहित)")).toBeVisible();
  const place = page.getByRole("button", { name: /ऑर्डर करें/ });
  await expect(place).toBeEnabled({ timeout: 20_000 });
  await shot(page, "03-cart");
  await place.click();
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button").last().click();
  await expect(page.getByRole("heading", { name: "ऑर्डर हो गया" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "ऑर्डर देखें" }).click();
  await page.waitForURL(/\/orders\/[^/]+$/);
  const orderId = new URL(page.url()).pathname.split("/").pop()!;
  await shot(page, "04-order");

  // AI capture with the real model (one call).
  await page.getByRole("link", { name: "पर्ची" }).click();
  await page.getByLabel("आपका ऑर्डर संदेश").fill("bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti");
  await shot(page, "05-capture");
  const started = Date.now();
  await page.getByRole("button", { name: "ऑर्डर समझें" }).click();
  await page.waitForURL(/\/capture\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /ऑर्डर जाँचें|यह संदेश नहीं पढ़ पाए/ })).toBeVisible({ timeout: 20_000 });
  console.log(`capture round trip: ${Date.now() - started} ms`);
  const failed = await page.getByRole("heading", { name: "यह संदेश नहीं पढ़ पाए" }).isVisible();
  await shot(page, "06-capture-review");
  console.log(`capture outcome: ${failed ? "FAILED (manual path shown)" : "PARSED"}`);
  if (!failed) {
    const lines = page.getByTestId("capture-line");
    console.log(`capture lines: ${await lines.count()}`);
    for (const text of await lines.allInnerTexts()) console.log(`  line: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
  }

  // Desk: approve the catalogue order, export, download.
  const desk = await (await browser.newContext({ viewport: { width: 1024, height: 900 } })).newPage();
  await login(desk, "9999900001");
  await desk.waitForLoadState("networkidle");
  await desk.screenshot({ path: "docs/screenshots/07-desk-queue.png" });
  await desk.goto(`/desk/orders/${orderId}`);
  await expect(desk.getByText("Total (incl. GST)")).toBeVisible();
  await desk.screenshot({ path: "docs/screenshots/08-desk-order.png", fullPage: true });
  await desk.getByRole("button", { name: /^(Approve|Release hold and approve)$/ }).click();
  await expect(desk.getByText("Approved", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await desk.getByRole("link", { name: "Tally export" }).click();
  const exportButton = desk.getByRole("button", { name: /Export \d+ orders to CSV/ });
  await expect(exportButton).toBeVisible();
  await exportButton.click();
  await expect(desk.getByText(/Batch \d+ created/)).toBeVisible({ timeout: 20_000 });
  await desk.screenshot({ path: "docs/screenshots/09-desk-export.png" });
  const href = await desk.getByRole("link", { name: "Download CSV" }).first().getAttribute("href");
  const csv = await desk.request.get(href!);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toMatch(/^Batch,Voucher Type,Voucher No/);
  console.log(`csv rows: ${body.trimEnd().split("\r\n").length - 1}`);
  console.log(`csv first row: ${body.split("\r\n")[1]}`);
  expect((await page.request.get(href!)).status()).toBe(404);
  const region = (await desk.request.get(`/desk/exports`)).headers()["x-vercel-id"];
  console.log(`x-vercel-id (dynamic page): ${region}`);
});
