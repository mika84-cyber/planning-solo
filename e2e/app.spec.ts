import { expect, test, type Page } from "@playwright/test";

async function prepareDemo(page: Page, withCurrentLeave = false) {
  await page.addInitScript((seedLeave) => {
    localStorage.setItem("planning:guide-seen-v1:demo", "1");
    if (!seedLeave) return;
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: "e2e-current-leave",
        requestKind: "leave",
        group: 2,
        periods: [{ from: date, to: date, type: "annual" }],
        timed: [],
      }),
    );
  }, withCurrentLeave);
  await page.goto("/?demo=1");
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible();
}

async function openMainMenu(page: Page) {
  await page.getByRole("button", { name: "Ouvrir le menu principal" }).click();
  await expect(page.getByRole("complementary", { name: "Menu principal" })).toBeVisible();
}

async function swipeMainSection(page: Page, fromX: number, toX: number) {
  const shell = page.locator(".app-shell");
  const touch = (clientX: number) => ({
    identifier: 1,
    clientX,
    clientY: 420,
    pageX: clientX,
    pageY: 420,
    screenX: clientX,
    screenY: 420,
  });
  await shell.dispatchEvent("touchstart", {
    touches: [touch(fromX)],
    changedTouches: [touch(fromX)],
  });
  await shell.dispatchEvent("touchend", {
    touches: [],
    changedTouches: [touch(toX)],
  });
}

test("menu, mode d’emploi, paie et PDF restent accessibles", async ({ page }) => {
  await prepareDemo(page);
  const headerHeight = () => page.locator(".top-header").evaluate((node) => node.getBoundingClientRect().height);
  const homeHeaderHeight = await headerHeight();
  const update = page.getByRole("button", { name: "Vérifier les mises à jour" });
  await expect(update).toBeVisible();
  await expect(update).toHaveClass(/header-update-button/);
  await expect(update.locator("xpath=..")).toHaveClass(/header-command-area/);
  await openMainMenu(page);

  const menu = page.getByRole("complementary", { name: "Menu principal" });
  const pdf = menu.getByRole("button", { name: /Télécharger les plannings en PDF/ });
  const guide = menu.getByRole("button", { name: /Mode d’emploi/ });

  await expect(pdf).toBeVisible();
  await expect(guide).toBeVisible();
  await expect(menu.getByRole("button", { name: "Vérifier les mises à jour" })).toHaveCount(0);
  const menuLabels = await menu.locator("nav > button").allTextContents();
  expect(menuLabels.findIndex((label) => label.includes("Télécharger les plannings"))).toBeLessThan(
    menuLabels.findIndex((label) => label.includes("Mode d’emploi")),
  );
  await expect(menu).toHaveCSS("background-image", /menu-art\.jpg/);
  await expect(guide).toHaveCSS("background-color", "rgba(255, 255, 255, 0.86)");

  await guide.click();
  await expect(page.getByRole("heading", { name: "Bien démarrer avec Planning Solo" })).toBeVisible();
  await page.getByRole("button", { name: "J’ai compris" }).click();

  await openMainMenu(page);
  await menu.getByRole("button", { name: /Congés et récupérations/ }).click();
  await expect(page.locator(".top-header h1")).toHaveText("Congés et récupérations");
  await expect(page.locator(".top-header-leave")).toHaveCSS("background-image", /leave-header-art\.jpg/);
  expect(Math.abs((await headerHeight()) - homeHeaderHeight)).toBeLessThan(0.5);

  await openMainMenu(page);
  await menu.getByRole("button", { name: /Ma paie/ }).click();
  const payScreen = page.getByRole("region", { name: "Ma paie" });
  await expect(payScreen).toBeVisible();
  await expect(page.locator(".top-header-pay")).toHaveCSS("background-image", /pay-header-art\.jpg/);
  expect(await payScreen.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toContain("pay-art.jpg");
  await expect(page.getByRole("heading", { name: "Choisissez une rubrique" })).toBeVisible();
  expect(Math.abs((await headerHeight()) - homeHeaderHeight)).toBeLessThan(0.5);

  await openMainMenu(page);
  await menu.getByRole("button", { name: /Télécharger les plannings en PDF/ }).click();
  await expect(page.getByRole("heading", { name: "Télécharger les plannings en PDF" })).toBeVisible();
  await expect(page.locator(".top-header-pdf")).toHaveCSS("background-image", /pdf-header-art\.webp/);
  const pdfScreen = page.locator(".pdf-download-screen");
  expect(await pdfScreen.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toContain("pdf-art.jpg");
  await expect(pdfScreen).toHaveCSS("border-top-color", "rgba(31, 35, 40, 0.62)");
  await expect(pdfScreen.locator(".pdf-download-settings > label").first()).toHaveCSS("border-top-width", "1px");
  await expect(pdfScreen.locator(".pdf-download-actions .pdf-action")).toHaveCount(3);
  await expect(pdfScreen.locator(".pdf-download-actions .pdf-action").first()).toHaveCSS("border-top-color", "rgba(31, 35, 40, 0.62)");
  expect(Math.abs((await headerHeight()) - homeHeaderHeight)).toBeLessThan(0.5);
});

test("l’en-tête, le sélecteur d’affichage et les années sont confortables", async ({ page }) => {
  await prepareDemo(page);
  const header = page.locator(".top-header");
  const switcher = page.getByLabel("Mode d’affichage");
  const update = page.getByRole("button", { name: "Vérifier les mises à jour" });
  const account = page.getByRole("button", { name: "Compte" });
  const menuButton = page.getByRole("button", { name: "Ouvrir le menu principal" });

  await expect(header).toBeVisible();
  await expect(header).toHaveCSS("background-image", /header-art\.jpg/);
  await expect(header).toHaveCSS("border-top-width", "2px");
  await expect(header).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.65)");
  await expect(account).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.62)");
  await expect(menuButton).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.62)");
  await expect(update).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.62)");
  await expect(switcher).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.62)");
  await expect(page.locator(".today-overview")).toHaveCSS("border-top-color", "rgba(31, 35, 40, 0.38)");
  const todayHeadingBox = await page.locator(".today-overview-heading").boundingBox();
  const headerBox = await header.boundingBox();
  const todayOverviewBox = await page.locator(".today-overview").boundingBox();
  const leaveActionBox = await page.locator(".today-overview-heading .add-action").boundingBox();
  expect(headerBox).not.toBeNull();
  expect(todayOverviewBox).not.toBeNull();
  expect(todayHeadingBox).not.toBeNull();
  expect(leaveActionBox).not.toBeNull();
  expect(Math.abs(leaveActionBox!.y - todayHeadingBox!.y)).toBeLessThan(1);
  if ((page.viewportSize()?.width || 0) >= 1200) {
    expect(headerBox!.width - todayOverviewBox!.width).toBeGreaterThan(50);
  }
  await expect(switcher.getByRole("button", { name: "Mois" })).toHaveAttribute("aria-pressed", "true");
  await expect(switcher.getByRole("button", { name: "Mois" })).toHaveCSS("background-image", /gradient/);
  const switchBox = await switcher.boundingBox();
  const updateBox = await update.boundingBox();
  expect(switchBox).not.toBeNull();
  expect(updateBox).not.toBeNull();
  expect(updateBox!.y).toBeGreaterThan(switchBox!.y);
  expect(updateBox!.width).toBeLessThan(switchBox!.width);

  await page.locator('.calendar-toolbar button[aria-label="Sélectionner l’année"]').click();
  const years = page.locator(".calendar-toolbar .choice-picker-menu button");
  await expect(years).toHaveCount(25);
  await expect(years.first()).toHaveText("2026");
  await expect(years.last()).toHaveText("2050");
  await expect(page.getByRole("button", { name: "2024", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2025", exact: true })).toHaveCount(0);
});

test("le balayage mobile navigue entre toutes les rubriques", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Le geste tactile est réservé au téléphone");
  await prepareDemo(page);

  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Congés et récupérations");
  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Ma paie");
  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Plannings PDF");
  await swipeMainSection(page, 40, 340);
  await expect(page.locator(".top-header h1")).toHaveText("Ma paie");
});

test("le balayage du calendrier mobile change seulement de mois", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Le geste tactile est réservé au téléphone");
  await prepareDemo(page);

  const monthPicker = page.getByRole("button", { name: "Sélectionner le mois" });
  const initialMonth = (await monthPicker.textContent())?.trim() || "";
  expect(initialMonth).not.toBe("");
  const calendar = page.locator(".month-card");
  const touch = (clientX: number) => ({
    identifier: 1,
    clientX,
    clientY: 420,
    pageX: clientX,
    pageY: 420,
    screenX: clientX,
    screenY: 420,
  });
  await calendar.dispatchEvent("touchstart", {
    touches: [touch(340)],
    changedTouches: [touch(340)],
  });
  await calendar.dispatchEvent("touchend", {
    touches: [],
    changedTouches: [touch(40)],
  });

  await expect(monthPicker).not.toHaveText(initialMonth);
  await expect(page.locator(".top-header h1")).toHaveText("Accueil");
});

test("le Z Fold ouvert garde un grand en-tête et le balayage tactile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Ce contrôle nécessite une interface tactile");
  await page.setViewportSize({ width: 900, height: 1000 });
  await prepareDemo(page);

  const headerBox = await page.locator(".top-header").boundingBox();
  expect(headerBox?.height ?? 0).toBeGreaterThanOrEqual(190);
  await swipeMainSection(page, 760, 120);
  await expect(page.locator(".top-header h1")).toHaveText("Congés et récupérations");
});

test("un lien de démonstration ne propose jamais l’installation", async ({ page }) => {
  await prepareDemo(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Installer l’application" })).toHaveCount(0);
});

test("le compte avertit lorsqu’une nouvelle version est disponible", async ({ page }) => {
  await prepareDemo(page);
  await page.evaluate(() => window.dispatchEvent(new Event("planning-app-update-available")));

  const account = page.getByRole("button", { name: "Compte" });
  await expect(account).toHaveClass(/update-available/);
  await account.click();
  await expect(page.getByRole("status")).toContainText("Une mise à jour est disponible");
  await expect(page.getByRole("status")).toContainText("Vérifier les mises à jour");
});

test("le CET se configure et conserve un historique cohérent", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();

  await page.getByRole("button", { name: /Mon CET/ }).click();
  await expect(page.locator(".cet-heading strong")).toHaveCSS("font-size", "18.4px");
  await page.getByRole("button", { name: "Remplir la demande d’ouverture" }).click();
  const openingForm = page.getByRole("dialog", { name: "Ouvrir mon compte épargne-temps" });
  await openingForm.getByLabel("Nom", { exact: true }).fill("Martin");
  await openingForm.getByLabel("Prénom", { exact: true }).fill("Agnès");
  await expect(openingForm.getByLabel(/Direction, service/)).toHaveValue(
    "Direction des publics - Service de l'accueil des publics",
  );
  await openingForm.getByLabel("Groupe / catégorie").selectOption("Groupe 1");
  const openingDownload = page.waitForEvent("download");
  await openingForm.getByRole("button", { name: "Télécharger le formulaire rempli" }).click();
  const openingPdf = await openingDownload;
  expect(openingPdf.suggestedFilename()).toBe("demande-ouverture-cet-perenne.pdf");
  await openingForm.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByLabel("Établissement", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Catégorie")).toHaveCount(0);
  await expect(page.getByLabel("Cycle ou rythme de travail")).toHaveCount(0);
  await page.getByLabel("Solde officiel actuel").fill("18");
  await page.getByRole("button", { name: "Enregistrer mon CET" }).click();

  await expect(page.locator(".cet-balance-main")).toContainText("18");
  await expect(page.locator(".cet-summary-grid")).toContainText("249 €");
  await page.getByRole("button", { name: "Remplir alimentation / indemnisation" }).click();
  const fundingForm = page.getByRole("dialog", { name: "Alimenter ou indemniser mon CET" });
  await fundingForm.getByRole("button", { name: "Aide au remplissage" }).click();
  await expect(fundingForm.getByRole("heading", { name: "Que faut-il inscrire ?" })).toBeVisible();
  await expect(fundingForm.getByRole("button", { name: "Accepter l’aide" })).toHaveCount(0);
  await expect(fundingForm.getByRole("button", { name: "Ignorer" })).toHaveCount(0);
  await expect(fundingForm.locator("#cet-form-help")).not.toContainText("Groupe / catégorie");
  await expect(fundingForm.locator("#cet-form-help")).not.toContainText("Date de la demande");
  await expect(fundingForm.locator("#cet-form-help")).toContainText("du total après alimentation");
  await expect(fundingForm.locator("#cet-form-help")).not.toContainText("Exemple");
  await expect(fundingForm.locator("#cet-form-help")).toContainText("Jours à indemniser");
  await expect(fundingForm.locator("#cet-form-help")).toContainText("jours conservés + jours indemnisés");
  await fundingForm.getByRole("button", { name: "Annuler" }).click();
  await page.getByRole("button", { name: "Ajouter une opération" }).click();
  await page.getByLabel("Opération").selectOption("leave");
  await page.getByLabel("Nombre de jours").fill("2");
  await page.getByRole("button", { name: "Enregistrer l’opération" }).click();
  await expect(page.locator(".cet-balance-main")).toContainText("16");
  await expect(page.locator(".cet-history")).toContainText("Congé pris sur le CET");
  await page.getByRole("button", { name: "Je n’ai pas de CET" }).click();
  const disableConfirmation = page.locator(".cet-disable-confirm");
  await expect(disableConfirmation).toContainText("Désactiver le suivi CET ?");
  await disableConfirmation.getByRole("button", { name: "Confirmer : je n’ai pas de CET" }).click();
  await expect(page.getByRole("button", { name: /Mon CET/ })).toContainText("À configurer avec votre relevé RH");
  await expect(page.locator(".cet-summary-grid")).toHaveCount(0);
});

test("un solde manuel supérieur à 24 heures est bien enregistré", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();

  await page.getByRole("button", { name: "Ajouter des heures manuellement" }).click();
  const dialog = page.getByRole("dialog", { name: "Ajouter des heures manuellement" });
  await dialog.getByLabel("Heures").fill("72");
  await dialog.getByRole("button", { name: "Ajouter au solde" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("72 h disponibles")).toBeVisible();
  await page.getByLabel("Mes heures supplémentaires")
    .getByRole("button", { name: "Voir l’historique" })
    .click();
  await expect(page.locator(".overtime-history")).toContainText(
    "Heures de solidarité · +72 h",
  );
});

test("une formation utilise le bon nombre d’heures et apparaît en REC", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();

  await page.getByRole("button", { name: "Ajouter des heures manuellement" }).click();
  const balanceDialog = page.getByRole("dialog", { name: "Ajouter des heures manuellement" });
  await balanceDialog.getByLabel("Heures").fill("10");
  await balanceDialog.getByRole("button", { name: "Ajouter au solde" }).click();

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Accueil/ })
    .click();
  await page.locator(".today-overview .primary-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /Une récupération/ })
    .click();
  const methodDialog = page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ });
  await expect(methodDialog.getByRole("button", { name: /Remplir le formulaire/ })).toBeVisible();
  await expect(methodDialog.getByRole("button", { name: /Ajouter manuellement au planning/ })).toBeVisible();
  await methodDialog.getByRole("button", { name: /Ajouter manuellement au planning/ }).click();

  const recoveryDialog = page.getByRole("dialog", { name: "Ajouter une récupération" });
  await recoveryDialog.getByRole("button", { name: /formation/i }).click();
  await recoveryDialog.getByRole("button", { name: /Sélectionner dans le calendrier/ }).click();
  const recoveryPanel = page.locator("#recovery-range-selection-panel");
  await expect(recoveryPanel.getByRole("button", { name: "3 h", exact: true })).toBeVisible();
  await recoveryPanel.getByRole("button", { name: "6 h", exact: true }).click();
  await expect(recoveryPanel.getByRole("button", { name: "6 h", exact: true })).toHaveClass(/active/);
  await page.locator(".month-card .day").first().click();
  await recoveryPanel.getByRole("button", { name: "Enregistrer toutes les dates" }).click();

  const recoveryDay = page.getByRole("button", { name: /formation en récupération de 6 h/i });
  await expect(recoveryDay).toHaveCSS("background-color", "rgb(243, 179, 166)");
  await expect(recoveryDay).toHaveCSS("border-color", "rgb(0, 0, 0)");
  const recoveryLabel = recoveryDay.getByText("REC", { exact: true });
  await expect(recoveryLabel).toBeVisible();
  await expect(recoveryLabel).toHaveCSS("border-top-width", "0px");
  await expect(recoveryLabel).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(recoveryLabel).toHaveCSS("color", "rgb(17, 17, 17)");
  await recoveryDay.click();
  const dayDialog = page.getByRole("dialog", { name: /2026/ });
  await expect(dayDialog.locator(".day-recovery-details")).toContainText("Formation");
  await expect(dayDialog.locator(".day-recovery-details")).toContainText("6 h prises sur votre solde");
  const deleteButton = dayDialog.getByRole("button", { name: "Effacer la récupération" });
  await expect(deleteButton).toBeVisible();
  const deleteButtonBox = await deleteButton.boundingBox();
  expect(deleteButtonBox?.width ?? 0).toBeGreaterThan(180);

  page.once("dialog", (dialog) => void dialog.accept());
  await deleteButton.click();
  await expect(page.locator(".training-recovery-day")).toHaveCount(0);
});

test("Divers est explicite et le résumé apparaît avant validation", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".today-overview .primary-action").click();

  const chooser = page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" });
  const other = chooser.getByRole("button", { name: /Divers/ });
  await expect(other).not.toContainText("Grève, décharge syndicale, fermeture exceptionnelle");
  await expect(other.locator(".other-choice-dot")).toHaveCount(0);
  await expect(other).toHaveCSS("background-color", "rgb(250, 251, 253)");
  await other.click();

  await expect(page.getByRole("heading", { name: "Sélectionnez vos dates Divers" })).toBeVisible();
  await page.locator(".month-card .day").first().click();
  const summary = page.getByLabel("Résumé avant validation");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("1 date");
  await expect(summary).toContainText("sans effet sur la paie ni les soldes");
  await page.getByRole("button", { name: "Enregistrer Divers" }).click();
  await expect(page.locator(".month-card .day.leave-other")).toHaveCSS(
    "background-color",
    "rgb(244, 184, 200)",
  );
});

test("le congé CET est proposé depuis les demandes et depuis une case", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".today-overview .primary-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /^CET Utilisez/ })
    .click();
  await page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ })
    .getByRole("button", { name: /Remplir le formulaire/ })
    .click();
  await expect(page.getByRole("button", { name: /Congé CET/ })).toBeVisible();
  await page.getByRole("button", { name: "Annuler la demande" }).click();

  await page.locator(".month-card .day").first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^CET/ })).toBeVisible();
});

test("les choix principaux et ceux d’une date suivent l’ordre demandé", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".today-overview .primary-action").click();
  const chooser = page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" });
  await expect(chooser.locator(".choice-grid > button > strong")).toHaveText([
    "Un congé",
    "Une récupération",
    "Un arrêt maladie",
    "Divers",
    "CET",
  ]);
  await chooser.getByRole("button", { name: "Fermer" }).click();

  await page.locator(".month-card .day").first().click();
  const dayDialog = page.getByRole("dialog", { name: /2026/ });
  await expect(dayDialog.locator(".leave-choices > button")).toHaveText([
    /Congé/,
    /Récupération/,
    /Congé souhaitéHors période d’ouverture/,
    /Maladie/,
    /Divers/,
    /CET/,
  ]);
  await expect(dayDialog.locator(".leave-choices .other-day")).toHaveCSS(
    "background-color",
    "rgb(250, 251, 253)",
  );
  await expect(dayDialog.locator(".leave-choices .cet-day")).toHaveCSS(
    "background-color",
    "rgb(250, 251, 253)",
  );
});

test("une récupération ordinaire affiche le cycle sans reproposer Formation", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await page.getByRole("button", { name: "Ajouter des heures manuellement" }).click();
  const balanceDialog = page.getByRole("dialog", { name: "Ajouter des heures manuellement" });
  await balanceDialog.getByLabel("Heures").fill("10");
  await balanceDialog.getByRole("button", { name: "Ajouter au solde" }).click();
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Accueil/ })
    .click();
  await page.locator(".today-overview .primary-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /Une récupération/ })
    .click();
  await page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ })
    .getByRole("button", { name: /Ajouter manuellement au planning/ })
    .click();

  const dialog = page.getByRole("dialog", { name: "Ajouter une récupération" });
  await dialog.getByRole("button", { name: /Récupération en heures/ }).click();
  await expect(dialog.getByRole("button", { name: /Sélectionner dans le calendrier/ })).toBeVisible();
  await dialog.getByRole("button", { name: /Sélectionner dans le calendrier/ }).click();
  const recoveryPanel = page.locator("#recovery-range-selection-panel");
  await page.locator(".month-card .day").first().click();
  await recoveryPanel.getByRole("button", { name: "Enregistrer toutes les dates" }).click();

  const recoveryDay = page.locator(".month-card .day.hourly-recovery-day");
  await expect(recoveryDay).toHaveCSS("background-color", "rgb(243, 179, 166)");
  await expect(recoveryDay).toHaveCSS("border-color", "rgb(0, 0, 0)");
  await expect(recoveryDay.getByText("REC", { exact: true })).toBeVisible();
  await expect(recoveryDay).not.toContainText("Récup.");
});

test("une récupération lancée depuis une case suit aussi le calendrier", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".month-card .day").first().click();
  await page.getByRole("dialog", { name: /2026/ })
    .getByRole("button", { name: /^Récupération/ })
    .click();
  await page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ })
    .getByRole("button", { name: /Ajouter manuellement au planning/ })
    .click();

  const dialog = page.getByRole("dialog", { name: "Ajouter une récupération" });
  await dialog.getByRole("button", { name: /Récupération en journée/ }).click();
  await expect(dialog.getByRole("button", { name: /Sélectionner dans le calendrier/ })).toBeVisible();
  await dialog.getByRole("button", { name: /Sélectionner dans le calendrier/ }).click();
  const recoveryPanel = page.locator("#recovery-range-selection-panel");
  await expect(recoveryPanel.getByRole("heading", { name: "1 date sélectionnée" })).toBeVisible();
  await expect(recoveryPanel.locator(".recovery-duration-choice > button")).toHaveText([
    "8 h", "6 h", "4 h", "Durée libre",
  ]);
});

test("les congés mensuels affichent les repères CA RTT et FRA", async ({ page }) => {
  await prepareDemo(page);
  const cases = page.locator(".month-card .day.work");
  const choices = [
    { type: "Congés annuels", marker: "CA" },
    { type: "RTT", marker: "RTT" },
    { type: "Jour de fractionnement", marker: "FRA" },
  ];

  for (let index = 0; index < choices.length; index += 1) {
    const day = cases.nth(index);
    await day.click();
    await page.getByRole("dialog", { name: /2026/ })
      .locator(".leave-choices .leave")
      .click();
    await page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ })
      .getByRole("button", { name: /Ajouter manuellement au planning/ })
      .click();
    const editor = page.getByRole("dialog", { name: "Ajouter une période de congés" });
    await editor.getByRole("button", { name: choices[index].type, exact: true }).click();
    await editor.getByRole("button", { name: "Sélectionner dans le calendrier" }).click();
    await page.locator(".range-selection-panel").getByRole("button", { name: "Enregistrer toutes les dates" }).click();
    await expect(day.getByText(choices[index].marker, { exact: true })).toBeVisible();
  }
});

test("nettoyage et gestion d’un congé utilisent des actions directes", async ({ page }) => {
  await prepareDemo(page, true);

  await page.locator(".calendar-bulk-delete-button:visible, .calendar-bulk-delete-mobile:visible").click();
  const cleanup = page.locator(".calendar-delete-panel");
  await expect(cleanup).toBeVisible();
  const deleteAbsences = cleanup.getByRole("button", { name: "Effacer les absences" });
  const deleteNotes = cleanup.getByRole("button", { name: "Effacer les notes" });
  await expect(deleteAbsences).toBeVisible();
  await expect(deleteNotes).toBeVisible();
  await cleanup.getByRole("button", { name: "Annuler" }).click();

  await page.locator('.month-card .day[aria-current="date"]').click();
  const dayDialog = page.getByRole("dialog", { name: /.+/ });
  await expect(dayDialog.getByText("Périodes concernant cette date")).toBeVisible();
  await expect(dayDialog.getByRole("button", { name: "Modifier" })).toBeVisible();
  await expect(dayDialog.getByRole("button", { name: "Annuler le congé" })).toBeVisible();
  await expect(dayDialog.getByText("Repasser en souhaité")).toHaveCount(0);
});

test("les parcours congé, récupération et maladie s’ouvrent correctement", async ({ page }) => {
  await prepareDemo(page);

  await page.locator(".today-overview .primary-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /^Un congé Choisissez/ })
    .click();
  const method = page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ });
  await expect(method.getByRole("button", { name: /Ajouter manuellement au planning/ })).toBeVisible();
  await method.getByRole("button", { name: /Remplir le formulaire/ }).click();
  await expect(page.getByRole("heading", { name: "Sélectionnez vos congés" })).toBeVisible();
  await page.locator(".month-card .day").first().click();
  await expect(page.getByLabel("Résumé avant validation")).toBeVisible();
  await page.getByRole("button", { name: "Annuler la demande" }).click();

  await page.locator(".today-overview .primary-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /^Un congé Choisissez/ })
    .click();
  await page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ })
    .getByRole("button", { name: /Ajouter manuellement au planning/ })
    .click();
  await page.getByRole("dialog", { name: "Ajouter une période de congés" })
    .getByRole("button", { name: "Sélectionner dans le calendrier" })
    .click();
  await expect(page.locator(".range-selection-panel")).toBeVisible();
  await page.locator(".range-selection-panel").getByRole("button", { name: "Annuler" }).click();

  await page.locator(".today-overview .primary-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /Une récupération/ })
    .click();
  await page.getByRole("dialog", { name: /Comment souhaitez-vous enregistrer/ })
    .getByRole("button", { name: /Ajouter manuellement au planning/ })
    .click();
  const recovery = page.getByRole("dialog", { name: "Ajouter une récupération" });
  await expect(recovery.locator(".type-tabs > button")).toHaveCount(5);
  await expect(recovery.getByRole("button", { name: /formation/i })).toBeVisible();
  await recovery.getByRole("button", { name: "Fermer" }).click();

  await page.locator(".today-overview .primary-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /Un arrêt maladie/ })
    .click();
  await expect(page.getByRole("heading", { name: "Sélectionnez votre arrêt maladie" })).toBeVisible();
  const sickElementsOverlap = await page.locator(".sick-request-options").evaluate((panel) => {
    const choice = panel.querySelector(".type-tabs button")!.getBoundingClientRect();
    const help = panel.querySelector(".request-help")!.getBoundingClientRect();
    return (
      choice.x < help.x + help.width &&
      choice.x + choice.width > help.x &&
      choice.y < help.y + help.height &&
      choice.y + choice.height > help.y
    );
  });
  expect(sickElementsOverlap).toBe(false);
  await page.getByRole("button", { name: "Annuler la demande" }).click();
});

test("les soldes présentent les douze mois fermés par défaut", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await expect(page.getByRole("heading", { name: "Mes soldes de congés" })).toBeVisible();
  await page.locator(".leave-balance-grid > button.annual").click();

  const months = page.locator(".balance-detail-months > details");
  await expect(months).toHaveCount(12);
  await expect(months.locator("[open]")).toHaveCount(0);
  await months.first().locator("summary").click();
  await expect(months.first()).toHaveAttribute("open", "");
  await expect(months.first()).toContainText(/Aucune date enregistrée|Voir et gérer cette absence/);
});

test("les deux rubriques de paie s’ouvrent et se referment", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();

  await page.getByRole("button", { name: /Primes et jours fériés/ }).click();
  await expect(page.locator(".pay-detail-sticky-header h2")).toHaveText("Primes et jours fériés");
  if ((page.viewportSize()?.width || 0) <= 720) {
    const card = page.locator(".variable-pay-card");
    const previous = card.getByRole("button", { name: "Mois précédent", exact: true });
    const next = card.getByRole("button", { name: "Mois suivant", exact: true });
    const month = card.locator("#variable-pay-title");
    const chevron = card.locator(".pay-period-chevron");
    const closeDetails = card.locator(".variable-pay-total > small");
    const variableTotal = card.locator(".variable-pay-total > strong");
    const [cardBox, previousBox, nextBox, monthBox, chevronBox] = await Promise.all([
      card.boundingBox(),
      previous.boundingBox(),
      next.boundingBox(),
      month.boundingBox(),
      chevron.boundingBox(),
    ]);
    expect(cardBox).not.toBeNull();
    expect(previousBox).not.toBeNull();
    expect(nextBox).not.toBeNull();
    expect(monthBox).not.toBeNull();
    expect(chevronBox).not.toBeNull();
    expect(previousBox!.y - cardBox!.y).toBeLessThan(28);
    expect(nextBox!.x - (previousBox!.x + previousBox!.width)).toBeGreaterThanOrEqual(10);
    expect(cardBox!.x + cardBox!.width - (nextBox!.x + nextBox!.width)).toBeLessThan(28);
    expect(Math.abs(
      chevronBox!.y + chevronBox!.height / 2 - (monthBox!.y + monthBox!.height / 2),
    )).toBeLessThan(3);
    await expect(closeDetails).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -4)");
    await expect(variableTotal).toHaveCSS("font-size", "15px");
  }
  await page.getByRole("button", { name: "Revenir aux catégories de paie" }).click();
  await page.getByRole("button", { name: /Bulletins et estimations/ }).click();
  await expect(page.locator(".pay-detail-sticky-header h2")).toHaveText("Bulletins et estimations");
  await expect(page.getByLabel("Conseil pour une estimation correcte")).toBeVisible();
  await page.getByRole("button", { name: "Revenir aux catégories de paie" }).click();
  await expect(page.getByRole("heading", { name: "Choisissez une rubrique" })).toBeVisible();
});

test("le groupe, les notes, les sauvegardes et le retour du formulaire restent accessibles", async ({ page }) => {
  await prepareDemo(page);

  await page.getByRole("button", { name: /Modifier le groupe de cycle/ }).click();
  const groups = page.getByRole("dialog", { name: "Choisir mon groupe" });
  await expect(groups.locator(".group-choice-grid > button")).toHaveCount(3);
  await groups.locator(".group-choice-grid > button").first().click();
  await expect(groups).toHaveCount(0);

  await page.getByRole("button", { name: "Ajouter une note" }).click();
  const note = page.getByRole("dialog", { name: "Ajouter une note" });
  await note.locator("textarea").fill("Contrôle du parcours de note");
  await expect(note.locator("textarea")).toHaveValue("Contrôle du parcours de note");
  await note.getByRole("button", { name: "Fermer" }).click();

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: "Sauvegarde et restauration" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(/sauvegarde|données/i);

  await page.goto("/formulaire/index.html?planning=1&demo=1");
  const back = page.getByRole("link", { name: "Revenir à l’application" });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("href", "/");
});
