// Render docs/TDD.html to docs/TDD.pdf with the Playwright Chromium already
// used for E2E (no extra dependency). Run: pnpm exec tsx scripts/render-tdd.mts
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const html = resolve("docs/TDD.html");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
await page.pdf({
  path: resolve("docs/TDD.pdf"),
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#8a8a90">Parchi Orders · Technical Design Document · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
});
await browser.close();
console.log("wrote docs/TDD.pdf");
