import { expect, test } from "@playwright/test";

// Screenshot of a stored FAILED capture (safe fallback screen) for the TDD.
test("live: failed capture shows the manual path", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/मोबाइल नंबर|Mobile number/).fill("9999900103");
  await page.getByRole("button", { name: /कोड भेजें|Get code/ }).click();
  await page.getByLabel(/6 अंकों का कोड|6-digit code/).fill("123456");
  await page.getByRole("button", { name: /लॉग इन करें|Log in/ }).click();
  await page.waitForURL(/\/catalogue/);
  await page.goto("/capture/" + (process.env.FAILED_CAPTURE_ID ?? ""));
  await expect(page.getByRole("heading", { name: "यह संदेश नहीं पढ़ पाए" })).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/06d-capture-failed.png" });
});
