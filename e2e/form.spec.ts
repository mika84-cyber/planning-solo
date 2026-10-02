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

test("la barre du formulaire tient sur une ligne sur grand écran et devient une rangée d’outils sur téléphone", async ({ page }, testInfo) => {
  await page.goto("/formulaire/index.html");
  const back = page.getByRole("link", { name: "Revenir à l’application" });
  const tools = page.getByRole("group", { name: "Outils du formulaire" });
  const pdf = page.locator("#btnPdf");
  await expect(pdf).toBeVisible();
  const [backBox, toolsBox, pdfBox] = await Promise.all([back.boundingBox(), tools.boundingBox(), pdf.boundingBox()]);
  if ((page.viewportSize()?.width ?? 0) > 760) {
    // Retour, outils et PDF alignés sur une même ligne, le PDF à droite.
    expect(Math.abs((toolsBox!.y + toolsBox!.height / 2) - (pdfBox!.y + pdfBox!.height / 2))).toBeLessThan(3);
    expect(Math.abs((backBox!.y + backBox!.height / 2) - (pdfBox!.y + pdfBox!.height / 2))).toBeLessThan(3);
    expect(pdfBox!.x).toBeGreaterThan(toolsBox!.x + toolsBox!.width);
  } else {
    // Retour, puis la rangée d’outils, puis le PDF en pleine largeur.
    expect(toolsBox!.y).toBeGreaterThan(backBox!.y + backBox!.height - 1);
    expect(pdfBox!.y).toBeGreaterThan(toolsBox!.y + toolsBox!.height - 1);
    expect(Math.abs(pdfBox!.width - toolsBox!.width)).toBeLessThan(2);
    await expect(tools.locator("#btnSecond")).toHaveAccessibleName("Feuille");
  }
  if (testInfo.project.name === "ordinateur") await expect(page.locator("#btnOutlook")).toBeHidden();
  else await expect(page.locator("#btnOutlook")).toBeVisible();
  // Ajouter une feuille ne change que le libellé : l’icône reste.
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#btnSecond").click();
  await expect(page.locator("#pageStatus")).toHaveText("Feuille 2 / 2");
  await expect(page.locator("#btnSecond svg")).toHaveCount(1);
});
