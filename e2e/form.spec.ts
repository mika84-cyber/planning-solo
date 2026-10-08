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

test("la barre du formulaire tient sur une ligne sur grand écran et met le PDF au-dessus des outils sur téléphone", async ({ page }, testInfo) => {
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
    // Retour, puis le PDF en pleine largeur, puis la rangée d’outils.
    expect(pdfBox!.y).toBeGreaterThan(backBox!.y + backBox!.height - 1);
    expect(toolsBox!.y).toBeGreaterThan(pdfBox!.y + pdfBox!.height - 1);
    expect(Math.abs(pdfBox!.width - toolsBox!.width)).toBeLessThan(2);
    await expect(tools.locator("#btnSecond")).toHaveAccessibleName("Feuille");
    // Le retour devient une flèche sur la ligne du choix du formulaire.
    const choiceBox = await page.locator(".form-choice").boundingBox();
    expect(backBox!.y).toBeLessThan(choiceBox!.y + choiceBox!.height);
    expect(backBox!.width).toBeLessThan(60);
    // En faisant défiler la feuille, le PDF reste accessible en haut de l’écran.
    const floating = page.locator(".pdf-floating");
    await expect(floating).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(floating).toBeVisible();
    expect((await floating.boundingBox())!.y).toBeLessThan(20);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(floating).toBeHidden();
  }
  if (testInfo.project.name === "ordinateur") await expect(page.locator("#btnOutlook")).toBeHidden();
  else await expect(page.locator("#btnOutlook")).toBeVisible();
  // Ajouter une feuille ne change que le libellé : l’icône reste.
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#btnSecond").click();
  await expect(page.locator("#pageStatus")).toHaveText("Feuille 2 / 2");
  await expect(page.locator("#btnSecond svg")).toHaveCount(1);
});

test("la signature enregistrée sur le téléphone revient d’elle-même sur le formulaire vierge de l’ordinateur", async ({ page }) => {
  // Un petit PNG bleu, comme une signature enregistrée sur le compte.
  const signature = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 40; canvas.height = 20;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#0b3baf"; context.fillRect(5, 5, 30, 10);
    return canvas.toDataURL("image/png");
  });
  await page.route("**/api/calendar", (route) =>
    route.fulfill({ json: { form_profile: { full_name: "Mika", group: "2", signature } } }));
  await page.goto("/formulaire/index.html");
  await expect(page.locator("#sig")).toHaveClass(/has/);
  expect(await page.locator("#sig").evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 3; index < data.length; index += 4) if (data[index]) return true;
    return false;
  })).toBe(true);
});
