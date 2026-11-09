import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, login } from "./helpers";

// AI capture with the scripted fake provider (D100): message → review → cart.
// Nothing is ordered until the retailer places the cart (D92).

test("capture journey: brief's message → review lines → add to cart once", async ({ page }) => {
  await login(page, "9999900102");
  await page.getByRole("link", { name: "पर्ची" }).click();
  await expect(page).toHaveURL(/\/capture$/);
  await page.getByLabel("आपका ऑर्डर संदेश").fill("bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti");
  await page.getByRole("button", { name: "ऑर्डर समझें" }).click();

  await expect(page).toHaveURL(/\/capture\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "ऑर्डर जाँचें" })).toBeVisible();
  const lines = page.getByTestId("capture-line");
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toContainText("5 peti biscuit chhota");
  await expectNoHorizontalScroll(page);

  // The out-of-stock tea line is removed; any line still unchecked is confirmed.
  await lines.nth(2).getByRole("button", { name: "हटाएँ" }).click();
  for (let i = 0; i < 2; i++) {
    const ok = lines.nth(i).getByRole("button", { name: "सही है" });
    if (await ok.isVisible()) await ok.click();
  }
  await page.getByRole("button", { name: "2 सामान कार्ट में डालें" }).click();

  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByText("कुल देय (GST सहित)")).toBeVisible();

  // Going back to the capture never adds it twice (D98).
  await page.goBack();
  await expect(page.getByText("कार्ट में डाल दिया।")).toBeVisible();
});

test("capture failure shows the manual path, never a crash", async ({ page }) => {
  await login(page, "9999900103");
  await page.goto("/capture");
  await page.getByLabel("आपका ऑर्डर संदेश").fill("5 peti biscuit #timeout");
  await page.getByRole("button", { name: "ऑर्डर समझें" }).click();
  await expect(page.getByRole("heading", { name: "यह संदेश नहीं पढ़ पाए" })).toBeVisible();
  await expect(page.getByRole("link", { name: "सामान खुद जोड़ें" })).toBeVisible();
});
