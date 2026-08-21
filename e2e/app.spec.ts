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
  await expect(guide).toHaveCSS("background-color", "rgba(255, 255, 255, 0.68)");

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

  await expect(header).toBeVisible();
  await expect(header).toHaveCSS("background-image", /header-art\.jpg/);
  await expect(header).toHaveCSS("border-top-width", "2px");
  await expect(header).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.65)");
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

test("Divers est explicite et le résumé apparaît avant validation", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".today-overview .primary-action").click();

  const chooser = page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" });
  const other = chooser.getByRole("button", { name: /Divers/ });
  await expect(other).toContainText("Grève, décharge syndicale, fermeture exceptionnelle");
  await expect(other.locator(".other-choice-dot")).toHaveCSS("background-color", "rgb(108, 189, 240)");
  await other.click();

  await expect(page.getByRole("heading", { name: "Sélectionnez vos dates Divers" })).toBeVisible();
  await page.locator(".month-card .day").first().click();
  const summary = page.getByLabel("Résumé avant validation");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("1 date");
  await expect(summary).toContainText("sans effet sur la paie ni les soldes");
  await expect(page.getByRole("button", { name: "Enregistrer Divers" })).toBeEnabled();
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
    .getByRole("button", { name: /Un congé/ })
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
    .getByRole("button", { name: /Un congé/ })
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
  const recovery = page.getByRole("dialog", { name: /Quel type de récupération/ });
  await expect(recovery.locator(".recovery-type-choice-grid > button")).toHaveCount(4);
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
