import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "../docs/screenshots");
const base = process.env.OPENJEV_VIZ_URL ?? "http://127.0.0.1:5173/";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

await page.goto(base, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1200);

await page.screenshot({
  path: path.join(out, "01-hero.png"),
  clip: { x: 0, y: 0, width: 1440, height: 900 },
});

await page.locator("#ask").scrollIntoViewIfNeeded();
await page.getByRole("tab", { name: "Choice" }).click();
await page.getByRole("button", { name: "Run decision" }).click();
await page.locator("#ask .verdict span").first().waitFor({ timeout: 120_000 });
await page.waitForTimeout(500);
await page.locator("#ask").screenshot({ path: path.join(out, "02-studio-choice.png") });

await page.getByRole("tab", { name: "Yes / No" }).click();
await page.getByRole("button", { name: "Run decision" }).click();
await page.locator("#ask .ask__title").first().waitFor({ timeout: 120_000 });
await page.waitForTimeout(500);
await page.locator("#ask").screenshot({ path: path.join(out, "03-studio-noul.png") });

await page.getByRole("tab", { name: "Score" }).click();
await page.getByRole("button", { name: "Run decision" }).click();
await page.locator("#ask .verdict span").first().waitFor({ timeout: 120_000 });
await page.waitForTimeout(500);
await page.locator("#ask").screenshot({ path: path.join(out, "04-studio-score.png") });

await page.locator("#examples").scrollIntoViewIfNeeded();
const refresh = page.getByRole("button", { name: "Refresh" });
if (await refresh.count()) {
  await refresh.click();
  await page.waitForTimeout(10_000);
}
await page.locator("#examples").screenshot({
  path: path.join(out, "05-live-examples.png"),
});

await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({
  path: path.join(out, "00-overview.png"),
  fullPage: true,
});

await browser.close();
console.log(`Wrote screenshots to ${out}`);
