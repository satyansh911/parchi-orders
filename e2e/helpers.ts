import { expect, type Page } from "@playwright/test";

/** Log in with the demo OTP (D55) through the real login screen. */
export async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel(/मोबाइल नंबर|Mobile number/).fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Get code/ }).click();
  await page.getByLabel(/6 अंकों का कोड|6-digit code/).fill("123456");
  await page.getByRole("button", { name: /लॉग इन करें|Log in/ }).click();
  await page.waitForURL(/\/(catalogue|desk)(\?|$)/); // the session cookie is set once we land home
}

/** The catalogue row for a product, matched by a stable part of its name (avoids nukta encoding differences). */
export const productRow = (page: Page, name: RegExp) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });

/** No horizontal scrolling at 360 px. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
