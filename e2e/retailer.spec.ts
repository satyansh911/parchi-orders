import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, login, productRow } from "./helpers";

// Retailer journeys at 360 px against the seeded test branch (D88).
// Names are matched on a nukta-free part of the Hindi text.

test("core journey: Hindi login → search → add → nudge → place → history → order again", async ({ page }) => {
  await login(page, "9999900101"); // R-0001, Hindi by default (D72)
  await expect(page).toHaveURL(/\/catalogue/);
  await expect(page.getByText("Gupta Kirana Store")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Instant search understands shop words (D82).
  await page.getByLabel("सामान खोजें").fill("chai patti 250");
  await expect(productRow(page, /चाय पत्ती 250/)).toBeVisible();
  await expect(productRow(page, /बिस्कुट 75/)).toHaveCount(0);
  await page.getByLabel("सामान खोजें").fill("");

  // Add the brief's glucose biscuit and step up to 7 cases.
  const biscuit = productRow(page, /ग्लूको.*बिस्कुट 75/);
  await biscuit.getByRole("button", { name: "जोड़ें" }).click();
  for (let i = 0; i < 6; i++) await biscuit.getByRole("button", { name: /की एक पेटी और/ }).click();
  await expect(biscuit.getByRole("group").locator("output")).toHaveText("7");

  // Cart: server preview shows the nudge; tapping it moves to 10 → 1 free case (D44).
  await page.getByRole("link", { name: /कार्ट/ }).click();
  await expect(page).toHaveURL(/\/cart/);
  const nudge = page.getByRole("button", { name: "3 पेटी और लें, 1 पेटी मुफ़्त" });
  await expect(nudge).toBeVisible();
  await nudge.click();
  await expect(page.getByText("+ 1 मुफ़्त").first()).toBeVisible();
  await expect(page.getByText("कुल देय (GST सहित)")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Place (D75, D76): waits for the fresh preview before the button enables.
  const place = page.getByRole("button", { name: /ऑर्डर करें/ });
  await expect(place).toBeEnabled();
  await place.click();
  await expect(page.getByRole("heading", { name: "ऑर्डर हो गया" })).toBeVisible();
  await page.getByRole("link", { name: "ऑर्डर देखें" }).click();
  await expect(page.getByText("मंज़ूरी का इंतज़ार").first()).toBeVisible();
  await expect(page.getByText("+ 1 मुफ़्त")).toBeVisible();

  // History lists it; "Order again" copies it back into the (now empty) cart (D9).
  await page.getByRole("link", { name: /सभी ऑर्डर/ }).click();
  await expect(page.getByRole("heading", { name: "आपके ऑर्डर" })).toBeVisible();
  await page.getByRole("link", { name: /ऑर्डर #91/ }).click();
  await page.getByRole("button", { name: "फिर से ऑर्डर करें" }).click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByRole("group").locator("output").first()).toHaveText("10");
});

test("over-limit order needs explicit confirmation and lands on credit hold (D79)", async ({ page }) => {
  await login(page, "9999900107"); // R-0007: at the limit
  await expect(page.getByText(/उपलब्ध क्रेडिट ₹0\.00/)).toBeVisible();
  await productRow(page, /डिटर्जेंट पाउडर 1/).getByRole("button", { name: "जोड़ें" }).click();
  await page.getByRole("link", { name: /कार्ट/ }).click();
  await expect(page.getByText(/आपके उपलब्ध क्रेडिट से .* ज़्यादा है/).first()).toBeVisible();
  await page.getByRole("button", { name: /ऑर्डर करें/ }).click();
  await expect(page.getByRole("alertdialog")).toContainText("क्रेडिट सीमा से ज़्यादा");
  await page.getByRole("button", { name: "फिर भी ऑर्डर करें" }).click();
  await expect(page.getByText("क्रेडिट होल्ड पर। ऑफ़िस इसे देखेगा।")).toBeVisible();
});

test("free goods that don't fit offer explicit choices (D18, D42)", async ({ page }) => {
  await login(page, "9999900102"); // R-0002: key account, plenty of credit
  await productRow(page, /क्रीम बिस्कुट/).getByRole("button", { name: "जोड़ें" }).click();
  // Jump to 50 cases (all 50 in stock) without 49 taps: edit the device cart directly.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("parchi_cart_v1_"))!;
    const cart = JSON.parse(localStorage.getItem(key)!);
    cart.lines[0].paidCases = 50;
    localStorage.setItem(key, JSON.stringify(cart));
  });
  await page.goto("/cart");
  await expect(page.getByText("बचे स्टॉक में मुफ़्त माल पूरा नहीं आएगा। एक चुनें:")).toBeVisible();
  await expect(page.getByRole("button", { name: /46 पेटी \+ 4 मुफ़्त/ })).toBeVisible();
  await page.getByRole("button", { name: /50 पेटी, 3% छूट के साथ/ }).click();
  await expect(page.getByText(/सबसे अच्छा ऑफ़र लगा: 5 या ज़्यादा पेटी पर 3% छूट/)).toBeVisible();
  await expect(page.getByRole("button", { name: /ऑर्डर करें/ })).toBeEnabled();
});

test("out-of-stock tea can't be added", async ({ page }) => {
  await login(page, "9999900101");
  const tea = productRow(page, /चाय पत्ती 250/);
  await expect(tea.getByText(/स्टॉक ख/)).toBeVisible();
  await expect(tea.getByRole("button", { name: "जोड़ें" })).toBeDisabled();
});

test("a retailer opening the desk sees not-found and no desk content (D62, D73)", async ({ page }) => {
  await login(page, "9999900101");
  await page.goto("/desk");
  await expect(page.getByText(/could not be found/i)).toBeVisible();
  await expect(page.getByText("Order desk")).toHaveCount(0);
});

test("language choice sticks across reloads and logins (D72)", async ({ page }) => {
  await login(page, "9999900103");
  await page.getByRole("button", { name: "भाषा अंग्रेज़ी में बदलें" }).click();
  await expect(page.getByRole("link", { name: "Catalogue" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Catalogue" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByLabel("Mobile number")).toBeVisible(); // the device cookie keeps English
  await login(page, "9999900103");
  await expect(page.getByRole("link", { name: "Orders" })).toBeVisible(); // saved on the account
  await expectNoHorizontalScroll(page);
});
