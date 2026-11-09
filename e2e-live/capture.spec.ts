import { expect, test } from "@playwright/test";

// One live AI capture with the real model (no repeated evaluations).
test("live: AI capture of the brief's message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/मोबाइल नंबर|Mobile number/).fill("9999900104");
  await page.getByRole("button", { name: /कोड भेजें|Get code/ }).click();
  await page.getByLabel(/6 अंकों का कोड|6-digit code/).fill("123456");
  await page.getByRole("button", { name: /लॉग इन करें|Log in/ }).click();
  await page.waitForURL(/\/catalogue/);
  await page.goto("/capture");
  await page.getByLabel("आपका ऑर्डर संदेश").fill("bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti");
  const started = Date.now();
  await page.getByRole("button", { name: "ऑर्डर समझें" }).click();
  await page.waitForURL(/\/capture\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /ऑर्डर जाँचें|यह संदेश नहीं पढ़ पाए/ })).toBeVisible({ timeout: 20_000 });
  console.log(`round trip ${Date.now() - started} ms`);
  const failed = await page.getByRole("heading", { name: "यह संदेश नहीं पढ़ पाए" }).isVisible();
  console.log(`outcome: ${failed ? "FAILED" : "PARSED"}`);
  if (failed) return;
  await page.screenshot({ path: "docs/screenshots/06-capture-review.png", fullPage: true });
  for (const t of await page.getByTestId("capture-line").allInnerTexts()) console.log(`line: ${t.replace(/\s+/g, " ").slice(0, 200)}`);
  // Resolve: remove the out-of-stock tea, accept the rest, add to cart.
  const lines = page.getByTestId("capture-line");
  for (let i = 0; i < (await lines.count()); i++) {
    const line = lines.nth(i);
    if (/chai/.test(await line.innerText())) { await line.getByRole("button", { name: "हटाएँ" }).click(); continue; }
    const ok = line.getByRole("button", { name: "सही है" });
    if (await ok.isVisible() && await ok.isEnabled()) await ok.click();
  }
  await page.screenshot({ path: "docs/screenshots/06b-capture-resolved.png", fullPage: true });
  await page.getByRole("button", { name: /कार्ट में डालें/ }).click();
  await page.waitForURL(/\/cart/);
  await expect(page.getByText("कुल देय (GST सहित)")).toBeVisible({ timeout: 20_000 });
  console.log("added to cart");
});
