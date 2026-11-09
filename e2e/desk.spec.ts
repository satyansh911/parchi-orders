import { expect, test } from "@playwright/test";
import { login, productRow } from "./helpers";

// Order desk: a retailer's order is approved and exported to Tally once (D29, D30).

test("desk journey: approve a new order, export it once, download the CSV", async ({ browser }) => {
  const shop = await (await browser.newContext()).newPage();
  await login(shop, "9999900105");
  const row = productRow(shop, /ग्लूको.*बिस्कुट 75/);
  await row.getByRole("button", { name: "जोड़ें" }).click();
  await shop.getByRole("link", { name: /कार्ट/ }).click();
  const place = shop.getByRole("button", { name: /ऑर्डर करें/ });
  await expect(place).toBeEnabled();
  await place.click();
  await shop.getByRole("link", { name: "ऑर्डर देखें" }).click();
  await shop.waitForURL(/\/orders\/[^/]+$/);
  const orderId = new URL(shop.url()).pathname.split("/").pop()!;

  const desk = await (await browser.newContext({ viewport: { width: 1024, height: 800 } })).newPage();
  await login(desk, "9999900001");
  await expect(desk.getByRole("link", { name: /Needs action/ })).toBeVisible();
  await desk.goto(`/desk/orders/${orderId}`);
  await expect(desk.getByRole("heading", { name: /Order #\d+/ })).toBeVisible();
  await expect(desk.getByText("Total (incl. GST)")).toBeVisible();
  await desk.getByRole("button", { name: "Approve" }).click();
  await expect(desk.getByText("Approved", { exact: true }).first()).toBeVisible();

  // A retailer can't open the desk.
  await shop.goto(`/desk/orders/${orderId}`);
  await expect(shop.getByRole("button", { name: "Approve" })).toHaveCount(0);

  await desk.getByRole("link", { name: "Tally export" }).click();
  const exportButton = desk.getByRole("button", { name: /Export \d+ orders to CSV/ });
  await expect(exportButton).toBeVisible();
  await exportButton.click();
  await expect(desk.getByText(/Batch \d+ created/)).toBeVisible();
  await expect(desk.getByText("No approved orders waiting for export.")).toBeVisible();

  const href = await desk.getByRole("link", { name: "Download CSV" }).first().getAttribute("href");
  const csv = await desk.request.get(href!);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toMatch(/^Batch,Voucher Type,Voucher No/);
  expect((await shop.request.get(href!)).status()).toBe(404); // not for retailers
});
