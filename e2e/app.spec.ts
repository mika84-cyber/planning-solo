import { expect, test, type Page } from "@playwright/test";
import { addDays, dateKey, getDayInfo, localDate } from "../src/planningLogic";

async function prepareDemo(page: Page, withCurrentLeave = false) {
  await page.addInitScript((seedLeave) => {
    localStorage.setItem("planning:e2e-demo-enabled", "1");
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
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible();
}

async function prepareStrikeDemo(page: Page) {
  await page.addInitScript(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    localStorage.setItem("planning:e2e-demo-enabled", "1");
    localStorage.setItem("planning:guide-seen-v1:demo", "1");
    localStorage.setItem(
      "planning:e2e-pay-profile",
      JSON.stringify({
        fullName: "",
        group: "2",
        signature: "",
        status: "fonctionnaire",
        workQuota: "full",
        baseSalary: 1801.73,
        residenceAllowance: 54.05,
        ifse: 416.66,
        carenceDay: 75,
        otherFixed: 54.05,
        pasRate: 1.7,
      }),
    );
    localStorage.setItem(
      "planning:e2e-pay-profiles",
      JSON.stringify({
        [monthKey]: { baseSalary: 1801.73, residenceAllowance: 54.05 },
      }),
    );
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible();
}

function currentMonthStrikeScenario(kind: "annual" | "rest") {
  const now = new Date();
  const group = 2;
  const dates = Array.from(
    { length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() },
    (_, index) => localDate(now.getFullYear(), now.getMonth(), index + 1),
  );
  const match = dates.flatMap((date) =>
    Array.from({ length: 6 }, (_, index) => index + 2).map((gap) => ({ date, gap })),
  ).find(({ date, gap }) => {
    const end = addDays(date, gap);
    if (end.getMonth() !== now.getMonth()) return false;
    if (getDayInfo(date, group).kind !== "work" || getDayInfo(end, group).kind !== "work")
      return false;
    const between = Array.from({ length: gap - 1 }, (_, index) => addDays(date, index + 1));
    return kind === "rest"
      ? between.every((day) => getDayInfo(day, group).kind === "off")
      : gap >= 5;
  })!;
  const first = dateKey(match.date);
  const last = dateKey(addDays(match.date, match.gap));
  return {
    first,
    last,
    periods: [
      { from: first, to: first, type: "strike" },
      ...(kind === "annual"
        ? [{
            from: dateKey(addDays(match.date, 1)),
            to: dateKey(addDays(match.date, match.gap - 1)),
            type: "annual",
          }]
        : []),
      { from: last, to: last, type: "strike" },
    ],
  };
}

async function prepareStrikeContinuityDemo(page: Page, kind: "annual" | "rest") {
  const scenario = currentMonthStrikeScenario(kind);
  await page.addInitScript((periods) => {
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: `e2e-strike-continuity-${Date.now()}`,
        requestKind: "leave",
        group: 2,
        periods,
        timed: [],
      }),
    );
  }, scenario.periods);
  await prepareStrikeDemo(page);
  return scenario;
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
  const forms = menu.getByRole("button", { name: /Formulaires utiles/ });
  const guide = menu.getByRole("button", { name: /Mode d’emploi/ });

  await expect(pdf).toBeVisible();
  await expect(forms).toBeVisible();
  await expect(guide).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sauvegarde et restauration" })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Vérifier les mises à jour" })).toHaveCount(0);
  const menuLabels = await menu.locator("nav > button").allTextContents();
  expect(menuLabels.at(-1)).toContain("Formulaires utiles");
  await expect(guide.locator("xpath=..")).toHaveClass(/main-menu-secondary/);
  await expect(menu.getByRole("radiogroup", { name: "Choisir l’apparence" })).toHaveCount(0);
  await expect(menu).toHaveCSS("background-image", /menu-art\.jpg/);
  await expect(menu.locator(".main-menu-index")).toHaveCount(6);
  await expect(menu.locator("nav > button").first().locator(".main-menu-index")).toHaveText("01");
  await expect(menu.locator("nav > button").first().locator("strong")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(guide).toHaveCSS("backdrop-filter", /saturate\(1\.08\).*contrast\(1\.02\)/);

  await guide.click();
  await expect(page.getByRole("heading", { name: "Bien démarrer avec Planning Solo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "4. Suivre et utiliser mon CET" })).toBeVisible();
  await page.getByRole("button", { name: "4. Suivre et utiliser mon CET" }).click();
  await expect(page.getByRole("heading", { name: "Suivre et utiliser mon CET" })).toBeVisible();
  await expect(page.locator("#guide-cet")).toContainText("15 novembre et le 31 décembre");
  await expect(page.locator("#guide-recovery")).toContainText("heures à poser");
  await expect(page.locator("#guide-forms")).toContainText("Formulaire Expo");
  await expect(page.locator("#guide-forms")).toContainText("Télécharger");
  await expect(page.locator("#guide-data")).toContainText("Autre → Mes demandes archivées");
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
  await expect(page.locator(".top-header-pdf")).toHaveCSS(
    "background-position",
    (page.viewportSize()?.width ?? 1000) <= 720 ? "0% 0%, 50% 44%" : "0% 0%, 50% 70%",
  );
  const pdfScreen = page.locator(".pdf-download-screen");
  expect(await pdfScreen.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toContain("pdf-art.jpg");
  await expect(pdfScreen).toHaveCSS("border-top-color", "rgba(55, 73, 98, 0.58)");
  await expect(pdfScreen.locator(".pdf-download-settings > label").first()).toHaveCSS("border-top-width", "1px");
  await expect(pdfScreen.locator(".pdf-download-actions .pdf-action")).toHaveCount(3);
  await expect(pdfScreen.locator(".pdf-download-actions .pdf-action").first()).toHaveCSS("border-top-color", "rgba(31, 35, 40, 0.62)");
  expect(Math.abs((await headerHeight()) - homeHeaderHeight)).toBeLessThan(0.5);
});

test("les formulaires utiles conservent leurs dossiers, leur ordre et leur téléchargement", async ({ page }) => {
  await prepareDemo(page);
  const homeHeaderBox = (await page.locator(".top-header").boundingBox())!;
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Formulaires utiles/ })
    .click();

  await expect(page.locator(".top-header h1")).toHaveText("Formulaires utiles");
  const formsHeader = page.locator(".top-header-forms");
  await expect(formsHeader).toBeVisible();
  await expect(formsHeader).toHaveCSS("position", "relative");
  const artworkStyle = await formsHeader.evaluate((node) => {
    const style = getComputedStyle(node, "::before");
    return {
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      height: style.height,
      transform: style.transform,
    };
  });
  expect(artworkStyle.backgroundImage).toContain("forms-header-art.jpg");
  expect(artworkStyle.backgroundSize).toBe("100% 100%");
  expect(artworkStyle.transform).not.toBe("none");
  const formsHeaderBox = (await formsHeader.boundingBox())!;
  expect(Math.abs(formsHeaderBox.height - homeHeaderBox.height)).toBeLessThan(0.5);
  expect(Math.abs(formsHeaderBox.width - homeHeaderBox.width)).toBeLessThan(0.5);
  expect(Math.abs(formsHeaderBox.height - ((page.viewportSize()?.width ?? 1000) <= 720 ? 215 : 205))).toBeLessThan(0.5);
  const headerUpdate = page.getByRole("button", { name: "Vérifier les mises à jour" });
  const headerUpdateBox = (await headerUpdate.boundingBox())!;
  expect(headerUpdateBox.x).toBeGreaterThanOrEqual(formsHeaderBox.x);
  expect(headerUpdateBox.x + headerUpdateBox.width).toBeLessThanOrEqual(
    formsHeaderBox.x + formsHeaderBox.width,
  );
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    expect(parseFloat(artworkStyle.height)).toBeLessThan(formsHeaderBox.height);
    await expect(headerUpdate).toHaveCSS("font-size", "9px");
  } else {
    expect(parseFloat(artworkStyle.height)).toBeGreaterThan(formsHeaderBox.height);
  }
  const folders = page.locator(".useful-form-folder-grid > button");
  await expect(folders).toHaveText([
    /Formulaire Expo.*1 document/,
    /Formulaire SAP.*3 documents/,
    /Formulaire Brantôme.*7 documents/,
  ]);

  await folders.nth(0).click();
  await expect(page.getByRole("heading", { name: "Formulaire Expo" })).toBeVisible();
  const expoLinks = page.locator(".useful-form-download-list a");
  await expect(expoLinks).toHaveCount(1);
  await expect(page.locator(".useful-form-file-copy strong")).toHaveText(["Hilma Af Klint"]);
  const expoDownloadPromise = page.waitForEvent("download");
  await expoLinks.first().click();
  expect((await expoDownloadPromise).suggestedFilename()).toBe("hilma-af-klint.pdf");
  await page.getByRole("button", { name: "Revenir aux dossiers de formulaires" }).click();

  await page.getByRole("button", { name: /Formulaire SAP/ }).click();
  const sapLinks = page.locator(".useful-form-download-list a");
  await expect(sapLinks).toHaveCount(3);
  await expect(sapLinks.first()).toHaveAttribute("download", "");
  await expect(sapLinks).toHaveText(["Télécharger", "Télécharger", "Télécharger"]);
  const downloadIconBox = (await sapLinks.first().boundingBox())!;
  expect(Math.abs(downloadIconBox.width - 42)).toBeLessThan(0.5);
  expect(Math.abs(downloadIconBox.height - 42)).toBeLessThan(0.5);
  await expect(sapLinks.first().locator(".useful-form-download-label")).toHaveCSS("width", "1px");
  await expect(page.locator(".useful-form-file-copy strong")).toHaveText([
    "Demande de congés",
    "Demande de récupérations",
    "Demande d’annulation de congés",
  ]);
  const downloadPromise = page.waitForEvent("download");
  await sapLinks.first().click();
  expect((await downloadPromise).suggestedFilename()).toBe("demande-conges.pdf");
  await expect(page.locator(".useful-form-download-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Revenir aux dossiers de formulaires" }).click();

  await page.getByRole("button", { name: /Formulaire Brantôme/ }).click();
  await expect(page.locator(".useful-form-download-list a")).toHaveCount(7);
  await expect(page.locator(".useful-form-file-copy strong")).toHaveText([
    "Formulaire de changement de coordonnées",
    "Changement de coordonnées bancaires",
    "Demande de carte de restauration BIMPLI",
    "Procuration pour le retrait des titres-restaurant",
    "Demande de Carte Culture A",
    "CET - Demande d’ouverture",
    "CET - Alimentation et indemnisation",
  ]);
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
  await expect(page.locator(".today-overview")).toHaveCSS("border-top-color", "rgba(55, 73, 98, 0.58)");
  const todayHeadingBox = await page.locator(".today-overview-heading").boundingBox();
  const headerBox = await header.boundingBox();
  const todayOverviewBox = await page.locator(".today-overview").boundingBox();
  const groupAction = page.locator(".today-overview-heading .group-heading-action");
  const groupActionBox = await groupAction.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(todayOverviewBox).not.toBeNull();
  expect(todayHeadingBox).not.toBeNull();
  expect(groupActionBox).not.toBeNull();
  const viewportWidth = page.viewportSize()?.width || 0;
  expect(headerBox!.width).toBeLessThanOrEqual(viewportWidth - 12);
  expect(headerBox!.width / viewportWidth).toBeGreaterThan(
    viewportWidth >= 1200 ? 0.93 : 0.85,
  );
  expect(Math.abs(groupActionBox!.y - todayHeadingBox!.y)).toBeLessThan(1);
  await expect(groupAction).toContainText(/Choisir mon groupe|Je suis groupe [123]/);
  const remainingWorkCard = page.locator(".today-remaining-work");
  await expect(remainingWorkCard).toBeVisible();
  await expect(remainingWorkCard).toContainText(/Travail restant[\s\S]*\d+[\s\S]*jour/);
  await expect(remainingWorkCard).toContainText("D’ici au 31 décembre");
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
  const leaveActionBox = await page.locator(".planning-leave-panel .planning-leave-action").boundingBox();
  const leavePanelBox = await page.locator(".planning-leave-panel").boundingBox();
  const periodNavigationBox = await page.locator(".calendar-toolbar .toolbar-month-picker .choice-picker-trigger").boundingBox();
  const monthCardBox = await page.locator(".month-card").boundingBox();
  expect(leaveActionBox).not.toBeNull();
  expect(leavePanelBox).not.toBeNull();
  expect(periodNavigationBox).not.toBeNull();
  expect(monthCardBox).not.toBeNull();
  expect(leaveActionBox!.y).toBeGreaterThan(periodNavigationBox!.y);
  expect(leavePanelBox!.y + leavePanelBox!.height).toBeLessThan(monthCardBox!.y);
  expect(leaveActionBox!.width).toBeGreaterThan(leavePanelBox!.width - 30);
  await expect(page.getByRole("region", { name: "Outils du planning" })).toHaveCount(0);
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
  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Formulaires utiles");
  await swipeMainSection(page, 40, 340);
  await expect(page.locator(".top-header h1")).toHaveText("Plannings PDF");
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
  const [otherBox, strikeBox, cetBox] = await Promise.all([
    page.locator(".leave-balance-grid button.other").boundingBox(),
    page.locator(".leave-balance-grid button.strike").boundingBox(),
    page.locator(".leave-balance-grid button.cet").boundingBox(),
  ]);
  expect(Math.abs(otherBox!.y - strikeBox!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(otherBox!.width - strikeBox!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(otherBox!.height - strikeBox!.height)).toBeLessThanOrEqual(2);
  expect(otherBox!.x).toBeLessThan(strikeBox!.x);
  expect(strikeBox!.x).toBeLessThan(cetBox!.x);

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Formulaires utiles/ })
    .click();
  const formsHeader = page.locator(".top-header-forms");
  const formsHeaderBox = (await formsHeader.boundingBox())!;
  const artworkLeft = await formsHeader.evaluate((node) => parseFloat(getComputedStyle(node, "::before").left));
  expect(artworkLeft / formsHeaderBox.width).toBeGreaterThan(0.53);
  expect(artworkLeft / formsHeaderBox.width).toBeLessThan(0.55);
});

test("le paramètre de démonstration ne donne plus accès à l’application", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.getByRole("heading", { name: "Votre planning" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toHaveCount(0);
});

test("le compte avertit lorsqu’une nouvelle version est disponible", async ({ page }) => {
  await prepareDemo(page);
  await page.evaluate(() => localStorage.setItem("planning:update-no-auto-reload", "conservé"));
  await page.evaluate(() => window.dispatchEvent(new Event("planning-app-update-available")));

  const updateDialog = page.getByRole("alertdialog", { name: "Une mise à jour est disponible" });
  await expect(updateDialog).toBeVisible();
  await expect(updateDialog).toContainText("La page ne sera actualisée qu’après votre confirmation");
  const updateNowButton = updateDialog.getByRole("button", { name: "Mettre à jour maintenant" });
  await expect(updateNowButton).toBeVisible();
  await expect(updateNowButton).toHaveCSS("background-color", "rgb(197, 47, 66)");
  await expect(updateNowButton).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.waitForTimeout(500);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("planning:update-no-auto-reload"))).toBe("conservé");
  await updateDialog.getByRole("button", { name: "Plus tard" }).click();

  const account = page.getByRole("button", { name: "Compte" });
  await expect(account).not.toHaveClass(/update-available/);
  await expect(account.locator(".account-update-dot")).toHaveCount(0);
  const checkUpdateButton = page.getByRole("button", { name: "Vous avez une mise à jour" });
  await expect(checkUpdateButton).toHaveClass(/update-available/);
  await expect(checkUpdateButton).toHaveCSS("color", "rgb(181, 22, 47)");
  await account.click();
  await expect(page.getByRole("status")).toContainText("Une mise à jour est disponible");
  await expect(page.getByRole("status")).toContainText("bouton rouge");
});

test("le CET se configure et conserve un historique cohérent", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();

  const closedCet = page.locator(".cet-section.closed");
  await expect(closedCet).toBeVisible();
  await expect(closedCet).toHaveCSS("min-height", "88px");
  await expect(closedCet).toHaveCSS("background-image", /linear-gradient/);
  await expect(closedCet).toContainText("Alimentation du 15 novembre au 31 décembre");
  await expect(closedCet.locator(".cet-closed-useful")).toHaveCSS("border-top-width", "0px");
  await expect(closedCet.locator(".cet-closed-useful")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: /Mon CET/ }).click();
  await expect(page.locator(".cet-section")).not.toContainText(
    "Planning Solo vous aide à suivre et simuler votre CET",
  );
  await expect(page.locator(".cet-heading strong")).toHaveCSS("font-size", "17.28px");
  await expect(page.getByLabel("Date d’ouverture (facultatif)")).toHaveCount(0);
  const openingRequest = page.getByRole("button", { name: "Faire une demande d’ouverture" });
  await expect(openingRequest).toHaveCSS("background-color", "rgb(49, 94, 170)");
  await expect(openingRequest).toHaveCSS("color", "rgb(255, 255, 255)");
  await openingRequest.click();
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
  const officialBalance = page.getByLabel("Solde officiel actuel");
  await expect(officialBalance).toHaveValue("");
  await expect(officialBalance).toHaveAttribute("placeholder", "0");
  await officialBalance.fill("0");
  await expect(officialBalance).toHaveValue("0");
  await officialBalance.press("Control+A");
  await officialBalance.press("Backspace");
  await expect(officialBalance).toHaveValue("");
  await officialBalance.fill("18");
  const existingRights = page.getByRole("button", { name: "Mes droits sont déjà ouverts" });
  await expect(existingRights).toHaveCSS("background-color", "rgb(216, 111, 18)");
  await expect(existingRights).toHaveCSS("color", "rgb(255, 255, 255)");
  await existingRights.click();

  await expect(page.locator(".cet-balance-main")).toContainText("18");
  await expect(page.locator(".cet-summary-grid")).toContainText("249 €");
  const management = page.locator(".cet-management-panel");
  const leaveAction = management.getByRole("button", { name: "Poser un congé CET" });
  const operationAction = management.getByRole("button", { name: "Ajouter une opération" });
  const fundingAction = management.getByRole("button", { name: "Remplir alimentation / indemnisation" });
  await expect(management.getByRole("button", { name: "Paramètres" })).toHaveCount(0);
  const [leaveBox, operationBox, fundingBox] = await Promise.all([
    leaveAction.boundingBox(),
    operationAction.boundingBox(),
    fundingAction.boundingBox(),
  ]);
  expect(Math.abs(leaveBox!.width - operationBox!.width)).toBeLessThan(1);
  expect(Math.abs(leaveBox!.y - operationBox!.y)).toBeLessThan(1);
  expect(fundingBox!.width).toBeGreaterThan(leaveBox!.width * 1.8);
  await expect(leaveAction).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(leaveAction).toHaveCSS("color", "rgb(17, 24, 39)");
  await expect(operationAction).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(operationAction).toHaveCSS("color", "rgb(17, 24, 39)");
  await expect(fundingAction).toHaveCSS("background-color", "rgb(49, 94, 170)");
  await fundingAction.click();
  const fundingForm = page.getByRole("dialog", { name: "Alimenter ou indemniser mon CET" });
  await expect(fundingForm.getByRole("alert")).toContainText("ne peut être envoyé qu’entre le 15 novembre et le 31 décembre");
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
  await expect(page.locator(".cet-section")).not.toContainText("Règles FPE");
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
  await page.locator(".planning-leave-panel .planning-leave-action").click();
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
  const workedButton = page.getByRole("button", { name: "Détail des jours travaillés" });
  const initialWorked = Number((await workedButton.innerText()).match(/[\d,.]+/)![0].replace(",", "."));
  await page.locator(".planning-leave-panel .planning-leave-action").click();

  const chooser = page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" });
  const other = chooser.getByRole("button", { name: /Divers/ });
  await expect(other).not.toContainText("Grève, décharge syndicale, fermeture exceptionnelle");
  await expect(other.locator(".other-choice-dot")).toHaveCount(0);
  await expect(other).toHaveCSS("background-color", "rgb(250, 251, 253)");
  await other.click();

  await expect(page.getByRole("heading", { name: "Sélectionnez vos dates Divers" })).toBeVisible();
  await page.locator(".month-card .day.work").first().click();
  const summary = page.getByLabel("Résumé avant validation");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("1 date");
  await expect(summary).toContainText("sans effet sur la paie ni les soldes");
  await page.getByRole("button", { name: "Enregistrer Divers" }).click();
  await expect(page.locator(".month-card .day.leave-other")).toHaveCSS(
    "background-color",
    "rgb(244, 184, 200)",
  );
  const workedAfterOther = Number((await workedButton.innerText()).match(/[\d,.]+/)![0].replace(",", "."));
  expect(workedAfterOther).toBe(initialWorked - 1);

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await expect(page.locator(".leave-balance-grid button.other")).toContainText(/1\s*pris/);
});

test("Divers indique que je ne travaille pas aujourd’hui", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: "e2e-current-other",
        requestKind: "leave",
        group: 2,
        periods: [{ from: date, to: date, type: "other" }],
        timed: [],
      }),
    );
  });
  await prepareDemo(page);

  await expect(page.locator(".today-status")).toContainText("Je ne travaille pas");
});

test("un férié couvert par une absence est annulé et retiré de la paie", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: "e2e-cancelled-worked-holiday",
        requestKind: "leave",
        group: 2,
        periods: [{ from: "2026-08-15", to: "2026-08-15", type: "sick" }],
        timed: [],
      }),
    );
  });
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();
  await page.getByRole("button", { name: /Primes et jours fériés/ }).click();

  const cancelledHoliday = page.locator(".allowance-table tr.holiday-cancelled");
  await expect(cancelledHoliday).toContainText("Assomption");
  await expect(cancelledHoliday).toContainText("Annulé");
  const holidayCard = page.locator(".allowance-card").filter({ hasText: "Jours fériés 2026" });
  await expect(holidayCard.locator("tr:not(.holiday-cancelled)").filter({ hasText: "Assomption" }))
    .toHaveCount(0);
});

test("une grève met à jour le planning, les jours travaillés et la paie", async ({ page }) => {
  await prepareStrikeDemo(page);
  const workedButton = page.getByRole("button", { name: "Détail des jours travaillés" });
  const initialWorked = Number((await workedButton.innerText()).match(/[\d,.]+/)![0].replace(",", "."));

  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" })
    .getByRole("button", { name: /^Grève/ })
    .click();
  await expect(page.getByRole("heading", { name: "Ajoutez une journée de grève" })).toBeVisible();
  await expect(page.getByText("Ajout direct au planning", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Enregistrer la grève/ })).toHaveCount(0);
  const strikeElementsOverlap = await page.locator(".strike-request-options").evaluate((panel) => {
    const choice = panel.querySelector(".type-tabs button")!.getBoundingClientRect();
    const help = panel.querySelector(".request-help")!.getBoundingClientRect();
    return (
      choice.x < help.x + help.width &&
      choice.x + choice.width > help.x &&
      choice.y < help.y + help.height &&
      choice.y + choice.height > help.y
    );
  });
  expect(strikeElementsOverlap).toBe(false);
  const strikeDay = page.locator(".month-card .day.work").first();
  const strikeDate = await strikeDay.getAttribute("aria-label");
  await strikeDay.click();
  await expect(page.getByRole("heading", { name: "Ajoutez une journée de grève" })).toHaveCount(0);

  const markedStrike = page.locator(".month-card .day.leave-strike");
  await expect(markedStrike).toHaveCount(1);
  await expect(markedStrike).toHaveCSS("background-color", "rgb(242, 139, 130)");
  await expect(markedStrike).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
  await expect(markedStrike).toHaveCSS("border-right-color", "rgb(0, 0, 0)");
  await expect(markedStrike).toHaveCSS("border-bottom-color", "rgb(0, 0, 0)");
  await expect(markedStrike).toHaveCSS("border-left-color", "rgb(0, 0, 0)");
  await expect(markedStrike).toHaveCSS("outline-color", "rgb(0, 0, 0)");
  await expect(markedStrike).toHaveCSS("outline-style", "solid");
  await expect(markedStrike.locator(".leave-calendar-marker-strike")).toHaveText("✊");
  const [strikeDayBox, strikeMarkerBox] = await Promise.all([
    markedStrike.boundingBox(),
    markedStrike.locator(".leave-calendar-marker-strike").boundingBox(),
  ]);
  expect(strikeMarkerBox!.height / strikeDayBox!.height).toBeGreaterThan(0.12);
  expect(strikeMarkerBox!.height / strikeDayBox!.height).toBeLessThan(0.3);
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    expect(strikeDayBox!.x + strikeDayBox!.width - strikeMarkerBox!.x - strikeMarkerBox!.width).toBeLessThanOrEqual(4);
    expect(strikeDayBox!.y + strikeDayBox!.height - strikeMarkerBox!.y - strikeMarkerBox!.height).toBeLessThanOrEqual(4);
  }
  await expect(markedStrike).toHaveAttribute("aria-label", /Grève/);
  expect(await markedStrike.getAttribute("aria-label")).toContain(strikeDate!.split(", Travail")[0]);
  const workedAfterStrike = Number((await workedButton.innerText()).match(/[\d,.]+/)![0].replace(",", "."));
  expect(workedAfterStrike).toBe(initialWorked - 1);

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  const strikeCard = page.locator(".leave-balance-grid button.strike");
  await expect(strikeCard).toContainText(/1\s*pris/);
  await expect(strikeCard).toContainText("retenue estimée dans Ma paie");
  await expect(page.locator(".leave-balance-grid button.annual")).toContainText("0 utilisé");
  const [balanceGridBox, strikeCardBox, annualCardBox, otherCardBox] = await Promise.all([
    page.locator(".leave-balance-grid").boundingBox(),
    strikeCard.boundingBox(),
    page.locator(".leave-balance-grid button.annual").boundingBox(),
    page.locator(".leave-balance-grid button.other").boundingBox(),
  ]);
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    expect(strikeCardBox!.width).toBeGreaterThan(balanceGridBox!.width * 0.9);
    expect(strikeCardBox!.height).toBeLessThan(annualCardBox!.height);
  } else {
    expect(Math.abs(otherCardBox!.y - strikeCardBox!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(otherCardBox!.width - strikeCardBox!.width)).toBeLessThanOrEqual(2);
  }
  await strikeCard.click();
  const strikeBalanceDialog = page.getByRole("dialog", { name: "Grève" });
  await expect(strikeBalanceDialog).toContainText("aucun congé déduit");
  const strikeMonth = strikeBalanceDialog.locator(".balance-detail-month").filter({ hasText: "1 jour" }).first();
  await strikeMonth.locator("summary").click();
  await expect(strikeMonth).toContainText("Retenue estimée : −61,86");
  await strikeMonth.locator(".balance-detail-open").click();
  const dayDialog = page.getByRole("dialog", { name: /2026/ });
  await expect(dayDialog.locator(".day-stored-periods")).toContainText("Grève");
  await dayDialog.getByRole("button", { name: "Fermer" }).click();

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();
  await page.getByRole("button", { name: /Bulletins et estimations/ }).click();
  const strikePayRow = page.getByRole("row").filter({ hasText: "Grève (1 journée retenue)" });
  await expect(strikePayRow).toContainText("-61,86");
  await expect(strikePayRow).toContainText("retenue au 1/30");

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await page.locator(".leave-balance-grid button.strike").click();
  const deleteMonth = page.getByRole("dialog", { name: "Grève" })
    .locator(".balance-detail-month").filter({ hasText: "1 jour" }).first();
  await deleteMonth.locator("summary").click();
  await deleteMonth.locator(".balance-detail-open").click();
  await page.getByRole("dialog", { name: /2026/ })
    .getByRole("button", { name: "Supprimer la grève" })
    .click();
  await page.getByRole("alertdialog", { name: "Supprimer cette journée de grève ?" })
    .getByRole("button", { name: "Supprimer la grève" })
    .click();
  await expect(page.locator(".leave-balance-grid button.strike")).toContainText(/0\s*pris/);

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();
  await page.getByRole("button", { name: /Bulletins et estimations/ }).click();
  await expect(page.getByRole("row").filter({ hasText: /^Grève/ })).toHaveCount(0);
});

test("une grève peut être posée directement depuis une case", async ({ page }) => {
  await prepareStrikeDemo(page);
  await page.locator(".month-card .day.work").first().click();
  const dayDialog = page.getByRole("dialog", { name: /2026/ });
  await dayDialog.getByRole("button", { name: /^Grève/ }).click();
  await expect(dayDialog).toHaveCount(0);
  const savedStrike = page.locator(".month-card .day.leave-strike");
  await expect(savedStrike).toHaveCount(1);
  await expect(savedStrike).toHaveCSS("background-color", "rgb(242, 139, 130)");
  await expect(savedStrike).toHaveCSS("outline-color", "rgb(0, 0, 0)");
});

test("des CA validés entre deux grèves restent exclus de la retenue", async ({ page }) => {
  await prepareStrikeContinuityDemo(page, "annual");
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await page.locator(".leave-balance-grid button.strike").click();
  const strikeDialog = page.getByRole("dialog", { name: "Grève" });
  const month = strikeDialog.locator(".balance-detail-month").filter({ hasText: "2 jours" }).first();
  await month.locator("summary").click();
  await expect(month.locator(".strike-protected-break")).toContainText("CA validés → non concernés");
  await expect(month.locator(".strike-continuity-warning")).toHaveCount(0);
  await expect(month.locator(".strike-continuity-details footer")).toContainText("Total retenue estimée sur 2 journées");
  await expect(month.locator(".strike-continuity-details footer")).toContainText("123,72 € brut");
  await expect(page.locator(".leave-balance-grid button.annual")).toContainText(/[1-9]\d* utilisé/);
});

test("des repos noirs entre deux grèves sont inclus automatiquement dans la retenue", async ({ page }) => {
  const scenario = await prepareStrikeContinuityDemo(page, "rest");
  const intermediateCount = Math.round(
    (new Date(`${scenario.last}T12:00:00`).getTime() - new Date(`${scenario.first}T12:00:00`).getTime()) /
      86400000,
  ) - 1;
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await page.locator(".leave-balance-grid button.strike").click();
  const strikeDialog = page.getByRole("dialog", { name: "Grève" });
  const month = strikeDialog.locator(".balance-detail-month").filter({ hasText: "2 jours" }).first();
  await month.locator("summary").click();
  await expect(month.locator(".strike-confirmed-continuity")).toContainText(
    "repos noirs inclus dans la retenue",
  );
  await expect(month.locator(".strike-confirmed-continuity")).toContainText(
    "reste « repos du cycle » dans le planning",
  );
  await expect(month.locator(".strike-continuity-warning")).toHaveCount(0);
  await expect(month.locator(".strike-continuity-details footer")).toContainText(
    `${intermediateCount} repos noir${intermediateCount > 1 ? "s" : ""}`,
  );
  const retainedDays = intermediateCount + 2;
  const expectedDeduction = (61.86 * retainedDays).toFixed(2).replace(".", ",");
  await expect(month.locator(".strike-continuity-details footer")).toContainText(
    `Total retenue estimée sur ${retainedDays} journée${retainedDays > 1 ? "s" : ""}`,
  );
  await expect(month.locator(".strike-continuity-details footer")).toContainText(
    `${expectedDeduction} € brut`,
  );

  await strikeDialog.locator(".modal-actions").getByRole("button", { name: "Fermer" }).click();
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();
  await page.getByRole("button", { name: /Bulletins et estimations/ }).click();
  const strikePayRow = page.getByRole("row").filter({
    hasText: `Grève (${retainedDays} journées retenues)`,
  });
  await expect(strikePayRow).toContainText(`${intermediateCount} repos noir`);
  await expect(strikePayRow).toContainText(`-${expectedDeduction}`);
});

test("un congé souhaité s’ajoute et se retire sans enregistrer", async ({ page }) => {
  await prepareDemo(page);
  const workDay = page.locator(".month-card .day.work").first();
  await workDay.click();
  const dayDialog = page.getByRole("dialog", { name: /2026/ });
  await dayDialog.getByRole("button", { name: /^Congé souhaité/ }).click();
  await expect(dayDialog).toHaveCount(0);
  await expect(workDay).toHaveClass(/wish-day/);

  await workDay.click();
  const savedWishDialog = page.getByRole("dialog", { name: /2026/ });
  await savedWishDialog.getByRole("button", { name: /^Congé souhaité/ }).click();
  await expect(savedWishDialog).toHaveCount(0);
  await expect(workDay).not.toHaveClass(/wish-day/);
});

test("le congé CET est proposé depuis les demandes et depuis une case", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".planning-leave-panel .planning-leave-action").click();
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
  await page.locator(".planning-leave-panel .planning-leave-action").click();
  const chooser = page.getByRole("dialog", { name: "Que souhaitez-vous poser ?" });
  await expect(chooser.locator(".choice-grid > button > strong")).toHaveText([
    "Un congé",
    "Une récupération",
    "Un arrêt maladie",
    "Divers",
    "Grève",
    "CET",
  ]);
  await expect(chooser.locator(".sick-leave-choice")).toHaveCSS("background-color", "rgb(250, 251, 253)");
  await expect(chooser.locator(".cet-leave-choice")).toHaveCSS("background-color", "rgb(250, 251, 253)");
  await chooser.getByRole("button", { name: "Fermer" }).click();

  await page.locator(".month-card .day").first().click();
  const dayDialog = page.getByRole("dialog", { name: /2026/ });
  await expect(dayDialog.locator(".leave-choices > button")).toHaveText([
    /Congé/,
    /Récupération/,
    /Congé souhaitéHors période d’ouverture/,
    /Maladie/,
    /Divers/,
    /Grève/,
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
  await page.locator(".planning-leave-panel .planning-leave-action").click();
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
  const durationChoice = recoveryPanel.locator(".recovery-duration-field");
  await expect(durationChoice.locator("legend")).toHaveText("Heures à poser pour chaque date");
  await expect(durationChoice.getByRole("button", { name: "8 h" })).toHaveCSS(
    "background-color",
    "rgb(49, 94, 170)",
  );
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

  await page.locator(".planning-leave-panel .planning-leave-action").click();
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

  await page.locator(".planning-leave-panel .planning-leave-action").click();
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

  await page.locator(".planning-leave-panel .planning-leave-action").click();
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

  await page.locator(".planning-leave-panel .planning-leave-action").click();
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
  await expect(page.locator(".manual-adjustments-trigger")).toContainText(
    "Ajouter des jours et dimanches déjà posés, sans préciser les dates",
  );
  const [mecenatBox, archiveBox] = await Promise.all([
    page.locator(".mecenat-balance-card").boundingBox(),
    page.locator(".leave-request-archive").boundingBox(),
  ]);
  expect(mecenatBox).not.toBeNull();
  expect(archiveBox).not.toBeNull();
  expect(archiveBox!.y).toBeGreaterThan(mecenatBox!.y);
  const archive = page.locator(".leave-request-archive");
  await expect(archive.getByRole("button", { name: /Autre/ })).toContainText("Mes demandes archivées");
  await expect(archive).toHaveCSS("background-image", /linear-gradient/);
  await expect(archive.locator(".request-archive-icon")).toHaveCSS("color", "rgb(112, 66, 134)");
  const [otherTitleBox, archivedLabelBox] = await Promise.all([
    archive.locator(".request-archive-copy strong").boundingBox(),
    archive.locator(".request-archive-copy .step-label").boundingBox(),
  ]);
  expect(otherTitleBox).not.toBeNull();
  expect(archivedLabelBox).not.toBeNull();
  expect(otherTitleBox!.y).toBeLessThan(archivedLabelBox!.y);
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

  await page.locator(".today-overview-heading .group-heading-action").click();
  const groups = page.getByRole("dialog", { name: "Choisir mon groupe" });
  await expect(groups.locator(".group-choice-grid > button")).toHaveCount(3);
  await groups.locator(".group-choice-grid > button").first().click();
  await expect(groups).toHaveCount(0);
  await expect(page.locator(".today-overview-heading .group-heading-action")).toHaveText("Je suis groupe 1");

  await page.getByRole("button", { name: "Ajouter une note" }).click();
  const note = page.getByRole("dialog", { name: "Ajouter une note" });
  await note.locator("textarea").fill("Contrôle du parcours de note");
  await expect(note.locator("textarea")).toHaveValue("Contrôle du parcours de note");
  await note.getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("button", { name: "Compte" }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Gérer mes données" }).click();
  await expect(page.getByRole("dialog")).toContainText(/sauvegarde|données/i);

  await page.goto("/formulaire/index.html?planning=1");
  const back = page.getByRole("link", { name: "Revenir à l’application" });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("href", "/");
});
