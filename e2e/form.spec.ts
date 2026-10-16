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

test("la demande d’échange se remplit, reporte les dates chez le collègue et se télécharge", async ({ page }, testInfo) => {
  const signature = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 40; canvas.height = 20;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#0b3baf"; context.fillRect(5, 5, 30, 10);
    return canvas.toDataURL("image/png");
  });
  await page.route("**/api/calendar", (route) =>
    route.fulfill({ json: { form_profile: { full_name: "Mika Test", group: "2", signature } } }));
  // Le profil du formulaire donne le nom et le groupe, absent de cette feuille.
  await page.addInitScript(() => localStorage.setItem("demandes:v6:profil", JSON.stringify({ nom: "Mika Test", groupe: "2" })));
  await page.goto("/formulaire/index.html");
  // Demande d’échange en troisième, l’annulation en dernier.
  await expect(page.locator("#sheet option")).toHaveText([
    "Demande de congés", "Demande de récupérations", "Demande d'échange", "Demande d'annulation de congés",
  ]);
  await page.locator("#sheet").selectOption({ label: "Demande d'échange" });
  await expect(page.locator("#bg")).toHaveAttribute("src", /form-bg-4\.png/);

  const field = (name: string) => page.getByRole("textbox", { name, exact: true });
  const now = new Date();
  const today = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  await expect(field("Date de la demande")).toHaveValue(today);
  await expect(field("Prénom - Nom")).toHaveValue("Mika Test");

  // Le repos demandé se pose sur un jour travaillé, l’échange sur un jour de repos.
  const calendar = page.locator("#calModal");
  await field("Je souhaite être en repos le").click();
  await expect(calendar).toHaveClass(/on/);
  await expect(calendar.locator(".calday.off:not(:disabled)")).toHaveCount(0);
  await calendar.locator(".calday:not(:disabled)").first().click();
  const repos = await field("Je souhaite être en repos le").inputValue();
  expect(repos).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

  await field("Et être planifié en échange le").click();
  await expect(calendar.locator(".calday:not(.off):not(:disabled)")).toHaveCount(0);
  await calendar.locator(".calday.off:not(:disabled)").first().click();
  const echange = await field("Et être planifié en échange le").inputValue();
  expect(echange).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

  await field("Mes horaires le jour de l’échange — de (heure)").click();
  await page.locator("#timeFrom").selectOption(String(10 * 60));
  await page.locator("#timeTo").selectOption(String(18 * 60));
  await page.locator("#timeOk").click();

  // La partie du collègue reprend les mêmes dates et horaires.
  await expect(field("Le collègue sera planifié le")).toHaveValue(repos);
  await expect(field("Le collègue sera en repos en échange le")).toHaveValue(echange);
  await expect(field("Horaires du collègue — de (heure)")).toHaveValue("10h00");
  await expect(field("Horaires du collègue — à (heure)")).toHaveValue("18h00");

  await field("Prénom - Nom du collègue").click();
  await page.locator("#editInp").fill("Agnès Exemple");
  await page.locator("#navDone").click();
  await expect(page.locator("#sig")).toHaveClass(/has/);
  // Le collègue signe sur la seconde ligne, avec la même fenêtre de signature.
  await expect(page.locator("#sig2")).toBeVisible();
  // Les invites restent dans leur case, même sur téléphone et avec une police
  // plus large (Android, Linux) : on l'élargit puis on relance la mise en page.
  await page.addStyleTag({ content: "#sighint2 { letter-spacing: 3px; }" });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(600);
  for (const hint of ["#sighint2"]) {
    const fits = await page.locator(hint).evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(fits).toBe(true);
  }
  // Trop étroite pour le texte entier, l'invite se raccourcit.
  if (testInfo.project.name === "mobile") await expect(page.locator("#sighint2")).toHaveText("Collègue");
  await page.locator("#sig2").dispatchEvent("pointerdown");
  await expect(page.locator("#sigModal")).toHaveClass(/on/);
  if (await page.locator("#sigTypedName").isVisible()) await expect(page.locator("#sigTypedName")).toHaveValue("Agnès Exemple");
  else {
    const pad = (await page.locator("#sigBig").boundingBox())!;
    await page.mouse.move(pad.x + 20, pad.y + pad.height / 2);
    await page.mouse.down();
    await page.mouse.move(pad.x + pad.width - 20, pad.y + pad.height / 2, { steps: 5 });
    await page.mouse.up();
  }
  await page.locator("#sigModalOk").click();
  await expect(page.locator("#sig2")).toHaveClass(/has/);
  // Les deux lignes s'inversent : noms et signatures changent de place.
  const nameTop = (await field("Prénom - Nom").boundingBox())!.y;
  const order = page.getByRole("group", { name: "Première ligne du formulaire" });
  await expect(order.getByRole("button", { name: "Vous" })).toHaveAttribute("aria-pressed", "true");
  await order.getByRole("button", { name: "Le collègue" }).click();
  await expect(order.getByRole("button", { name: "Le collègue" })).toHaveAttribute("aria-pressed", "true");
  expect((await field("Prénom - Nom").boundingBox())!.y).toBeGreaterThan(nameTop);
  expect((await page.locator("#sig").boundingBox())!.y).toBeGreaterThan((await page.locator("#sig2").boundingBox())!.y);
  await order.getByRole("button", { name: "Vous" }).click();
  // Votre signature reste dessinée après l'aller-retour.
  expect(await page.locator("#sig").evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 3; index < data.length; index += 4) if (data[index]) return true;
    return false;
  })).toBe(true);
  await page.locator("#observation").fill("Échange convenu avec ma collègue.");

  if (testInfo.project.name !== "ordinateur") return;
  page.on("dialog", (dialog) => dialog.accept());
  const download = page.waitForEvent("download");
  await page.locator("#btnPdf").click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  if (process.env.FORM_PDF_OUT) await file.saveAs(process.env.FORM_PDF_OUT);
});

test("le nom du compte Netlify préremplit la feuille, et « Vider » efface dates et heures au second appui", async ({ page }) => {
  // Aucun nom saisi dans l'application : celui du compte Netlify est repris.
  await page.route("**/api/calendar", (route) =>
    route.fulfill({ json: { account_name: "Camille Durand", form_profile: null } }));
  await page.goto("/formulaire/index.html");
  await page.locator("#sheet").selectOption({ label: "Demande d'échange" });
  const field = (name: string) => page.getByRole("textbox", { name, exact: true });
  await expect(field("Prénom - Nom")).toHaveValue("Camille Durand");

  await field("Mes horaires le jour de l’échange — de (heure)").click();
  await page.locator("#timeFrom").selectOption(String(10 * 60));
  await page.locator("#timeTo").selectOption(String(18 * 60));
  await page.locator("#timeOk").click();
  await expect(field("Horaires du collègue — de (heure)")).toHaveValue("10h00");

  // Premier appui : le bouton demande confirmation, rien n'est effacé.
  const reset = page.locator("#btnReset");
  await reset.click();
  await expect(reset).toHaveText(/Confirmer/);
  await expect(field("Mes horaires le jour de l’échange — de (heure)")).toHaveValue("10h00");
  await reset.click();
  await expect(reset).toHaveText(/Vider/);
  for (const name of ["Mes horaires le jour de l’échange — de (heure)", "Horaires du collègue — de (heure)", "Je souhaite être en repos le"])
    await expect(field(name)).toHaveValue("");
  await expect(page.locator(".cell.has")).toHaveCount(0);
});
