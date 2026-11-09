import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Salesman mode (D108): take an order with NO network, then it sends itself
// when signal returns. Runs at 360 px like the other journeys.

test("salesman takes an order offline and it syncs when signal returns", async ({ page, context }) => {
  await login(page, "9999900201"); // VAN-1 salesman
  await expect(page).toHaveURL(/\/salesman/);
  await expect(page.getByText("ऑफ़लाइन के लिए तैयार")).toBeVisible({ timeout: 20_000 }); // pack downloaded

  // Let the service worker take control and keep the page and scripts.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText("ऑफ़लाइन के लिए तैयार")).toBeVisible();
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match("/salesman"))), { timeout: 15_000 }).toBe(true);

  // No signal: the app still opens from the phone, with his shops only.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/ऑफ़लाइन: ऑर्डर सेव हैं/)).toBeVisible();
  await expect(page.getByText("Patel Provision")).toBeVisible();
  await expect(page.getByText("Gupta Kirana Store")).toHaveCount(0); // another salesman's shop

  await page.getByText("Patel Provision").click();
  const biscuit = page.getByTestId("sm-sku").filter({ hasText: /बिस्कुट 75/ }).first();
  await biscuit.getByRole("button", { name: "जोड़ें" }).click();
  for (let i = 0; i < 9; i++) await biscuit.getByRole("button", { name: /और/ }).click();
  await expect(biscuit.getByText("+1 मुफ़्त")).toBeVisible();
  await page.getByRole("button", { name: /ऑर्डर सेव करें/ }).click();
  const entry = page.getByTestId("sm-outbox-entry").first();
  await expect(entry).toContainText("सिग्नल का इंतज़ार");

  // Signal returns: it sends itself.
  await context.setOffline(false);
  await expect(entry).toContainText(/भेजा गया · ऑर्डर #\d+/, { timeout: 30_000 });
});
