import { devices, expect, test, type Page, type Route } from "@playwright/test";
import { adaptStandalonePage } from "../scripts/build-congecp.mjs";

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

test("le formulaire vierge de l’application s’ouvre sur la demande de congés, pas sur la dernière feuille", async ({ page }) => {
  const sheet = page.locator("#sheet option:checked");
  await page.goto("/formulaire/index.html");
  await page.evaluate(() => localStorage.setItem("demandes:v4:last", "recup"));
  // Sans demande dans l'adresse, la dernière feuille utilisée revient.
  await page.reload();
  await expect(sheet).toHaveText("Demande de récupérations");
  await page.goto("/formulaire/index.html?feuille=conges");
  await expect(sheet).toHaveText("Demande de congés");
  // La lecture différée de la dernière feuille ne la remplace pas.
  await page.waitForTimeout(400);
  await expect(sheet).toHaveText("Demande de congés");
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

/** Deux petits PNG, bleu et rouge, pour reconnaître d'où vient la signature. */
function signaturePngs(page: Page) {
  return page.evaluate(() => ["#0b3baf", "#c0262d"].map((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = 40; canvas.height = 20;
    const context = canvas.getContext("2d")!;
    context.fillStyle = color; context.fillRect(5, 5, 30, 10);
    return canvas.toDataURL("image/png");
  }));
}

test("sur l’ordinateur, la signature du compte remplace la copie du brouillon, jamais une signature faite sur place", async ({ page, isMobile }) => {
  test.skip(isMobile, "Sur téléphone, la signature se garde dans son propre emplacement.");
  const [blue, red] = await signaturePngs(page);
  let accountSignature = blue;
  await page.route("**/api/calendar", (route) =>
    route.fulfill({ json: { form_profile: { full_name: "Mika", group: "2", signature: accountSignature } } }));
  const ink = () => page.locator("#sig").evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let reds = 0, blues = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 200) continue;
      if (data[index] > 150 && data[index + 2] < 100) reds++;
      else if (data[index + 2] > 120 && data[index] < 60) blues++;
    }
    return reds > blues ? "rouge" : blues ? "bleu" : "vide";
  });
  /** Pose le brouillon de la feuille de congés, puis rouvre le formulaire. */
  async function reopenWithDraft(draft: Record<string, unknown>) {
    await page.waitForTimeout(1000); // laisse passer l'enregistrement différé du brouillon
    await page.evaluate((value) => localStorage.setItem("demandes:v4:conges", JSON.stringify(value)),
      { v: [], m: [], c: {}, o: "", ...draft });
    await page.reload();
    await expect(page.locator("#paper")).toBeVisible();
  }
  await page.goto("/formulaire/index.html?feuille=conges");
  // Brouillon d'avant la distinction, ou copie du compte : la signature du
  // compte, enregistrée depuis sur le téléphone, passe d'abord.
  await reopenWithDraft({ s: red });
  await expect.poll(ink).toBe("bleu");
  await reopenWithDraft({ s: red, so: 0 });
  await expect.poll(ink).toBe("bleu");
  // Signée sur cet ordinateur : elle reste.
  await reopenWithDraft({ s: red, so: 1 });
  await expect.poll(ink).toBe("rouge");
  // Sans signature sur le compte, celle d'un ancien brouillon n'est pas perdue,
  // mais une copie du compte supprimée depuis ne revient pas.
  accountSignature = "";
  await reopenWithDraft({ s: red });
  await expect.poll(ink).toBe("rouge");
  await reopenWithDraft({ s: red, so: 0 });
  await page.waitForTimeout(500);
  expect(await ink()).toBe("vide");
});

test("une signature gardée sur le téléphone mais absente du compte y est renvoyée, pour que l’ordinateur la retrouve", async ({ page, isMobile }) => {
  test.skip(!isMobile, "La signature ne se garde à part que sur téléphone.");
  const [blue] = await signaturePngs(page);
  let accountSignature = "";
  const sent: unknown[] = [];
  await page.route("**/api/calendar", (route) => {
    if (route.request().method() === "POST") {
      sent.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { form_profile: { full_name: "Mika", group: "2", signature: accountSignature } } });
  });
  await page.goto("/formulaire/index.html?feuille=conges");
  await page.evaluate((data) => {
    localStorage.setItem("demandes:v70:signature-choice", "saved");
    localStorage.setItem("demandes:v70:signature-data", data);
  }, blue);
  await page.reload();
  await expect(page.locator("#sig")).toHaveClass(/has/);
  // Seule la signature part : le nom, le groupe et le reste du profil restent ceux du compte.
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ action: "save-form-profile", signature: blue, signatureUpdate: true });
  // Le compte l'a déjà : rien n'est renvoyé.
  accountSignature = blue;
  await page.reload();
  await expect(page.locator("#sig")).toHaveClass(/has/);
  await page.waitForTimeout(800);
  expect(sent).toHaveLength(1);
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
    "Demande de congés", "Demande de récupérations", "Demande d'échange",
    "Demande de remplacement férié", "Demande d'annulation de congés",
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

test("la demande de remplacement de jour férié se remplit comme l’échange : férié travaillé, collègue sur les mêmes horaires", async ({ page }, testInfo) => {
  await page.route("**/api/calendar", (route) =>
    route.fulfill({ json: { form_profile: { full_name: "Mika Test", group: "2" } } }));
  await page.addInitScript(() => localStorage.setItem("demandes:v6:profil", JSON.stringify({ nom: "Mika Test", groupe: "2" })));
  await page.goto("/formulaire/index.html");
  // Juste après la demande d’échange, l’annulation reste en dernier.
  await expect(page.locator("#sheet option")).toHaveText([
    "Demande de congés", "Demande de récupérations", "Demande d'échange",
    "Demande de remplacement férié", "Demande d'annulation de congés",
  ]);
  await page.locator("#sheet").selectOption({ label: "Demande de remplacement férié" });
  await expect(page.locator("#bg")).toHaveAttribute("src", /form-bg-5\.png/);

  const field = (name: string) => page.getByRole("textbox", { name, exact: true });
  const now = new Date();
  const today = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  await expect(field("Date de la demande")).toHaveValue(today);
  await expect(field("Prénom - Nom")).toHaveValue("Mika Test");

  // Seuls les fériés travaillés se choisissent, le calendrier s’ouvre sur le prochain.
  const calendar = page.locator("#calModal");
  await field("Je souhaite être en repos le (jour férié)").click();
  await expect(calendar).toHaveClass(/on/);
  const choices = calendar.locator(".calday:not(:disabled)");
  expect(await choices.count()).toBeGreaterThan(0);
  expect(await calendar.locator(".calday.off:not(:disabled)").count()).toBe(0);
  await choices.first().click();
  const ferie = await field("Je souhaite être en repos le (jour férié)").inputValue();
  expect(ferie).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

  await field("Mes horaires ce jour-là — de (heure)").click();
  await page.locator("#timeFrom").selectOption(String(10 * 60));
  await page.locator("#timeTo").selectOption(String(18 * 60));
  await page.locator("#timeOk").click();

  // Le collègue est planifié le même jour, sur les mêmes horaires.
  await expect(field("Le collègue sera planifié le")).toHaveValue(ferie);
  await expect(field("Horaires du collègue — de (heure)")).toHaveValue("10h00");
  await expect(field("Horaires du collègue — à (heure)")).toHaveValue("18h00");
  // Comme l’échange, le collègue peut passer en première ligne.
  await expect(page.getByRole("group", { name: "Première ligne du formulaire" })).toBeVisible();

  await field("Prénom - Nom du collègue").click();
  await page.locator("#editInp").fill("Agnès Exemple");
  await page.locator("#navDone").click();
  await expect(page.locator("#sig2")).toBeVisible();
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

test("sous Planning Solo, le calendrier renvoie à la case « Groupe » sans en proposer le choix", async ({ page }) => {
  await page.goto("/formulaire/index.html");
  await page.locator("#sheet").selectOption({ label: "Demande d'échange" });
  await page.getByRole("textbox", { name: "Et être planifié en échange le", exact: true }).click();
  await expect(page.locator("#calModal")).toHaveClass(/on/);
  // Le choix du groupe appartient au site autonome : ici, il n'existe pas.
  await expect(page.locator("#calGroupChoice")).toHaveCount(0);
  await expect(page.locator("#calCycleText"))
    .toHaveText("Indiquez 1, 2 ou 3 dans le champ « Groupe » pour activer le planning.");
});

test("sur le site autonome, le calendrier laisse choisir son groupe et applique son cycle", async ({ page }) => {
  // La page servie est celle de Congé CP, telle que la construction la produit.
  await page.route("**/formulaire/index.html", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      body: adaptStandalonePage(await response.text()),
      contentType: "text/html; charset=utf-8",
    });
  });
  await page.goto("/formulaire/index.html");
  await page.locator("#sheet").selectOption({ label: "Demande d'échange" });
  // Cette feuille n'a pas de case « Groupe » : le cycle se règle au calendrier.
  await expect(page.getByRole("combobox", { name: "Groupe", exact: true })).toHaveCount(0);

  const calendar = page.locator("#calModal");
  await page.getByRole("textbox", { name: "Et être planifié en échange le", exact: true }).click();
  await expect(calendar).toHaveClass(/on/);
  await expect(page.locator("#calCycleText")).toHaveText("Choisissez votre groupe pour afficher le cycle.");
  // Cycle inconnu : aucune date n'est encore écartée.
  const total = await calendar.locator(".calday").count();
  expect(await calendar.locator(".calday:not(:disabled)").count()).toBe(total);

  // Le groupe choisi ici applique son cycle : seuls les jours de repos restent.
  await page.locator('#calGroupChoice [data-group="2"]').click();
  await expect(page.locator("#calCycleText")).toHaveText("Planning groupe 2");
  await expect(page.locator('#calGroupChoice [data-group="2"]')).toHaveAttribute("aria-pressed", "true");
  await expect(calendar.locator(".calday:not(.off):not(:disabled)")).toHaveCount(0);
  expect(await calendar.locator(".calday:not(:disabled)").count()).toBeLessThan(total);

  // La date devient saisissable, et le choix se reporte sur la feuille qui a la case.
  await calendar.locator(".calday.off:not(:disabled)").first().click();
  await expect(page.getByRole("textbox", { name: "Et être planifié en échange le", exact: true }))
    .toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
  await page.locator("#sheet").selectOption({ label: "Demande de congés" });
  await expect(page.getByRole("combobox", { name: "Groupe", exact: true })).toHaveValue("2");
});

/** Remplit le nom et la première ligne de congés annuels, comme le ferait le
 *  calendrier : les dates sont en lecture seule à l'écran. */
async function fillLeaveSheet(page: Page, name: string, from: string, to: string) {
  await page.evaluate(([name, from, to]) => {
    for (const [label, value] of [["NOM - Prénom", name], ["Congés annuels — ligne 1 — du", from], ["Congés annuels — ligne 1 — au", to]]) {
      const field = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, [name, from, to]);
}
const leaveField = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

/** Un compte simulé, partagé par le téléphone et l'ordinateur : la liste des
 *  feuilles déjà faites et les écritures reçues. */
function formSheetsAccount() {
  const account = { sheets: [] as Array<Record<string, unknown>>, saved: [] as Array<Record<string, unknown>> };
  const handler = async (route: Route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { form_profile: null } });
    const body = route.request().postDataJSON();
    if (body.action === "save-form-sheet") {
      account.saved.push(body.sheet);
      account.sheets = [{ ...body.sheet, updated_at: new Date().toISOString() }, ...account.sheets.filter((item) => item.id !== body.sheet.id)];
    }
    return route.fulfill({ json: { ok: true, form_sheets: account.sheets } });
  };
  return { account, handler };
}

test("une feuille déjà faite se reprend depuis « Reprendre », et « Annuler » rend l’écran d’avant", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/formulaire/index.html?feuille=conges");
  await fillLeaveSheet(page, "DUPONT Camille", "21/12/2026", "02/01/2027");
  await page.locator("#btnPdf").click();
  await expect(page.locator("#actionToast")).toHaveText("PDF créé", { timeout: 60_000 });
  const reset = page.locator("#btnReset");
  await reset.click();
  await reset.click();
  await expect(leaveField(page, "Congés annuels — ligne 1 — du")).toHaveValue("");

  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  const list = page.getByRole("dialog", { name: "Feuilles déjà faites" });
  await expect(list).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.getByRole("listitem")).toContainText("Congés annuels, du 21/12 au 02/01");
  await list.getByRole("button", { name: /^Reprendre Demande de congés/ }).click();
  await expect(list).toBeHidden();
  await expect(leaveField(page, "Congés annuels — ligne 1 — du")).toHaveValue("21/12/2026");
  await expect(leaveField(page, "Congés annuels — ligne 1 — au")).toHaveValue("02/01/2027");
  await expect(page.locator("#takeBanner")).toContainText("Reprise de la feuille du");

  await page.locator("#takeUndo").click();
  await expect(page.locator("#takeBanner")).toBeHidden();
  await expect(leaveField(page, "Congés annuels — ligne 1 — du")).toHaveValue("");
});

test("un PDF du formulaire rouvert rend sa feuille, un autre PDF est refusé", async ({ page, isMobile }) => {
  test.skip(isMobile, "Le téléchargement du PDF est vérifié sur l’ordinateur.");
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/formulaire/index.html?feuille=conges");
  await fillLeaveSheet(page, "MARTIN Léa", "03/03/2027", "05/03/2027");
  const download = page.waitForEvent("download");
  await page.locator("#btnPdf").click();
  const pdfPath = test.info().outputPath("demande.pdf");
  await (await download).saveAs(pdfPath);
  await page.locator("#sheet").selectOption({ label: "Demande de récupérations" });

  // Reprise depuis une autre feuille : le formulaire repasse sur les congés.
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await page.locator("#takeFile").setInputFiles(pdfPath);
  await expect(page.locator("#sheet")).toHaveValue("0");
  await expect(leaveField(page, "Congés annuels — ligne 1 — du")).toHaveValue("03/03/2027");
  await expect(page.locator("#takeBanner")).toContainText("Feuille reprise du PDF");
  await expect(page.locator("#takeBanner")).toContainText("« demande.pdf »");

  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await page.locator("#takeFile").setInputFiles("public/useful-forms/adhesion-carte-pop.pdf");
  await expect(page.locator("#msg")).toHaveText(/ne contient pas de feuille à reprendre/);
});

test("le justificatif d’un congé garde d’enfant choisi dans le dossier est bien joint", async ({ page }) => {
  // Le champ « Ouvrir un PDF du formulaire » portait le nom de la fonction
  // qui lit les justificatifs et l'écrasait : le fichier choisi était ignoré.
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto("/formulaire/index.html?feuille=conges");
  await page.evaluate(() => {
    for (const label of ["Congés garde enfant — ligne 1 — du", "Congés garde enfant — ligne 1 — au"]) {
      const field = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
      field.value = "16/11/2026";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  const row = page.locator(".att-row").filter({ hasText: "Justificatif — Congés garde enfant" });
  const fileName = row.locator(".att-name");
  await expect(fileName).toHaveText("aucun fichier joint");

  const picker = page.getByLabel("Choisir un justificatif pour Congés garde enfant");
  await picker.setInputFiles("public/favicon-48.png");
  await expect(fileName).toHaveText(/^favicon-48\.png/);
  await expect(page.locator("#msg")).toHaveText("Justificatif joint : favicon-48.png");
  await expect(row.locator(".att-btn-text")).toHaveText("Remplacer");

  // Un PDF remplace la photo, puis « Retirer » rend la ligne vide. Le moteur
  // PDF se charge à ce moment-là : la première fois, il lui faut du temps.
  await picker.setInputFiles("public/useful-forms/demande-conges.pdf");
  await expect(fileName).toHaveText(/^demande-conges\.pdf/, { timeout: 20_000 });
  await row.getByRole("button", { name: "Retirer" }).click();
  await expect(fileName).toHaveText("aucun fichier joint");
  expect(runtimeErrors).toEqual([]);
});

test("une feuille faite sur l’ordinateur se retrouve sur le téléphone par le compte, et inversement", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "Le scénario ouvre lui-même un téléphone à côté de l’ordinateur.");
  const { account, handler } = formSheetsAccount();
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/calendar", handler);
  await page.goto("/formulaire/index.html?feuille=conges");
  await fillLeaveSheet(page, "DUPONT Camille", "21/12/2026", "02/01/2027");
  await page.locator("#btnPdf").click();
  // La fabrication du PDF prend une quinzaine de secondes sur le serveur de test.
  await expect.poll(() => account.saved.length, { timeout: 60_000 }).toBe(1);
  expect(account.saved[0]).toMatchObject({
    sheet: "conges",
    pages: [{ f: { nom: "DUPONT Camille", ca0_from: "21/12/2026", ca0_to: "02/01/2027" } }],
  });
  // Ni signature ni image dans ce qui part sur le compte.
  expect(JSON.stringify(account.saved[0])).not.toContain("data:image");

  // Le téléphone : une feuille faite hors connexion attend sur l'appareil.
  const phone = await browser.newContext({ ...devices["Pixel 7"] });
  const mobile = await phone.newPage();
  await mobile.route("**/api/calendar", handler);
  await mobile.addInitScript(() => localStorage.setItem("demandes:v1:feuilles", JSON.stringify([{
    id: "horsligne01", sheet: "recup", p: 1, o: "",
    pages: [{ f: { nom: "DUPONT Camille", rjour0_from: "28/11/2026" }, m: [], c: {} }],
    created_at: "2026-11-10T08:00:00.000Z", updated_at: "2026-11-10T08:00:00.000Z",
  }])));
  await mobile.goto("/formulaire/index.html?feuille=conges");
  await mobile.getByRole("button", { name: "Reprendre", exact: true }).click();
  const list = mobile.getByRole("dialog", { name: "Feuilles déjà faites" });
  await expect(list).toContainText("Sur votre compte : téléphone et ordinateur");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  expect(account.saved.map((sheet) => sheet.id)).toContain("horsligne01");
  await list.getByRole("button", { name: /^Reprendre Demande de congés/ }).click();
  await expect(leaveField(mobile, "Congés annuels — ligne 1 — du")).toHaveValue("21/12/2026");
  await phone.close();

  // Et l'ordinateur retrouve la feuille partie du téléphone.
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Feuilles déjà faites" }).getByRole("listitem")).toHaveCount(2);
});

test("la date de signature changée sur la première feuille passe sur les autres feuilles", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  // Le calendrier demande d'abord le groupe : il est déjà dans le profil.
  await page.addInitScript(() => localStorage.setItem("demandes:v6:profil", JSON.stringify({ nom: "Mika Test", groupe: "2" })));
  await page.goto("/formulaire/index.html?feuille=conges");
  const signedOn = page.getByRole("textbox", { name: "Signature de l’agent — le", exact: true });
  await expect(page.getByRole("combobox", { name: "Groupe", exact: true })).toHaveValue("2");
  await page.locator("#btnSecond").click();
  await page.locator("#btnSecond").click();
  await expect(page.locator("#pageStatus")).toHaveText("Feuille 3 / 3");
  await page.locator("#pagePrev").click();
  await page.locator("#pagePrev").click();
  await expect(page.locator("#pageStatus")).toHaveText("Feuille 1 / 3");

  // Un autre jour que celui déjà posé, choisi au calendrier.
  const before = await signedOn.inputValue();
  await signedOn.click();
  const calendar = page.locator("#calModal");
  await expect(calendar).toHaveClass(/on/);
  const days = calendar.locator(".calday:not(:disabled)");
  const day = Number(before.slice(0, 2));
  for (let index = 0, count = await days.count(); index < count; index += 1) {
    if ((await days.nth(index).getAttribute("aria-label"))?.startsWith(`${day} `)) continue;
    await days.nth(index).click();
    break;
  }
  const after = await signedOn.inputValue();
  expect(after).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  expect(after).not.toBe(before);

  await page.locator("#pageNext").click();
  await expect(page.locator("#pageStatus")).toHaveText("Feuille 2 / 3");
  await expect(signedOn).toHaveValue(after);
  await page.locator("#pageNext").click();
  await expect(signedOn).toHaveValue(after);
});
