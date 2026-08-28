import { expect, test } from "@playwright/test";

test("le formulaire modulaire charge ses données et ses commandes", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  const response = await page.goto("/formulaire/index.html");
  expect(response?.ok()).toBe(true);

  await expect(page.locator("#sheet option")).not.toHaveCount(0);
  await expect(page.locator("#paper")).toBeVisible();
  await expect(page.locator("#bg")).toHaveAttribute("src", /form-bg-/);
  await expect(page.locator("#btnPdf")).toBeVisible();
  await expect(page.locator("#btnOutlook")).toBeAttached();
  await expect(page.locator("#btnBackApp")).toHaveAttribute("href", "/");
  expect(await page.evaluate(() => Array.isArray((window as any).SHEETS))).toBe(true);
  expect(runtimeErrors).toEqual([]);
});
