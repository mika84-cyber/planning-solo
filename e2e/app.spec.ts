import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  coWorkingGroupsForDate,
  compactWeekdayDate,
  dateKey,
  getDayInfo,
  localDate,
  longDate,
  monthDays,
  nextAttendanceDay,
} from "../src/planningLogic";
import { workedDayCount } from "../src/appModel";
import { GRAND_PALAIS_EXCEPTIONAL_CLOSURES } from "../src/grandPalaisClosures";

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

async function openLeaveTool(page: Page, label: string) {
  const disclosure = page.locator("details.leave-tool-disclosure").filter({ hasText: label });
  if ((await disclosure.getAttribute("open")) === null) await disclosure.locator("summary").click();
}

async function openMainMenu(page: Page) {
  const adaptiveMore = page.locator(".mobile-bottom-navigation:visible, .desktop-side-navigation:visible").getByRole("button", { name: "Plus" }).first();
  if (await adaptiveMore.count()) await adaptiveMore.click();
  else await page.getByRole("button", { name: "Ouvrir le menu principal" }).click();
  await expect(page.getByRole("complementary", { name: "Menu principal" })).toBeVisible();
}

test("les outils de congés sont repliés par défaut sur tous les écrans", async ({ page }) => {
  await prepareDemo(page);
  if (page.viewportSize()!.width <= 720 || page.viewportSize()!.width >= 1280) {
    await expect(page.getByRole("button", { name: "Compte" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ouvrir le menu principal" })).toBeVisible();
  }
  if (page.viewportSize()!.width <= 720) {
    await expect(page.locator(".mobile-bottom-navigation button > span")).toHaveText(["Accueil", "Congés", "Ma paie", "Docs", "Prog", "Collègues"]);
    await expect(page.locator(".mobile-bottom-navigation").getByRole("button", { name: "Plus" })).toHaveCount(0);
    const navButtons = await page.locator(".mobile-bottom-navigation > button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width));
    expect(Math.max(...navButtons.slice(0, 6)) - Math.min(...navButtons.slice(0, 6))).toBeLessThan(1);
    const mobileNav = page.locator(".mobile-bottom-navigation");
    const mobileNavHeight = (await mobileNav.boundingBox())!.height;
    expect(mobileNavHeight).toBeGreaterThanOrEqual(60);
    expect(mobileNavHeight).toBeLessThanOrEqual(72);
    const mobileStyles = await mobileNav.locator("button").evaluateAll((buttons) => buttons.slice(0, 2).map((button) => ({
      background: getComputedStyle(button).backgroundColor,
      divider: getComputedStyle(button, "::before").backgroundColor,
      dividerHeight: getComputedStyle(button, "::before").height,
    })));
    expect(mobileStyles[0].background).not.toBe(mobileStyles[1].background);
    expect(mobileStyles[1].dividerHeight).toBe("22px");
    expect(mobileStyles[1].divider).not.toBe("rgba(0, 0, 0, 0)");
  } else {
    const desktopNav = page.locator(".desktop-side-navigation");
    await expect(desktopNav.locator("button > span")).toHaveText(["Accueil", "Congés", "Ma paie", "Documents", "Programme", "Collègues"]);
    const desktopNavBox = (await desktopNav.boundingBox())!;
    expect(desktopNavBox.width).toBeGreaterThan(page.viewportSize()!.width * 0.98);
    expect(Math.abs(desktopNavBox.x + desktopNavBox.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
    expect(desktopNavBox.height).toBeGreaterThanOrEqual(60);
    const desktopStyles = await desktopNav.locator("button").evaluateAll((buttons) => buttons.slice(0, 2).map((button) => ({
      background: getComputedStyle(button).backgroundColor,
      dividerWidth: getComputedStyle(button).borderLeftWidth,
    })));
    expect(desktopStyles[0].background).not.toBe(desktopStyles[1].background);
    expect(desktopStyles[1].dividerWidth).toBe("1px");
  }
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" }).getByRole("button", { name: /Congés et récupérations/ }).click();
  await expect(page.locator("details.leave-tool-disclosure")).toHaveCount(3);
  await expect(page.locator("details.leave-tool-disclosure[open]")).toHaveCount(0);
  const firstDisclosureToggle = page.locator("details.leave-tool-disclosure summary i").first();
  expect(await firstDisclosureToggle.evaluate((node) => getComputedStyle(node, "::before").content)).toContain("Ouvrir");
  if (page.viewportSize()!.width <= 720) {
    const boxes = await page.locator("details.leave-tool-disclosure").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    const firstGap = boxes[1].y - boxes[0].y - boxes[0].height;
    const secondGap = boxes[2].y - boxes[1].y - boxes[1].height;
    expect(Math.abs(firstGap - secondGap)).toBeLessThan(1);
  }
  await page.getByText("Heures supplémentaires et récupérations", { exact: true }).first().click();
  await expect(page.locator("details.leave-tool-disclosure").first()).toHaveAttribute("open", "");
  expect(await firstDisclosureToggle.evaluate((node) => getComputedStyle(node, "::before").content)).toContain("Fermer");
});

test("la barre complète tient sur un Z Fold fermé", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Simulation dédiée au téléphone étroit");
  await page.setViewportSize({ width: 344, height: 882 });
  await prepareDemo(page);
  const navigation = page.locator(".mobile-bottom-navigation");
  await expect(navigation.locator("button > span")).toHaveText(["Accueil", "Congés", "Ma paie", "Docs", "Prog", "Collègues"]);
  await expect(navigation.locator("button")).toHaveCount(6);
  const boxes = await navigation.locator("button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON()));
  expect(boxes.slice(0, 6).every((box) => box.width >= 44)).toBe(true);
  expect(boxes.every((box) => box.x >= 0 && box.right <= 344)).toBe(true);
  await navigation.getByRole("button", { name: "Docs" }).click();
  await expect(page.locator(".top-header h1")).toContainText("Documents et contacts");
  await expect(navigation.getByRole("button", { name: "Docs" })).toHaveAttribute("aria-current", "page");
  const progLabel = navigation.getByRole("button", { name: "Prog" }).locator("span");
  const progTypography = await progLabel.evaluate((node) => {
    const style = getComputedStyle(node);
    return { fontSize: Number.parseFloat(style.fontSize), lineHeight: Number.parseFloat(style.lineHeight) };
  });
  expect(progTypography.lineHeight).toBeGreaterThan(progTypography.fontSize);
});

async function prepareFutureTrainingAbsenceDemo(
  page: Page,
  absence: "leave" | "recovery" = "leave",
) {
  const now = new Date();
  const searchStart = now < localDate(2026, 8, 27) ? localDate(2026, 8, 27) : now;
  const group = 2;
  const training = Array.from({ length: 366 }, (_, index) => addDays(searchStart, index + 1))
    .find((date) => getDayInfo(date, group).kind === "training");
  if (!training) throw new Error("Aucune formation future trouvée dans le cycle");
  const referenceDate = addDays(training, -1);
  const trainingKey = dateKey(training);
  const expectedNext = nextAttendanceDay(
    referenceDate,
    group,
    (candidateKey) => candidateKey === trainingKey,
  );
  if (!expectedNext) throw new Error("Aucun jour travaillé après la formation");
  await page.clock.setFixedTime(referenceDate);
  await page.addInitScript(({ periodDate, absence }) => {
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: `e2e-training-covered-by-${absence}`,
        requestKind: absence,
        group: 2,
        profile: { workQuota: "full" },
        periods: absence === "leave"
          ? [{ from: periodDate, to: periodDate, type: "annual" }]
          : [],
        timed: absence === "recovery"
          ? [{ date: periodDate, type: "recovery_training", start: "09:00", end: "15:00" }]
          : [],
      }),
    );
  }, { periodDate: trainingKey, absence });
  await prepareDemo(page);
  await expect(page.locator(".deferred-section-loading")).toHaveCount(0);
  return expectedNext;
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

async function prepareCompletePayDemo(page: Page, withSundayCarryover = true) {
  await page.addInitScript((seedCarryover) => {
    const profile = {
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
      netRatioFixed: 78.4,
      netRatioVariable: 86.2,
      netRatioRegime: "culture-psc",
      manualAdjustments: {
        "2026": {
          annualUsed: 0,
          rttUsed: 0,
          fractionUsed: 0,
          sundayLeaveJanJun: 0,
          sundayLeaveJulSep: 2,
          sundayLeaveOctNov: 0,
          sundayLeaveDec: 0,
        },
      },
      ...(seedCarryover
        ? {
            sundayCarryover: 1,
            sundayCarryoverYear: 2026,
            sundayCarryoverMonth: 9,
            sundayCarryoverFromYear: 2026,
            sundayCarryoverFromMonth: 6,
          }
        : {}),
    };
    localStorage.setItem("planning:e2e-pay-profile", JSON.stringify(profile));
    localStorage.setItem("planning:e2e-pay-profiles", JSON.stringify({ "2026": profile }));
  }, withSundayCarryover);
  await prepareDemo(page);
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

async function openUsefulResource(page: Page, name: "Formulaires" | "Contacts") {
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Documents et contacts/ })
    .click();
  await expect(page.getByRole("tab", { name: /^Formulaires/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Contacts/ })).toBeVisible();
  await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
}

test("les documents et contacts gardent trois onglets accessibles sur petit écran et Z Fold ouvert", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" }).getByRole("button", { name: /Documents et contacts/ }).click();
  const cards = page.locator(".useful-resource-tab");
  const boxes = await cards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  const pdfScale = await page.locator(".resource-pdf .useful-resource-tab-art img").evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a);
  expect(pdfScale).toBeGreaterThanOrEqual(1.24);
  if (page.viewportSize()!.width <= 720) {
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(3);
    expect(Math.abs(boxes[1].y - boxes[2].y)).toBeLessThan(3);
    expect(boxes[2].x + boxes[2].width - boxes[0].x).toBeGreaterThan(page.viewportSize()!.width * 0.92);
    expect(boxes[1].x - boxes[0].x - boxes[0].width).toBeLessThanOrEqual(10);
  }
  await page.getByRole("tab", { name: "Formulaires" }).click();
  await expect(page.getByRole("tabpanel", { name: "Formulaires" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toutes les rubriques" })).toBeVisible();
  const compactTabColors = await cards.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
  expect(new Set(compactTabColors).size).toBe(3);
  expect(await page.locator(".has-active-resource .useful-resource-tab-art").evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).display === "none"))).toBe(true);
  await expect(page.locator(".useful-form-folder-grid > button i")).toHaveCount(0);
  await page.getByRole("button", { name: /Formulaire Expo/ }).click();
  await expect(page.locator(".useful-forms-folder-header")).toHaveCSS("background-image", "none");
  await page.getByRole("button", { name: "Revenir aux dossiers de formulaires" }).click();
  await page.getByRole("button", { name: "Toutes les rubriques" }).click();
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  await expect(page.locator(".useful-resource-tab-art").first()).toBeVisible();
});

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

test("le partage de planning reste lisible et privé sur téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 344, height: 882 });
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Planning des collègues/ })
    .click();

  await expect(page.locator(".deferred-section-loading")).toHaveCount(0);
  const sharingIntro = page.locator(".colleague-sharing-intro");
  await expect(sharingIntro.getByRole("heading", { name: "Planning des collègues" })).toBeVisible();
  await expect(sharingIntro.getByText("Partage privé", { exact: true })).toBeVisible();
  await expect(sharingIntro).toHaveCSS("border-left-width", "5px");
  await expect(page.getByText("Votre adresse e-mail n’est jamais affichée.")).toBeVisible();
  await expect(page.locator(".colleague-profile-card")).toBeVisible();
  const [profileNameBox, profileSaveBox] = await Promise.all([
    page.locator(".colleague-profile-field input").boundingBox(),
    page.locator(".colleague-profile-save").boundingBox(),
  ]);
  expect(profileNameBox).not.toBeNull();
  expect(profileSaveBox).not.toBeNull();
  if ((page.viewportSize()?.width ?? 1000) <= 700) {
    expect(Math.abs(profileNameBox!.y - profileSaveBox!.y)).toBeLessThanOrEqual(2);
    expect(profileSaveBox!.x).toBeGreaterThan(profileNameBox!.x);
  }
  const directoryVisibility = page.getByRole("button", { name: "Masquer mon nom dans l’annuaire" });
  await expect(directoryVisibility).toContainText("Visible");
  page.once("dialog", (dialog) => dialog.accept());
  await directoryVisibility.click();
  await expect(page.getByRole("button", { name: "Afficher mon nom dans l’annuaire" })).toContainText("Masqué");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Afficher mon nom dans l’annuaire" }).click();
  await expect(page.getByRole("button", { name: "Masquer mon nom dans l’annuaire" })).toContainText("Visible");
  await expect(page.locator(".colleague-profile-row")).toHaveCSS("background-color", "rgb(241, 246, 252)");
  await expect(page.getByRole("heading", { name: "Un partage simple et maîtrisé" })).toBeVisible();
  await expect(page.getByText(/Consultez les noms de l’annuaire et bloquez discrètement/)).toBeVisible();
  const colleagueIllustration = page.locator(".top-header-colleagues .colleague-header-illustration");
  await expect(colleagueIllustration).toBeVisible();
  await expect(colleagueIllustration).toHaveAttribute("src", "/colleague-planning-header.png");
  await expect(colleagueIllustration).toHaveCSS("object-fit", "contain");
  await expect(page.locator(".top-header-colleagues")).toHaveCSS("background-color", "rgb(11, 12, 16)");
  await expect(page.locator(".top-header-colleagues")).toHaveCSS("background-image", "none");
  await expect(page.locator(".top-header-colleagues")).toHaveCSS("border-radius", "28px");
  await expect(page.locator(".top-header-colleagues .top-header-title h1 span")).toHaveCount(2);
  expect(parseFloat(await page.locator(".top-header-colleagues .top-header-title h1").evaluate((node) => getComputedStyle(node).fontSize))).toBeLessThanOrEqual(16);
  const [colleagueHeaderBox, colleagueTitleBox, colleagueMenuBox] = await Promise.all([
    page.locator(".top-header-colleagues").boundingBox(),
    page.locator(".top-header-colleagues .top-header-title").boundingBox(),
    page.locator(".top-header-colleagues .main-menu-button").boundingBox(),
  ]);
  const colleagueImageBox = await colleagueIllustration.boundingBox();
  expect(colleagueTitleBox!.x - colleagueHeaderBox!.x).toBeLessThan(22);
  expect(colleagueTitleBox!.y - colleagueHeaderBox!.y).toBeLessThan(22);
  expect(colleagueHeaderBox!.x + colleagueHeaderBox!.width - colleagueMenuBox!.x - colleagueMenuBox!.width).toBeLessThan(22);
  expect(colleagueMenuBox!.y - colleagueHeaderBox!.y).toBeLessThan(30);
  expect(colleagueImageBox!.y).toBeGreaterThanOrEqual(colleagueHeaderBox!.y);
  expect(colleagueImageBox!.y + colleagueImageBox!.height).toBeLessThanOrEqual(colleagueHeaderBox!.y + colleagueHeaderBox!.height);
  await expect(page.getByRole("button", { name: "Compte" })).toBeVisible();
  await expect(page.locator(".top-header-colleagues .header-update-button")).toHaveCount(0);
  const shareMenu = page.locator("summary").filter({ hasText: "Partager mon planning" });
  await expect(shareMenu).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choisir un collègue" })).toHaveCount(0);
  await shareMenu.click();
  const chooseCard = page.getByRole("heading", { name: "Choisir un collègue" }).locator("xpath=..");
  await expect(chooseCard.getByText("Agnès", { exact: true })).toBeVisible();
  await expect(chooseCard.getByText(/Envoyez votre planning au collègue de votre choix/)).toBeVisible();
  await expect(chooseCard.getByText(/Annuaire : 3 collègues/)).toBeVisible();
  await expect(chooseCard.getByRole("button", { name: "Bloquer" })).toHaveCount(3);
  await expect(chooseCard.getByRole("button", { name: "Envoyer", exact: true })).toHaveCount(2);
  await expect(chooseCard.locator(".colleague-person-row").first()).toContainText("Agnès");
  const agnesSharedRow = chooseCard.locator(".colleague-person-row").filter({ hasText: "Agnès" });
  await expect(agnesSharedRow.getByText("Planning partagé", { exact: true })).toBeVisible();
  await expect(agnesSharedRow).toHaveCSS("border-top-color", "rgb(143, 169, 195)");
  await expect(page.getByRole("button", { name: "Voir", exact: true })).toHaveCount(1);
  const samirRow = chooseCard.locator(".colleague-person-row").filter({ hasText: "Samir" });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Bloquer Samir");
    await dialog.dismiss();
  });
  await samirRow.getByRole("button", { name: "Bloquer" }).click();
  await expect(page.getByRole("heading", { name: "Gérer mes blocages" })).toHaveCount(0);
  page.once("dialog", async (dialog) => dialog.accept());
  await samirRow.getByRole("button", { name: "Bloquer" }).click();
  await expect(page.getByRole("heading", { name: "Gérer mes blocages" })).toBeVisible();
  page.once("dialog", async (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Débloquer" }).click();
  await expect(page.getByRole("button", { name: "Modifier", exact: true })).toBeDisabled();
  const camilleRow = chooseCard.locator(".colleague-person-row").filter({ hasText: "Camille" });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Envoyer votre planning à Camille");
    await dialog.accept();
  });
  await camilleRow.getByRole("button", { name: "Envoyer", exact: true }).click();
  const sharedRow = chooseCard.locator(".colleague-person-row").filter({ hasText: "Camille" });
  await expect(sharedRow.getByText("Planning partagé", { exact: true })).toBeVisible();
  await expect(sharedRow.getByRole("button", { name: "Arrêter la diffusion" })).toBeVisible();
  await expect(sharedRow.getByRole("button", { name: "Bloquer" })).toBeVisible();

  const receivedCard = page.locator(".colleague-received-card");
  await expect(receivedCard.locator(".colleague-received-person").first()).toHaveCSS("border-left-color", "rgb(141, 107, 174)");
  await expect(receivedCard.locator(".colleague-received-avatar").first()).toBeVisible();
  await expect(receivedCard.getByRole("heading", { name: /^Qui travaille demain \? \([^\d]+ \d{1,2} [^)]+\)$/ })).toBeVisible();
  await expect(receivedCard.locator(".colleague-tomorrow-list")).toContainText(/Agnès.*(Travail|Repos|Absence)/);
  await receivedCard.getByRole("button", { name: "Voir" }).click();
  await expect(page.getByRole("heading", { name: "Agnès", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choisir un collègue" })).toHaveCount(0);
  await expect(page.getByText("Absent").first()).toBeVisible();
  await expect(page.getByText("Demi-journée · matin")).toBeVisible();
  await expect(page.locator(".colleague-day.absent").first()).toHaveCSS("background-color", "rgb(239, 171, 184)");
  await expect(page.locator(".colleague-day.half-morning")).toHaveCSS("border-top-color", "rgb(189, 73, 97)");
  await expect(page.locator(".colleague-day.outside")).toHaveCount(12);
  await expect(page.locator(".colleague-day.outside").first()).toHaveText("");
  await expect(page.locator('.colleague-day[aria-current="date"]')).toHaveCount(1);
  await expect(page.locator('.colleague-day[aria-current="date"] .colleague-today-dot')).toBeVisible();
  await expect(page.getByText("Les absences sont volontairement affichées sans leur motif.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Télécharger le mois" })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  const [desktopTools, desktopCalendar] = await Promise.all([
    page.locator(".colleague-planning-tools").boundingBox(),
    page.locator(".colleague-calendar").boundingBox(),
  ]);
  expect(Math.abs(desktopTools!.width - desktopCalendar!.width)).toBeLessThan(2);
  await page.setViewportSize({ width: 344, height: 882 });
  const annualPdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger en PDF" }).click();
  expect((await annualPdfDownload).suggestedFilename()).toBe("planning-agnes-2026.pdf");
  await page.getByRole("button", { name: "Retour à mes collègues" }).click();
  page.once("dialog", async (dialog) => dialog.accept());
  await receivedCard.getByRole("button", { name: "Supprimer l’accès" }).click();
  await expect(receivedCard.getByText("Aucun planning partagé pour le moment.")).toBeVisible();
  await shareMenu.click();
  page.once("dialog", async (dialog) => dialog.accept());
  await sharedRow.getByRole("button", { name: "Arrêter la diffusion" }).click();
  await expect(sharedRow.getByRole("button", { name: "Envoyer", exact: true })).toBeVisible();
  await expect(sharedRow.getByText("Planning partagé", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 646, height: 904 });
  const intermediateTitle = await page.locator(".top-header-colleagues .top-header-title").boundingBox();
  const intermediateMenu = await page.locator(".top-header-colleagues .account-button").boundingBox();
  const intermediateImage = await colleagueIllustration.boundingBox();
  expect(intermediateImage!.width).toBeGreaterThan(360);
  expect(intermediateImage!.height).toBeGreaterThan(170);
  expect(intermediateImage!.x).toBeGreaterThanOrEqual(intermediateTitle!.x + intermediateTitle!.width);
  expect(intermediateImage!.x + intermediateImage!.width).toBeLessThanOrEqual(intermediateMenu!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 900, height: 1000 });
  const openScreenHeader = await page.locator(".top-header-colleagues").boundingBox();
  const openScreenMenu = await page.locator(".top-header-colleagues .account-button").boundingBox();
  const openScreenImage = await colleagueIllustration.boundingBox();
  expect(openScreenHeader!.height).toBeLessThanOrEqual(240);
  await expect(colleagueIllustration).toHaveCSS("max-height", "213px");
  expect(Math.abs((openScreenImage!.x + openScreenImage!.width / 2) - (openScreenHeader!.x + openScreenHeader!.width / 2))).toBeLessThan(2);
  expect(openScreenHeader!.x + openScreenHeader!.width - openScreenMenu!.x - openScreenMenu!.width).toBeLessThan(90);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.locator(".colleague-sharing-columns").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(1);
  const desktopHeader = await page.locator(".top-header-colleagues").boundingBox();
  const desktopImage = await colleagueIllustration.boundingBox();
  expect(desktopHeader!.height).toBeLessThanOrEqual(240);
  await expect(colleagueIllustration).toHaveCSS("max-height", "213px");
  expect(Math.abs((desktopImage!.x + desktopImage!.width / 2) - (desktopHeader!.x + desktopHeader!.width / 2))).toBeLessThan(2);
});

test("une invitation acceptée propose le partage en retour", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("planning:e2e-demo-enabled", "1");
    localStorage.setItem("planning:guide-seen-v1:demo", "1");
  });
  await page.goto("/?demo-share-invitation=1");
  await expect(page.getByRole("dialog", { name: /Agnès souhaite partager son planning/ })).toBeVisible();

  await page.getByRole("button", { name: "Accepter", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Partager aussi votre planning avec Agnès/ })).toBeVisible();
  await page.getByRole("button", { name: "Partager en retour" }).click();
  await expect(page.getByRole("dialog", { name: "Votre planning a bien été envoyé" })).toBeVisible();
  await expect(page.getByText("Agnès pourra désormais consulter votre planning.")).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(page.getByRole("heading", { name: "Planning des collègues" })).toBeVisible();
});

test("une demi-journée reste le prochain jour travaillé et y est précisée", async ({ page }) => {
  const nextWork = nextAttendanceDay(new Date(), 2);
  if (!nextWork) throw new Error("Aucun prochain jour travaillé trouvé");
  const nextWorkKey = dateKey(nextWork);
  await page.addInitScript((date) => {
    localStorage.setItem("planning:demo-completed-request-v1", JSON.stringify({
      requestId: "e2e-next-work-half-day",
      requestKind: "leave",
      group: 2,
      profile: { workQuota: "full" },
      periods: [],
      timed: [{ type: "half", date, start: "09:00", end: "13:30" }],
    }));
  }, nextWorkKey);
  await prepareDemo(page);

  const closureLabel = GRAND_PALAIS_EXCEPTIONAL_CLOSURES.some((item) => item.date === nextWorkKey)
    ? " — Fermeture exceptionnelle"
    : getDayInfo(nextWork, 2).kind === "training" ? " — Formation" : "";
  await expect(page.locator(".today-next-work strong")).toHaveText(
    `${compactWeekdayDate(nextWork)}${closureLabel} — 1/2 journée posée le matin`,
  );
});

test("Aujourd’hui conserve le groupe pendant la demi-journée travaillée", async ({ page }) => {
  const searchStart = localDate(2026, 8, 1);
  const workDay = Array.from({ length: 40 }, (_, index) => addDays(searchStart, index))
    .find((date) => getDayInfo(date, 2).kind === "work" && coWorkingGroupsForDate(date, 2).length > 0);
  if (!workDay) throw new Error("Aucune journée commune trouvée");
  const colleagueGroup = coWorkingGroupsForDate(workDay, 2)[0];
  await page.clock.setFixedTime(workDay);
  await page.addInitScript((date) => {
    localStorage.setItem("planning:demo-completed-request-v1", JSON.stringify({
      requestId: "e2e-today-half-day",
      requestKind: "leave",
      group: 2,
      profile: { workQuota: "full" },
      periods: [],
      timed: [{ type: "half", date, start: "13:30", end: "20:30" }],
    }));
  }, dateKey(workDay));
  await prepareDemo(page);
  await expect(page.locator(".today-status strong")).toContainText("1/2 journée posée l’après-midi");
  await expect(page.locator(".today-status small")).toHaveText(`Avec le groupe ${colleagueGroup}`);
});

test("l’accueil signale uniquement les horaires de travail manquants", async ({ page }) => {
  await prepareDemo(page);
  const setup = page.locator(".home-setup-alert");
  await expect(setup).toHaveCount(1);
  await expect(setup).toContainText("Renseigner vos horaires de travail");
  await expect(setup).toContainText("Renseignez votre plage de travail habituelle");
  await expect(setup).not.toContainText("Les éléments de paie peuvent être remplis automatiquement");
  await expect(setup).not.toContainText("Ajouter votre signature");
  await expect(setup).toHaveCSS("margin-top", "12px");
  await expect(setup).toHaveCSS("margin-bottom", "12px");
});

test("une photo de bulletin est reconnue localement", async ({ page }) => {
  test.setTimeout(120_000);
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();

  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 1300;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.font = "700 58px Arial";
    [
      "BULLETIN DE PAIE",
      "Septembre 2026",
      "Traitement de Base 1 855,88",
      "IFSE 415,00",
      "CUMUL BRUT 2 962,07",
      "NET A PAYER AVANT IMPOT 2 311,42",
    ].forEach((line, index) => context.fillText(line, 90, 150 + index * 170));
    return canvas.toDataURL("image/png").split(",")[1];
  });

  const photoInput = page.locator(".payslip-file-drop input");
  await expect(photoInput).toHaveAttribute("accept", /image\/jpeg/);
  await expect(photoInput).toHaveAttribute("multiple", "");
  await expect(page.getByText(/choisissez les 2 photos ensemble/)).toHaveCount(0);
  const detectedValuesDialog = new Promise<void>((resolve, reject) => {
    page.on("dialog", async (dialog) => {
      try {
        if (dialog.message().includes("La lecture risque d’être moins fiable")) {
          await dialog.accept();
          return;
        }
        expect(dialog.message()).toContain("Vérifiez les valeurs détectées");
        await dialog.accept();
        resolve();
      } catch (error) { reject(error); }
    });
  });
  await photoInput.setInputFiles({
    name: "bulletin-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(imageBase64, "base64"),
  });
  await detectedValuesDialog;

  await expect(page.locator(".payslip-detected-period")).toContainText("septembre 2026", { timeout: 90_000 });
  await expect(page.locator(".payslip-actual-values")).toContainText("2 962,07 €");
  const payMonthNavigation = page.locator(".pay-dashboard-month");
  await payMonthNavigation.getByRole("button", { name: "Mois suivant" }).click();
  await expect(page.locator("#pay-dashboard-title")).toHaveText("Octobre 2026");
  await expect(page.locator(".payslip-detected-period")).toHaveCount(0);
  await expect(page.locator(".payslip-actual-values")).toHaveCount(0);
  await expect(page.getByText(/champs remplis : Traitement de base/)).toHaveCount(0);
  await payMonthNavigation.getByRole("button", { name: "Mois précédent" }).click();
  await expect(page.locator("#pay-dashboard-title")).toHaveText("Septembre 2026");
  await expect(page.locator(".payslip-detected-period")).toContainText("septembre 2026");
  const decision = page.getByRole("region", { name: "Conclusion de la vérification" });
  await decision.getByRole("button", { name: "Tout est OK" }).click();
  const greenCheck = page.getByRole("button", { name: "Revoir la vérification de septembre 2026" });
  await expect(greenCheck).toBeVisible();
  await expect(page.locator(".payslip-result-summary")).toHaveCount(0);
  await expect(page.locator(".payslip-detected-period")).toHaveCount(0);

  await greenCheck.click();
  await decision.getByRole("button", { name: "Signaler une anomalie" }).click();
  await expect(page.getByLabel("Anomalies ou observations")).toHaveCount(0);
  const savedAttention = page.getByRole("region", { name: "Résultat du bulletin signalé" });
  await expect(savedAttention.getByRole("img", { name: "Anomalie signalée pour septembre 2026" })).toHaveText("✓");
  const anomalyDetails = savedAttention.locator(".payslip-anomaly-details");
  await expect(anomalyDetails).not.toHaveAttribute("open", "");
  await expect(anomalyDetails.getByText("septembre 2026")).toBeVisible();
  await anomalyDetails.locator("summary").click();
  await expect(anomalyDetails).toHaveAttribute("open", "");
  await expect(anomalyDetails.getByRole("button", { name: "E-mail" })).toBeVisible();
  await expect(anomalyDetails.getByRole("button", { name: "WhatsApp" })).toBeVisible();
  const download = page.waitForEvent("download");
  await anomalyDetails.getByRole("button", { name: "Télécharger le PDF" }).click();
  expect((await download).suggestedFilename()).toBe("anomalies-bulletin-2026-09.pdf");
});

test("menu, contact administratrice, paie et PDF restent accessibles", async ({ page }) => {
  await prepareDemo(page);
  await expect(page.locator(".deferred-section-loading")).toHaveCount(0);
  const headerHeight = () => page.locator(".top-header").evaluate((node) => node.getBoundingClientRect().height);
  const expectHeaderWidth = async (locator: ReturnType<typeof page.locator>) => {
    const [headerBox, categoryBox] = await Promise.all([
      page.locator(".top-header").boundingBox(),
      locator.boundingBox(),
    ]);
    expect(headerBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(Math.abs(categoryBox!.x - headerBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(categoryBox!.width - headerBox!.width)).toBeLessThanOrEqual(1);
  };
  const homeHeaderHeight = await headerHeight();
  await expect(page.locator(".top-header .header-update-button")).toHaveCount(0);
  const accountButton = page.getByRole("button", { name: "Compte" });
  await accountButton.click();
  const updateMenuItem = page.getByRole("menuitem", { name: "Vérifier les mises à jour" });
  await expect(updateMenuItem).toBeVisible();
  await expect(updateMenuItem).toHaveCSS("border-radius", "12px");
  await expect(updateMenuItem).toHaveCSS("background-image", /linear-gradient/);
  const accountPanelBox = await page.getByRole("menu").boundingBox();
  const headerBoxWithMenu = await page.locator(".top-header").boundingBox();
  expect(accountPanelBox!.y + accountPanelBox!.height).toBeGreaterThan(headerBoxWithMenu!.y + headerBoxWithMenu!.height);
  expect(await page.getByRole("menu").evaluate((node) => getComputedStyle(node.closest(".top-header")!).overflow)).toBe("visible");
  await accountButton.click();
  await openMainMenu(page);

  const menu = page.getByRole("complementary", { name: "Menu principal" });
  const resources = menu.getByRole("button", { name: /Documents et contacts/ });
  const program = menu.getByRole("button", { name: /Programmation GP/ });
  const colleagues = menu.getByRole("button", { name: /Planning des collègues/ });
  const feedback = menu.getByRole("button", { name: /Messagerie interne/ });
  const adminContact = menu.getByRole("button", { name: /Messagerie interne/ });

  await expect(resources).toBeVisible();
  await expect(program).toBeVisible();
  await expect(colleagues).toBeVisible();
  await expect(feedback).toBeVisible();
  await expect(menu.getByRole("button", { name: /Mode d’emploi/ })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Sauvegarde et restauration" })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Vérifier les mises à jour" })).toHaveCount(0);
  const menuLabels = await menu.locator("nav > button").allTextContents();
  expect(menuLabels.findIndex((label) => label.includes("Programmation GP"))).toBe(
    menuLabels.findIndex((label) => label.includes("Documents et contacts")) + 1,
  );
  expect(menuLabels.at(-1)).toContain("Planning des collègues");
  await expect(adminContact.locator("xpath=..")).toHaveClass(/main-menu-secondary/);
  await expect(menu.getByRole("radiogroup", { name: "Choisir l’apparence" })).toHaveCount(0);
  await expect(menu).toHaveCSS("background-image", /menu-art-fast\.webp/);
  await expect(menu.locator(".main-menu-index")).toHaveCount(7);
  await expect(menu.locator("nav > button").first().locator(".main-menu-index svg")).toBeVisible();
  await expect(menu.locator("nav > button").first().locator("strong")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(adminContact).toHaveCSS("background-image", /linear-gradient/);

  const leaveMenuButton = menu.getByRole("button", { name: /Congés et récupérations/ });
  await expect(leaveMenuButton).toContainText("Soldes, CET, heures sup et mécénats");
  await leaveMenuButton.click();
  await expect(page.locator(".top-header h1")).toHaveText("Congés et récupérations");
  const leaveHeader = page.locator(".top-header-leave");
  const leaveArtwork = await leaveHeader.evaluate((header) => {
    const artwork = getComputedStyle(header, "::before");
    return {
      backgroundImage: artwork.backgroundImage,
      filter: artwork.filter,
      pointerEvents: artwork.pointerEvents,
    };
  });
  expect(leaveArtwork.backgroundImage).toContain("leave-header-art-fast.webp");
  expect(leaveArtwork.filter).toBe("none");
  expect(leaveArtwork.pointerEvents).toBe("none");
  expect(Math.abs((await headerHeight()) - homeHeaderHeight)).toBeLessThan(0.5);
  await expect(page.getByRole("heading", { name: "Gérer mes récupérations et demandes" })).toHaveCount(0);
  const leaveTools = page.locator(".leave-tools-area");
  await expectHeaderWidth(page.locator(".section-intro.leave-intro"));
  await expectHeaderWidth(page.locator(".leave-balances-direct"));
  await expectHeaderWidth(leaveTools);
  await expect(leaveTools).toHaveCSS("border-top-width", "1px");
  const secondaryDisclosures = leaveTools.locator(".leave-secondary-grid > .leave-tool-disclosure");
  await expect(secondaryDisclosures).toHaveCount(2);
  await secondaryDisclosures.nth(0).locator("summary").click();
  await secondaryDisclosures.nth(1).locator("summary").click();
  await leaveTools.locator(".cet-disclosure > summary").click();
  const overtimeCard = secondaryDisclosures.nth(0).locator(".overtime-balance-card");
  const mecenatCard = secondaryDisclosures.nth(1).locator(".mecenat-balance-card");
  const cetCard = leaveTools.locator(".cet-disclosure .cet-section-static");
  await expect(secondaryDisclosures.nth(0)).toHaveCSS("border-left-width", "1px");
  await expect(secondaryDisclosures.nth(1)).toHaveCSS("border-left-width", "1px");
  await expect(leaveTools.locator(".cet-disclosure")).toHaveCSS("border-left-width", "1px");
  await expect(overtimeCard).toHaveCSS("border-top-width", "0px");
  await expect(mecenatCard).toHaveCSS("border-top-width", "0px");
  const [mecenatBox, cetBox] = await Promise.all([mecenatCard.boundingBox(), cetCard.boundingBox()]);
  expect(mecenatBox).not.toBeNull();
  expect(cetBox).not.toBeNull();
  expect(cetBox!.y).toBeGreaterThan(mecenatBox!.y + mecenatBox!.height);
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    const leaveToolCards = await secondaryDisclosures.locator(".overtime-balance-card").evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect().toJSON()),
    );
    expect(leaveToolCards[1].y).toBeGreaterThan(leaveToolCards[0].y + leaveToolCards[0].height);
  }

  await openMainMenu(page);
  await menu.getByRole("button", { name: /Ma paie/ }).click();
  const payScreen = page.getByRole("region", { name: "Ma paie", exact: true });
  await expect(payScreen).toBeVisible();
  await expect(payScreen).toHaveCSS("animation-name", "none");
  await expect(page.locator(".deferred-section-loading")).toHaveCount(0);
  await expectHeaderWidth(payScreen);
  const payHeader = page.locator(".top-header-pay");
  await expect(payHeader.locator(".notification-button")).toHaveCount(0);
  const payArtwork = await payHeader.evaluate((header) => {
    const artwork = getComputedStyle(header, "::before");
    return {
      backgroundImage: artwork.backgroundImage,
      filter: artwork.filter,
      pointerEvents: artwork.pointerEvents,
    };
  });
  expect(payArtwork.backgroundImage).toContain("pay-header-art-fast.webp");
  expect(payArtwork.filter).toMatch(/saturate\(1\.4/);
  expect(payArtwork.filter).toContain("contrast");
  expect(payArtwork.pointerEvents).toBe("none");
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    const titleTransform = await payHeader.locator(".top-header-title").evaluate((node) => getComputedStyle(node).transform);
    expect(titleTransform).not.toBe("none");
  }
  expect(await payScreen.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toContain("pay-art.jpg");
  await expect(payScreen.locator(".pay-dashboard-month h2")).toHaveText(/^[a-zûéèàôîç]+ 2026$/i);
  await expect(page.getByText("Net estimé", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "À vérifier" })).toHaveCount(0);
  await expect(payScreen.locator(".pay-dashboard-checks")).toHaveCount(0);
  await expect(payScreen.locator(".pay-allowances-shortcut")).toHaveCount(0);
  await expect(payScreen.locator(".pay-profile-open-copy")).toHaveText(/Profil complet|À compléter/);
  const allowancesLink = page.getByRole("button", { name: "Primes et jours fériés" });
  await expect(allowancesLink).toBeVisible();
  const allowancesLinkPadding = await allowancesLink.evaluate((node) => getComputedStyle(node).paddingLeft);
  expect(Number.parseFloat(allowancesLinkPadding)).toBeGreaterThanOrEqual(14);
  await expect(payScreen.locator(".pay-dashboard-estimate")).toHaveCSS("border-left-width", "6px");
  await expect(page.getByRole("heading", { name: "Vérifier mon bulletin" })).toBeVisible();
  const profileSummary = payScreen.locator(".pay-profile-summary");
  await expect(profileSummary).toBeVisible();
  await expect(profileSummary.locator(".pay-profile-symbol")).toBeVisible();
  await expect(profileSummary).toHaveAttribute("aria-expanded", "false");
  await profileSummary.click();
  await expect(profileSummary).toHaveAttribute("aria-expanded", "true");
  await expect(payScreen.locator(".pay-profile-settings-grid")).toBeVisible();
  await profileSummary.click();
  const paySettings = page.getByRole("button", { name: /Réglages et explications/ });
  await expect(paySettings).toHaveAttribute("aria-expanded", "false");
  await expect(payScreen.getByRole("button", { name: /déclarer.*heures supplémentaires/i })).toHaveCount(0);
  await paySettings.click();
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    const dashboardWidth = await payScreen.locator(".pay-dashboard").evaluate((node) => node.getBoundingClientRect().width);
    expect(dashboardWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
    const [monthCopyBox, monthActionsBox, monthCardBox] = await Promise.all([
      payScreen.locator(".pay-dashboard-month > div").first().boundingBox(),
      payScreen.locator(".pay-dashboard-month-actions").boundingBox(),
      payScreen.locator(".pay-dashboard-month").boundingBox(),
    ]);
    expect(monthCopyBox).not.toBeNull();
    expect(monthActionsBox).not.toBeNull();
    expect(monthCardBox).not.toBeNull();
    expect(monthActionsBox!.x).toBeGreaterThan(monthCopyBox!.x);
    expect(monthCardBox!.height).toBeLessThanOrEqual(120);
  }
  expect(Math.abs((await headerHeight()) - homeHeaderHeight)).toBeLessThan(0.5);

  await openMainMenu(page);
  await menu.getByRole("button", { name: /Documents et contacts/ }).click();
  await page.getByRole("tab", { name: "Plannings PDF" }).click();
  await expect(page.getByRole("heading", { name: "Télécharger les plannings en PDF" })).toBeVisible();
  expect(await page.locator(".top-header-pdf").evaluate((node) => getComputedStyle(node, "::before").backgroundImage)).toContain("forms-header-art-fast.webp");
  const pdfScreen = page.locator(".pdf-download-screen");
  await expectHeaderWidth(pdfScreen);
  expect(await pdfScreen.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toContain("pdf-art.jpg");
  await expect(pdfScreen).toHaveCSS("border-top-color", "rgba(91, 111, 132, 0.42)");
  await expect(page.getByRole("heading", { name: "Préparer le planning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choisir le document" })).toBeVisible();
  await expect(pdfScreen.locator(".pdf-download-settings > label").first()).toHaveCSS("border-top-width", "1px");
  await expect(pdfScreen.locator(".pdf-download-actions .pdf-action")).toHaveCount(4);
  await expect(pdfScreen).toContainText("Cocher la case pour intégrer les vacances scolaires au planning");
  await expect(pdfScreen).not.toContainText("Pour faciliter les échanges sur jours fériés");
  await expect(pdfScreen.getByRole("button", { name: /Mon groupe/ })).toContainText("Planning annuel du groupe 2");
  await expect(pdfScreen.getByRole("button", { name: /Les 3 groupes/ })).toBeVisible();
  await expect(pdfScreen.getByRole("button", { name: /Mon planning avec congés/ })).toBeVisible();
  await expect(pdfScreen.getByRole("button", { name: /Fériés travaillés 2026–2031/ })).toContainText("Pour faciliter les échanges entre groupe");
  await expect(pdfScreen.locator(".pdf-download-actions .pdf-action").first()).toHaveCSS("border-top-color", "rgba(48, 87, 126, 0.42)");
  const pdfViewportWidth = page.viewportSize()?.width ?? 1000;
  if (pdfViewportWidth <= 720) {
    const mobileSettingBoxes = await pdfScreen.locator(".pdf-download-settings > label").evaluateAll((labels) =>
      labels.map((label) => label.getBoundingClientRect().toJSON()),
    );
    expect(Math.abs(mobileSettingBoxes[0].y - mobileSettingBoxes[1].y)).toBeLessThanOrEqual(1);
    const mobilePdfActions = await pdfScreen.locator(".pdf-download-actions .pdf-action").evaluateAll((actions) =>
      actions.map((action) => action.getBoundingClientRect().toJSON()),
    );
    expect(Math.abs(mobilePdfActions[0].y - mobilePdfActions[1].y)).toBeLessThanOrEqual(1);
    expect(mobilePdfActions[2].y).toBeGreaterThan(mobilePdfActions[0].y);
    expect(Math.abs(mobilePdfActions[2].y - mobilePdfActions[3].y)).toBeLessThanOrEqual(1);
    expect(Math.max(...mobilePdfActions.map(({ width }) => width)) - Math.min(...mobilePdfActions.map(({ width }) => width))).toBeLessThanOrEqual(1);
  } else if (pdfViewportWidth <= 1100) {
    await expect(pdfScreen.locator(".pdf-action-page-count").first()).toHaveCSS("position", "static");
    const titleHeights = await pdfScreen.locator(".pdf-action-copy strong").evaluateAll((titles) =>
      titles.map((title) => title.getBoundingClientRect().height),
    );
    expect(Math.max(...titleHeights)).toBeLessThan(54);
    const actionTops = await pdfScreen.locator(".pdf-action-cta").evaluateAll((actions) =>
      actions.map((action) => action.getBoundingClientRect().top),
    );
    expect(Math.max(...actionTops) - Math.min(...actionTops)).toBeLessThan(1);
    const noHorizontalOverflow = await pdfScreen.evaluate((screen) => screen.scrollWidth <= screen.clientWidth + 1);
    expect(noHorizontalOverflow).toBe(true);
  }
  expect(Math.abs((await headerHeight()) - homeHeaderHeight)).toBeLessThan(0.5);
});

test("la messagerie interne reste privée, compacte et utilisable avec une photo", async ({ page }) => {
  await prepareDemo(page);
  await expect(page.locator(".top-header").getByRole("status", { name: "1 message non lu" })).toHaveText("1");
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" }).getByRole("button", { name: /Messagerie interne/ }).click();

  await expect(page.getByRole("heading", { name: "Messages reçus" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Camille Dupont" })).toBeVisible();
  await expect(page.locator(".feedback-message-detail").getByText("Ce message d’exemple montre")).toBeVisible();
  await page.locator(".feedback-message-list button").first().click();
  const adminActions = page.locator(".feedback-admin-actions");
  await expect(adminActions.locator("button")).toHaveText(["Marquer comme résolu", "Envoyer la réponse", "Effacer"]);
  const actionBoxes = await adminActions.locator("button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { left: box.left, top: box.top };
  }));
  expect(Math.max(...actionBoxes.map(({ top }) => top)) - Math.min(...actionBoxes.map(({ top }) => top))).toBeLessThan(2);
  expect(actionBoxes[0].left).toBeLessThan(actionBoxes[1].left);
  expect(actionBoxes[1].left).toBeLessThan(actionBoxes[2].left);
  await page.getByPlaceholder("Écrivez le message qui apparaîtra sur son compte…").fill("Merci, cette amélioration sera ajoutée.");
  await page.getByRole("button", { name: "Envoyer la réponse" }).click();
  await expect(page.getByRole("region", { name: "Réponses déjà envoyées" }).getByText("Merci, cette amélioration sera ajoutée.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Marquer comme résolu" }).click();
  await expect(page.getByText("✓ Résolu")).toBeVisible();
  await expect(page.getByText("Envoyer un retour")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Effacer", exact: true }).click();
  await expect(page.getByText("Aucun message pour le moment.")).toBeVisible();

  await page.goto("/?local-test=1&preview-feedback-role=user&feedback=compose");
  await expect(page.getByRole("heading", { name: "Une idée à partager ?" })).toBeVisible();
  await expect(page.getByLabel("Nom affiché")).toHaveCount(0);
  await expect(page.getByText("Aucun nom à saisir")).toHaveCount(0);
  await expect(page.getByText("De quoi s’agit-il ?")).toHaveCount(0);
  await page.getByPlaceholder("Expliquez votre idée ou ce qui s’est passé…").fill("Le bouton de test ne répond plus sur mobile.");
  await page.getByLabel("Rester anonyme").check();
  await page.locator('.feedback-photo-field input[type="file"]').setInputFiles("public/favicon-48.png");
  await expect(page.getByAltText("Photo jointe")).toBeVisible();
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(page.getByRole("heading", { name: "Merci, votre message est bien arrivé." })).toBeVisible();
  await expect(page.getByText("Une alerte apparaîtra dans l’application")).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).click();
  await openMainMenu(page);
  const userMenu = page.getByRole("complementary", { name: "Menu principal" });
  await expect(userMenu.getByRole("button", { name: /Écrire à l’administratrice/ })).toBeVisible();
  await expect(userMenu.getByRole("button", { name: /Messagerie interne/ })).toHaveCount(0);

  await page.goto("/?local-test=1&preview-feedback-role=user&demo-feedback-reply=1");
  const privateReply = page.getByRole("alertdialog", { name: "Vous avez reçu une réponse" });
  await expect(privateReply).toBeVisible();
  await expect(privateReply.getByText("Merci pour votre message.")).toBeVisible();
  const replyBox = await privateReply.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs((replyBox!.x + replyBox!.width / 2) - viewport.width / 2)).toBeLessThan(8);
  expect(Math.abs((replyBox!.y + replyBox!.height / 2) - viewport.height / 2)).toBeLessThan(2);
});

test("le planning avec congés se génère avec les catégories d’absence", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: "e2e-pdf-all-absences",
        requestKind: "leave",
        group: 2,
        periods: [
          { from: "2026-01-02", to: "2026-01-02", type: "annual" },
          { from: "2026-01-03", to: "2026-01-03", type: "strike" },
          { from: "2026-01-04", to: "2026-01-04", type: "cet" },
          { from: "2026-01-05", to: "2026-01-05", type: "other" },
        ],
        timed: [],
      }),
    );
  });
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Documents et contacts/ })
    .click();
  await page.getByRole("tab", { name: "Plannings PDF" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Mon planning avec congés/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "planning-2026-groupe-2-avec-conges.pdf",
  );
  await expect(page.getByRole("dialog", { name: "Que souhaitez-vous faire ?" })).toHaveCount(0);
  const holidaysDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Fériés travaillés 2026–2031/ }).click();
  const holidaysDownload = await holidaysDownloadPromise;
  expect(holidaysDownload.suggestedFilename()).toBe("feries-travailles-2026-2031.pdf");
});

test("les formulaires utiles conservent leurs dossiers, leur ordre et leur téléchargement", async ({ page }) => {
  await prepareDemo(page);
  const homeHeaderBox = (await page.locator(".top-header").boundingBox())!;
  await openUsefulResource(page, "Formulaires");

  await expect(page.locator(".top-header h1")).toHaveText("Documents et contacts");
  const formsHeader = page.locator(".top-header-pdf");
  await expect(formsHeader).toBeVisible();
  await expect(formsHeader).toHaveCSS("position", "relative");
  expect(await formsHeader.evaluate((node) => getComputedStyle(node, "::before").backgroundImage)).toContain("forms-header-art-fast.webp");
  const formsHeaderBox = (await formsHeader.boundingBox())!;
  const resourceTabsBox = (await page.locator(".has-active-resource .useful-resource-tabs").boundingBox())!;
  expect(Math.abs(resourceTabsBox.width - formsHeaderBox.width)).toBeLessThanOrEqual(1);
  const formsScreenBox = (await page.locator(".useful-forms-screen").boundingBox())!;
  await expect(page.locator(".useful-forms-screen.useful-forms-root")).toHaveCSS("border-left-width", "6px");
  const resourcesScreenBox = (await page.locator(".useful-resources-screen").boundingBox())!;
  await expect(page.locator(".useful-forms-screen .useful-resource-search")).toHaveCount(0);
  const folderBoxes = await page.locator(".useful-form-folder").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  expect(folderBoxes.length).toBeGreaterThan(2);
  expect(folderBoxes[1].y).toBeGreaterThan(folderBoxes[0].y + folderBoxes[0].height);
  expect(Math.abs(folderBoxes[0].width - folderBoxes[1].width)).toBeLessThanOrEqual(1);
  expect(Math.abs(folderBoxes[3].width - folderBoxes[4].width)).toBeLessThanOrEqual(1);
  expect(Math.abs(folderBoxes[3].height - folderBoxes[4].height)).toBeLessThanOrEqual(1);
  expect(Math.abs(resourcesScreenBox.x - formsHeaderBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(resourcesScreenBox.width - formsHeaderBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(formsScreenBox.width - resourcesScreenBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(formsHeaderBox.height - homeHeaderBox.height)).toBeLessThan(0.5);
  expect(Math.abs(formsHeaderBox.width - homeHeaderBox.width)).toBeLessThan(0.5);
  expect(Math.abs(formsHeaderBox.height - ((page.viewportSize()?.width ?? 1000) <= 720 ? 215 : 235))).toBeLessThan(0.5);
  await expect(formsHeader.locator(".header-update-button")).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    expect(parseFloat(await formsHeader.locator("h1").evaluate((node) => getComputedStyle(node).fontSize))).toBeLessThanOrEqual(21);
  } else {
    const firstFolderBox = (await page.locator(".useful-form-folder").nth(0).boundingBox())!;
    const secondFolderBox = (await page.locator(".useful-form-folder").nth(1).boundingBox())!;
    expect(Math.abs(firstFolderBox.width - secondFolderBox.width)).toBeLessThanOrEqual(1);
    expect(firstFolderBox.width).toBeGreaterThan(200);
  }
  const folders = page.locator(".useful-form-folder-grid > button");
  await expect(folders).toHaveText([
    /Formulaire Expo.*Vide pour le moment/,
    /Formulaire SAP.*3 documents/,
    /Formulaire Brantôme.*7 documents/,
    /Horaires tickets resto.*Information pratique/,
    /Déclarer un accident de travail.*Accident de travail.*Procédure, contacts, documents et ajout au planning/,
  ]);
  const [ticketStyle, accidentStyle] = await Promise.all([
    folders.nth(3).evaluate((node) => ({ background: getComputedStyle(node).backgroundImage, legend: getComputedStyle(node.querySelector("em")!).fontSize })),
    folders.nth(4).evaluate((node) => ({ background: getComputedStyle(node).backgroundImage, legend: getComputedStyle(node.querySelector("em")!).fontSize })),
  ]);
  expect(accidentStyle).toEqual(ticketStyle);
  for (let index = 1; index < folderBoxes.length; index += 1)
    expect(folderBoxes[index].y).toBeGreaterThan(folderBoxes[index - 1].y + folderBoxes[index - 1].height);

  await folders.nth(0).click();
  await expect(page.getByRole("heading", { name: "Formulaire Expo" })).toBeVisible();
  await expect(page.locator(".useful-form-download-list")).toHaveCount(0);
  await expect(page.locator(".useful-forms-empty")).toContainText("Aucun formulaire pour le moment");
  await expect(page.locator(".useful-forms-folder-screen")).not.toContainText("Hilma Af Klint");
  const formsBackArea = page.getByRole("button", { name: "Revenir aux dossiers de formulaires" });
  const [formsBackBox, folderHeaderBox] = await Promise.all([
    formsBackArea.boundingBox(),
    page.locator(".useful-forms-folder-header").boundingBox(),
  ]);
  expect(formsBackBox).not.toBeNull();
  expect(folderHeaderBox).not.toBeNull();
  expect(Math.abs(formsBackBox!.width - folderHeaderBox!.width)).toBeLessThanOrEqual(1);
  const [formsArrowBox, formsTitleBox] = await Promise.all([
    formsBackArea.locator(".section-back-arrow").boundingBox(),
    page.getByRole("heading", { name: "Formulaire Expo" }).boundingBox(),
  ]);
  expect(formsArrowBox).not.toBeNull();
  expect(formsTitleBox).not.toBeNull();
  expect(formsArrowBox!.x + formsArrowBox!.width).toBeLessThanOrEqual(formsTitleBox!.x);
  await formsBackArea.click({ position: { x: formsBackBox!.width - 16, y: formsBackBox!.height / 2 } });

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
  await page.getByRole("button", { name: "Revenir aux dossiers de formulaires" }).click();
  await page.getByRole("button", { name: /Horaires tickets resto/ }).click();
  await expect(page.getByRole("heading", { name: "Horaires tickets resto" })).toBeVisible();
  await expect(page.locator(".useful-form-information-image img")).toHaveAttribute(
    "src",
    "/useful-forms/horaires-tickets-repas-fast.webp",
  );
  await expect(page.locator(".useful-form-download-list")).toHaveCount(0);
});

test("l’administrateur peut préparer un document et l’alerte invitée ouvre la bonne rubrique", async ({ page }) => {
  await prepareDemo(page);
  await openUsefulResource(page, "Formulaires");
  const adminPanel = page.locator(".useful-document-admin-panel");
  await expect(adminPanel.getByText("Ajouter un document")).toBeVisible();
  await adminPanel.locator("summary").click();
  await expect(adminPanel.getByLabel("Alerter tous les comptes invités")).not.toBeChecked();
  await expect(adminPanel.getByText("Affiche une fenêtre au centre de leur application et envoie aussi un e-mail.")).toBeVisible();
  await adminPanel.getByLabel("Titre du document").fill("Nouvelles consignes Expo");
  await adminPanel.getByLabel("Fichier PDF ou DOCX").setInputFiles("public/useful-forms/demande-conges.pdf");
  await adminPanel.getByLabel("Alerter tous les comptes invités").check();
  await adminPanel.getByRole("button", { name: "Ajouter le document" }).click();
  await expect(adminPanel.getByText("Document ajouté à la démo locale. Aucune alerte ni aucun e-mail n’a été envoyé.")).toBeVisible();
  await page.getByRole("button", { name: /Formulaire Expo/ }).click();
  await expect(page.getByText("Nouvelles consignes Expo")).toBeVisible();

  await page.goto("/?local-test=1&preview-feedback-role=user&demo-document-alert=1");
  const alert = page.getByRole("alertdialog", { name: "Consignes de la nouvelle exposition" });
  await expect(alert).toBeVisible();
  const box = await alert.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(8);
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(3);
  await alert.getByRole("button", { name: "Voir le document" }).click();
  await expect(page.getByRole("heading", { name: "Formulaires utiles" })).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test("l’administrateur peut afficher un message collectif sans envoyer d’e-mail", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" }).getByRole("button", { name: /Messagerie interne/ }).click();
  const broadcast = page.locator(".feedback-broadcast");
  await expect(broadcast.getByText("Popup dans l’application uniquement · aucun e-mail")).toBeVisible();
  await broadcast.locator("summary").click();
  await broadcast.getByLabel("Message collectif").fill("Le nouveau planning est disponible.");
  await broadcast.getByRole("button", { name: "Afficher le message à tous" }).click();
  await expect(broadcast.getByText("Aperçu local : le message n’a été envoyé à aucun compte.")).toBeVisible();

  await page.goto("/?local-test=1&preview-feedback-role=user&demo-feedback-broadcast=1");
  const popup = page.getByRole("alertdialog", { name: "Message de Mika" });
  await expect(popup).toContainText("Une information importante vient d’être publiée");
  const box = await popup.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(8);
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(3);
  await popup.getByRole("button", { name: "D’accord" }).click();
  await expect(popup).toHaveCount(0);
});

test("la déclaration d’accident réunit les démarches et marque le planning sans carence", async ({ page }, testInfo) => {
  const now = new Date();
  const rttWorkDate = Array.from({ length: 4 }, (_, index) => addDays(now, index + 3))
    .find((date) => getDayInfo(date, 2).kind === "work");
  if (!rttWorkDate) throw new Error("Aucun jour RTT ouvré trouvé dans la période d’accident");
  await page.addInitScript(({ rttKey }) => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    const annualTo = new Date(from);
    annualTo.setDate(annualTo.getDate() + 2);
    const key = (date: Date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: "e2e-leave-replaced-by-work-accident",
        requestKind: "leave",
        group: 2,
        periods: [
          { from: key(from), to: key(annualTo), type: "annual" },
          { from: rttKey, to: rttKey, type: "rtt" },
        ],
        timed: [],
      }),
    );
  }, { rttKey: dateKey(rttWorkDate) });
  await prepareDemo(page);
  await openUsefulResource(page, "Formulaires");

  const accidentButton = page.getByRole("button", { name: /Déclarer un accident de travail/ });
  await expect(accidentButton).toBeVisible();
  const formsRoot = page.locator(".useful-forms-root");
  await expect(formsRoot.getByRole("button", { name: /Déclarer un accident de travail/ })).toHaveCount(1);
  const [buttonBox, rootBox] = await Promise.all([
    accidentButton.boundingBox(),
    formsRoot.boundingBox(),
  ]);
  expect(buttonBox).not.toBeNull();
  expect(rootBox).not.toBeNull();
  expect(buttonBox!.x).toBeGreaterThan(rootBox!.x);
  expect(buttonBox!.width).toBeLessThan(rootBox!.width);
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(rootBox!.y + rootBox!.height);
  await accidentButton.click();

  await expect(page.getByRole("heading", { name: "Déclarer un accident de travail" })).toBeVisible();
  await expect(page.locator(".work-accident-header-symbol")).toHaveCount(0);
  const accidentBackArea = page.getByRole("button", { name: "Revenir aux formulaires utiles" });
  const [accidentBackBox, accidentHeaderBox] = await Promise.all([
    accidentBackArea.boundingBox(),
    page.locator(".work-accident-header").boundingBox(),
  ]);
  expect(accidentBackBox).not.toBeNull();
  expect(accidentHeaderBox).not.toBeNull();
  expect(Math.abs(accidentBackBox!.width - accidentHeaderBox!.width)).toBeLessThanOrEqual(1);
  await accidentBackArea.click({ position: { x: accidentBackBox!.width - 16, y: accidentBackBox!.height / 2 } });
  await page.getByRole("button", { name: /Déclarer un accident de travail/ }).click();
  await expect(page.getByText("Aucun jour de carence")).toBeVisible();
  const [documentsBox, urgentBox] = await Promise.all([
    page.locator(".work-accident-primary-documents").boundingBox(),
    page.locator(".work-accident-urgent").boundingBox(),
  ]);
  expect(documentsBox).not.toBeNull();
  expect(urgentBox).not.toBeNull();
  expect(documentsBox!.y + documentsBox!.height).toBeLessThanOrEqual(urgentBox!.y);
  await expect(page.locator(".work-accident-status button")).toHaveText(["Contractuel", "Fonctionnaire"]);
  await expect(page.getByRole("link", { name: /Prévenir les secouristes sur site ou à défaut les urgences/ })).toBeVisible();
  const contactCard = page.getByRole("link", { name: /Service médical de prévention/ });
  const [contactCopyBox, contactActionBox] = await Promise.all([
    contactCard.locator(":scope > span").boundingBox(),
    contactCard.locator(":scope > b").boundingBox(),
  ]);
  expect(contactCopyBox).not.toBeNull();
  expect(contactActionBox).not.toBeNull();
  expect(contactActionBox!.y).toBeGreaterThanOrEqual(contactCopyBox!.y + contactCopyBox!.height);
  expect(await page.locator(".work-accident-contacts a").evaluateAll((cards) => cards.every((card) => card.scrollWidth <= card.clientWidth + 1))).toBe(true);
  await page.getByRole("button", { name: "Fonctionnaire", exact: true }).click();
  await expect(page.getByText(/CITIS.*congé pour invalidité temporaire imputable au service/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /PC Sécurité · bâtiment central/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /réserves Paris-Nord/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Service médical de prévention/ })).toHaveAttribute(
    "href",
    "mailto:servicemedical@centrepompidou.fr",
  );
  await page.getByRole("button", { name: "Contractuel", exact: true }).click();
  await expect(page.getByText(/feuille de prise en charge disponible dans l’application/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Déclaration d’accident de travail ou de trajet/ })).toHaveAttribute(
    "href",
    "/useful-forms/declaration-accident-contractuel.pdf",
  );

  const today = new Date();
  const todayKey = dateKey(today);
  const periodEnd = new Date(today);
  periodEnd.setDate(periodEnd.getDate() + 6);
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".work-accident-date-input > span")).toHaveText(["jj/mm/aaaa", "jj/mm/aaaa"]);
    await expect(page.locator(".work-accident-date-input > span").first()).toBeVisible();
  }
  await page.getByLabel("Date de l’accident ou premier jour").fill(todayKey);
  await page.getByLabel("Dernier jour concerné").fill(dateKey(periodEnd));
  await page.getByRole("button", { name: "Marquer ces dates dans le planning" }).click();
  await expect(page.getByText(/congés annuels remplacés ont été recrédités/i)).toBeVisible();
  await expect(page.getByText(/Périodes enregistrées/)).toBeVisible();

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Accueil/ })
    .click();
  await page.getByRole("button", { name: "Aujourd’hui" }).click();
  const todayCell = page.getByRole("button", { name: new RegExp(longDate(today), "i") });
  const workAccidentMarker = todayCell.locator(".work-accident-calendar-marker");
  await expect(workAccidentMarker).toBeVisible();
  await expect(todayCell).toHaveAttribute("aria-label", /accident de travail/);
  await expect(todayCell).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
  if (testInfo.project.name === "mobile") {
    await expect(workAccidentMarker).toHaveCSS("right", "-8px");
    await expect(workAccidentMarker).toHaveCSS("bottom", "-2px");
    const [todayCellBox, workAccidentMarkerBox] = await Promise.all([
      todayCell.boundingBox(),
      workAccidentMarker.boundingBox(),
    ]);
    expect(todayCellBox).not.toBeNull();
    expect(workAccidentMarkerBox).not.toBeNull();
    expect(todayCellBox!.x + todayCellBox!.width - (workAccidentMarkerBox!.x + workAccidentMarkerBox!.width)).toBeLessThanOrEqual(3);
    expect(todayCellBox!.y + todayCellBox!.height - (workAccidentMarkerBox!.y + workAccidentMarkerBox!.height)).toBeLessThanOrEqual(3);
  } else {
    await expect(workAccidentMarker).toHaveCSS("right", "-12px");
    await expect(workAccidentMarker).toHaveCSS("bottom", "-3px");
  }

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  const workAccidentBalance = page.getByRole("button", { name: /Afficher le détail de Accident de travail/ });
  await expect(workAccidentBalance).toBeVisible();
  await expect(workAccidentBalance).toContainText(/sans carence · CA superposés recrédités/);
  await expect(page.getByRole("button", { name: /Afficher le détail de Congés annuels/ })).toContainText(/0 déjà pris/);
  await expect(page.getByRole("button", { name: /Afficher le détail de RTT/ })).toContainText(/1 à venir/);
  const strikeBalance = page.getByRole("button", { name: /Afficher le détail de Grève/ });
  const balancesGrid = page.locator(".leave-balances-direct .leave-balance-grid");
  await page.evaluate(() => document.fonts.ready);
  const [workAccidentBox, strikeBox, balancesGridBox] = await Promise.all([
    workAccidentBalance.boundingBox(),
    strikeBalance.boundingBox(),
    balancesGrid.boundingBox(),
  ]);
  expect(workAccidentBox).not.toBeNull();
  expect(strikeBox).not.toBeNull();
  expect(balancesGridBox).not.toBeNull();
  if (testInfo.project.name === "mobile") {
    expect(Math.abs(workAccidentBox!.y - strikeBox!.y)).toBeLessThanOrEqual(1);
    expect(workAccidentBox!.x).toBeGreaterThan(strikeBox!.x);
  } else {
    expect(Math.abs(workAccidentBox!.x - balancesGridBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(workAccidentBox!.width - balancesGridBox!.width)).toBeLessThanOrEqual(1);
  }
});

test("Z Fold ouvert : la déclaration d’accident reste lisible sans débordement", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "z-fold", "Scénario réservé au viewport Z Fold ouvert");
  await prepareDemo(page);
  await openUsefulResource(page, "Formulaires");
  await page.getByRole("button", { name: /Déclarer un accident de travail/ }).click();
  await expect(page.locator(".work-accident-screen")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(900);
  const statusButtons = page.locator(".work-accident-status button");
  await expect(statusButtons).toHaveCount(2);
  const boxes = await statusButtons.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThanOrEqual(1);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  const balanceGrid = page.locator(".leave-balances-direct .leave-balance-grid");
  const workAccidentBalance = page.getByRole("button", { name: /Afficher le détail de Accident de travail/ });
  const [balanceGridBox, workAccidentBox] = await Promise.all([
    balanceGrid.boundingBox(),
    workAccidentBalance.boundingBox(),
  ]);
  expect(balanceGridBox).not.toBeNull();
  expect(workAccidentBox).not.toBeNull();
  expect(Math.abs(workAccidentBox!.x - balanceGridBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(workAccidentBox!.width - balanceGridBox!.width)).toBeLessThanOrEqual(1);
});

test("la programmation GP suit l’ordre demandé et sépare les autres espaces", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-28T12:00:00"));
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Programmation GP/ })
    .click();

  await expect(page.locator(".top-header h1")).toHaveText("Programmation GP");
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".mobile-bottom-navigation")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ouvrir le menu principal" })).toBeVisible();
  }
  const [programHeaderBox, programScreenBox] = await Promise.all([
    page.locator(".top-header-program").boundingBox(),
    page.locator(".grand-palais-program-screen").boundingBox(),
  ]);
  expect(programHeaderBox).not.toBeNull();
  expect(programScreenBox).not.toBeNull();
  expect(Math.abs(programHeaderBox!.x - programScreenBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(programHeaderBox!.width - programScreenBox!.width)).toBeLessThanOrEqual(1);
  const programHeaderImage = await page.locator(".top-header-program").evaluate((node) =>
    getComputedStyle(node, "::before").backgroundImage,
  );
  expect(programHeaderImage).toContain("grand-palais-verriere-fast.webp");
  const programPanelBorders = await page.locator(".grand-palais-program-panel").evaluate((node) => {
    const style = getComputedStyle(node);
    return { left: style.borderLeftWidth, top: style.borderTopWidth };
  });
  expect(programPanelBorders.left).toBe(programPanelBorders.top);
  await expect(page.locator(".grand-palais-program-intro")).toHaveCSS("border-left-width", "8px");
  await expect(page.getByRole("tab", { name: "En ce moment" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "À venir" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Inter-expos" })).toBeVisible();
  const overviewVenueColors = await page.locator(".grand-palais-program-panel article[data-venue]").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
  expect(new Set(overviewVenueColors).size).toBeGreaterThan(1);
  await page.getByRole("tab", { name: "Par espace" }).click();
  await expect(page.locator(".grand-palais-venue-navigation")).toHaveCSS("border-left-width", "8px");
  await expect(page.getByText("Expos en cours et à venir", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Programmation prévisionnelle/)).toHaveCount(0);
  await expect(page.locator(".grand-palais-program-panel .useful-expo-timeline-mark").first()).toBeHidden();
  const choices = page.locator(".grand-palais-primary-picker > button");
  await expect(choices).toHaveText([
    /Galeries 3 et 4.*Voir la programmation/,
    /Galerie 8.*Voir la programmation/,
    /Galerie 7.*Voir la programmation/,
    /Palais des enfants.*Voir la programmation/,
    /Autres.*Nef et autres galeries RMN/,
  ]);
  const choiceBoxes = await choices.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().toJSON()),
  );
  const expectedColumns = (page.viewportSize()?.width ?? 1000) <= 720 ? 2 : 3;
  expect(new Set(choiceBoxes.slice(0, expectedColumns).map((box) => Math.round(box.y))).size).toBe(1);
  expect(choiceBoxes[expectedColumns].y).toBeGreaterThan(choiceBoxes[0].y + choiceBoxes[0].height);
  await expect(page.locator(".useful-expo-timeline article").first()).toContainText("Prochainement");

  await page.getByRole("tab", { name: /Galerie 8/ }).click();
  await expect(page.locator('.useful-expo-timeline article[data-status="En cours"]')).toHaveCount(1);
  const gallery8CardColors = await page.locator(".useful-expo-timeline article").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return `${style.backgroundColor}|${style.borderTopColor}|${style.borderLeftColor}`;
  }));
  expect(new Set(gallery8CardColors).size).toBe(1);
  const gallery8StatusBackgrounds = await page.locator(".useful-expo-timeline article > em").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
  expect(new Set(gallery8StatusBackgrounds).size).toBe(1);
  const exhibitionBorder = await page.locator('.useful-expo-timeline article[data-status="En cours"]').evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      top: style.borderTopWidth,
      right: style.borderRightWidth,
      bottom: style.borderBottomWidth,
      left: style.borderLeftWidth,
      background: style.backgroundColor,
    };
  });
  expect([exhibitionBorder.top, exhibitionBorder.right, exhibitionBorder.bottom]).toEqual(["1px", "1px", "1px"]);
  expect(exhibitionBorder.left).toBe("5px");
  expect(exhibitionBorder.background).toBe("rgb(233, 221, 247)");
  await expect(page.locator('.useful-expo-timeline article[data-status="En cours"]')).toContainText("Hilma af Klint");
  const officialLink = page.getByRole("link", { name: "Voir sur le site du Grand Palais" }).first();
  await expect(officialLink).toHaveCSS("border-top-style", "none");
  await expect(officialLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(officialLink).toHaveCSS("text-decoration-line", "underline");
  await expect(page.locator('.useful-expo-timeline article[data-status="En cours"] > em')).toHaveText("En cours");
  await expect(page.locator(".useful-expo-timeline")).toContainText("Girls - Adolescence, mode et rébellion");
  await expect(page.locator(".useful-expo-timeline")).not.toContainText("Programmé");
  await page.getByRole("tab", { name: /Galerie 7/ }).click();
  await expect(page.locator(".useful-expo-timeline")).toContainText("Le Musée Imaginaire d’Oli");
  await page.getByRole("tab", { name: /Palais des enfants/ }).click();
  await expect(page.locator(".useful-expo-timeline")).toContainText("Transparence");

  await page.getByRole("tab", { name: /Autres/ }).click();
  await expect(page.getByRole("tab", { name: "Nef", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Galeries 9 et 10", exact: true })).toBeVisible();
  const otherPicker = page.locator(".grand-palais-other-picker");
  if ((page.viewportSize()?.width ?? 1000) <= 700) {
    await otherPicker.evaluate((picker) => {
      while (picker.querySelectorAll("button").length < 5) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.qaVenue = "true";
        button.textContent = `Lieu test ${picker.querySelectorAll("button").length + 1}`;
        picker.append(button);
      }
    });
  }
  const otherChoiceBoxes = await otherPicker.locator("button").evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().toJSON()),
  );
  if ((page.viewportSize()?.width ?? 1000) <= 700) {
    expect(Math.round(otherChoiceBoxes[0].y)).toBe(Math.round(otherChoiceBoxes[1].y));
    expect(Math.round(otherChoiceBoxes[2].y)).toBe(Math.round(otherChoiceBoxes[3].y));
    expect(otherChoiceBoxes[4].width).toBeGreaterThan(otherChoiceBoxes[0].width * 1.8);
    expect(Math.abs(otherChoiceBoxes[0].height - otherChoiceBoxes[3].height)).toBeLessThanOrEqual(1);
    await otherPicker.locator('[data-qa-venue="true"]').evaluateAll((buttons) => buttons.forEach((button) => button.remove()));
  } else {
    const firstRowSize = otherChoiceBoxes.length === 4 || otherChoiceBoxes.length < 3 ? 2 : 3;
    expect(new Set(otherChoiceBoxes.slice(0, firstRowSize).map((box) => Math.round(box.y))).size).toBe(1);
    if (otherChoiceBoxes.length === 5) expect(Math.round(otherChoiceBoxes[3].y)).toBe(Math.round(otherChoiceBoxes[4].y));
  }
  await expect(page.getByRole("tab", { name: "Nef", exact: true })).toHaveCSS("border-top-color", "rgb(57, 121, 184)");
  await expect(page.locator(".useful-expo-timeline article")).toHaveCount(8);
  await expect(page.locator(".useful-expo-timeline")).not.toContainText("Grand Palais d’été");
  await page.getByRole("tab", { name: "2028", exact: true }).click();
  await expect(page.locator(".useful-expo-timeline")).toContainText("Art Basel Paris");
  await expect(page.locator(".useful-expo-timeline")).not.toContainText(/montage/i);
  await page.getByRole("tab", { name: "2029", exact: true }).click();
  await expect(page.locator(".useful-expo-timeline")).toContainText("Du 17 au 21 octobre 2029");

  await page.getByRole("tab", { name: "Galeries 9 et 10", exact: true }).click();
  await expect(page.locator(".useful-expo-timeline")).toContainText("Leandro Erlich");
  await expect(page.locator(".useful-expo-timeline")).toContainText("Mika Ninagawa");
  await page.getByRole("tab", { name: "2029", exact: true }).click();
  await expect(page.locator(".useful-expo-timeline")).toContainText("Peter Doig");

  await page.getByRole("tab", { name: "Inter-expos" }).click();
  await expect(page.getByRole("heading", { name: "Périodes d’inter expos" })).toBeVisible();
  await expect(page.locator(".grand-palais-interexpo-panel")).toContainText("À la date d’aujourd’hui");
  const firstInterexpo = page.locator(".grand-palais-interexpo-list article").first();
  await expect(firstInterexpo).toContainText("Du 31 août 2026 au 22 septembre 2026");
  await expect(firstInterexpo).toContainText("23 jours");
  const firstInterexpoStatus = await firstInterexpo.getAttribute("data-status");
  expect(["En cours", "À venir"]).toContain(firstInterexpoStatus);
  await expect(firstInterexpo.locator("em")).toHaveText(firstInterexpoStatus!);
  await expect(page.getByLabel("Rechercher une exposition")).toHaveCount(0);
  await expect(page.locator(".grand-palais-interexpo-list")).not.toContainText("Galerie");
  await expect(page.locator(".grand-palais-interexpo-list")).not.toContainText("Nef");
});

test("le tampon de fermeture conserve la date lisible sur ordinateur et téléphone", async ({ page }) => {
  await prepareDemo(page);
  await page.getByRole("button", { name: "Sélectionner le mois" }).click();
  await page.getByRole("option", { name: "septembre", exact: true }).click();

  const markers = page.locator(".month-card .exceptional-closure-marker");
  await expect(markers).toHaveCount(3);
  await expect(markers.first()).toHaveAttribute("src", "/exceptional-closure-icon.webp");
  const firstClosedDay = page.getByRole("button", { name: /mercredi 9 septembre 2026.*Fermeture exceptionnelle du Grand Palais/i });
  await expect(firstClosedDay).toBeVisible();
  const visibleDate = firstClosedDay.locator(".exceptional-closure-date");
  await expect(visibleDate).toHaveText("9");
  await expect(visibleDate).toBeVisible();
  await expect(visibleDate).toHaveCSS("border-top-style", "none");
  await expect(visibleDate).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByRole("button", { name: /jeudi 10 septembre 2026.*Fermeture exceptionnelle du Grand Palais/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /samedi 26 septembre 2026.*Fermeture exceptionnelle du Grand Palais/i })).toBeVisible();
  const [dayBox, markerBox] = await Promise.all([firstClosedDay.boundingBox(), markers.first().boundingBox()]);
  expect(dayBox).not.toBeNull();
  expect(markerBox).not.toBeNull();
  expect(Math.abs(dayBox!.width - markerBox!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(dayBox!.height - markerBox!.height)).toBeLessThanOrEqual(2);
});

test("les vacances scolaires restent facultatives et respectent la zone choisie", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("planning:school-vacations-v1", "1");
    localStorage.setItem("planning:school-zone-v1", "C");
  });
  await prepareDemo(page);
  const vacationSwitch = page.getByRole("switch", { name: /Vacances scolaires/ });
  await expect(vacationSwitch).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Zone C" })).toHaveAttribute("aria-pressed", "true");
  const [toolbarBox, settingsBox] = await Promise.all([
    page.locator(".calendar-toolbar.month-toolbar").boundingBox(),
    page.locator(".school-vacation-settings").boundingBox(),
  ]);
  expect(toolbarBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  expect(settingsBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y + toolbarBox!.height);
  await page.getByRole("button", { name: "Sélectionner le mois" }).click();
  await page.getByRole("option", { name: "octobre", exact: true }).click();
  await expect(page.locator(".school-vacation-month-summary")).toContainText("Vacances de la Toussaint");
  await expect(page.locator(".month-card .school-vacation-day")).toHaveCount(15);
  const vacationDay = page.getByRole("button", { name: /mardi 20 octobre 2026.*vacances scolaires/i });
  await vacationDay.click();
  await page
    .getByRole("dialog", { name: /mardi 20 octobre 2026/i })
    .getByRole("button", { name: /Fermeture exceptionnelle.*Ajouter CLOSED/i })
    .click();
  const closedVacationDay = page.getByRole("button", {
    name: /mardi 20 octobre 2026.*Fermeture exceptionnelle ajoutée manuellement.*vacances scolaires/i,
  });
  const [closedDayBox, closedMarkerBox] = await Promise.all([
    closedVacationDay.boundingBox(),
    closedVacationDay.locator(".exceptional-closure-marker").boundingBox(),
  ]);
  expect(closedDayBox).not.toBeNull();
  expect(closedMarkerBox).not.toBeNull();
  expect(closedMarkerBox!.width).toBeLessThan(closedDayBox!.width - 5);
  await page.getByRole("button", { name: "Zone A" }).click();
  await expect(page.getByRole("button", { name: "Zone A" })).toHaveAttribute("aria-pressed", "true");
  await vacationSwitch.click();
  await expect(page.locator(".school-vacation-month-summary")).toHaveCount(0);
  await expect(page.locator(".month-card .school-vacation-day")).toHaveCount(0);
});

test("les sigles de congé restent lisibles à côté de l’encadré d’Agnès sur écran fermé", async ({ page }) => {
  await prepareDemo(page);
  await page.setViewportSize({ width: 344, height: 900 });
  const day = page.locator(".month-card .day").first();
  await day.evaluate((node) => {
    node.classList.add("agnes-leave-day", "leave-day", "leave-annual");
    node.querySelector(".date-number, .holiday-date")?.classList.add("agnes-leave-date");
    const marker = document.createElement("span");
    marker.className = "leave-calendar-marker leave-calendar-marker-annual";
    marker.textContent = "CA";
    node.append(marker);
  });
  const marker = day.locator(".leave-calendar-marker-annual");
  const date = day.locator(".agnes-leave-date");
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS("font-size", "8px");
  const [markerBox, dateBox, dayBox] = await Promise.all([marker.boundingBox(), date.boundingBox(), day.boundingBox()]);
  expect(markerBox).not.toBeNull();
  expect(dateBox).not.toBeNull();
  expect(dayBox).not.toBeNull();
  expect(markerBox!.y).toBeGreaterThanOrEqual(dateBox!.y + dateBox!.height);
  const closedRightGap = dayBox!.x + dayBox!.width - markerBox!.x - markerBox!.width;
  const closedBottomGap = dayBox!.y + dayBox!.height - markerBox!.y - markerBox!.height;
  expect(closedRightGap).toBeGreaterThanOrEqual(3);
  expect(closedRightGap).toBeLessThanOrEqual(5);
  expect(closedBottomGap).toBeGreaterThanOrEqual(1);
  expect(closedBottomGap).toBeLessThanOrEqual(3);

  await page.setViewportSize({ width: 900, height: 1000 });
  const [wideMarkerBox, wideDayBox] = await Promise.all([marker.boundingBox(), day.boundingBox()]);
  expect(wideMarkerBox).not.toBeNull();
  expect(wideDayBox).not.toBeNull();
  expect(wideDayBox!.x + wideDayBox!.width - wideMarkerBox!.x - wideMarkerBox!.width).toBeGreaterThanOrEqual(4);
  expect(wideDayBox!.y + wideDayBox!.height - wideMarkerBox!.y - wideMarkerBox!.height).toBeGreaterThanOrEqual(4);
});

test("une fermeture exceptionnelle peut être ajoutée puis retirée manuellement", async ({ page }) => {
  await prepareDemo(page);
  await page.getByRole("button", { name: "Sélectionner le mois" }).click();
  await page.getByRole("option", { name: "septembre", exact: true }).click();

  const day = page.getByRole("button", { name: /vendredi 11 septembre 2026/i });
  await day.click();
  const dialog = page.getByRole("dialog", { name: /vendredi 11 septembre 2026/i });
  await dialog.getByRole("button", { name: /Fermeture exceptionnelle.*Ajouter CLOSED/i }).click();

  const manuallyClosed = page.getByRole("button", {
    name: /vendredi 11 septembre 2026.*Fermeture exceptionnelle ajoutée manuellement/i,
  });
  await expect(manuallyClosed.locator(".exceptional-closure-marker")).toBeVisible();
  await expect(manuallyClosed.locator(".exceptional-closure-date")).toHaveText("11");

  await manuallyClosed.click();
  await page
    .getByRole("dialog", { name: /vendredi 11 septembre 2026/i })
    .getByRole("button", { name: /Fermeture exceptionnelle.*Retirer CLOSED/i })
    .click();
  await expect(day.locator(".exceptional-closure-marker")).toHaveCount(0);
});

test("le compte administrateur peut valider seul une mise à jour du Grand Palais", async ({ page }) => {
  const event = {
    id: "event-salon",
    title: "Exposition du Salon",
    startDate: "2027-02-01",
    endDate: "2027-05-01",
    url: "https://www.grandpalais.fr/fr/programme/exposition-salon",
    venueKey: "other:salon-honneur",
    venueLabel: "Salon d’honneur",
  };
  let accepted = false;
  await page.route("**/api/gp-program", async (route) => {
    if (route.request().method() === "POST") accepted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        approved: accepted ? [event] : [],
        pending: accepted ? [] : [{
          id: "proposal-salon",
          kind: "new",
          detectedAt: "2026-08-28T06:00:00.000Z",
          next: event,
        }],
        isAdmin: true,
        lastCheckedAt: "2026-08-28T06:00:00.000Z",
      }),
    });
  });
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Programmation GP/ })
    .click();
  await expect(page.getByRole("heading", { name: "Mises à jour détectées" })).toBeVisible();
  await expect(page.locator(".grand-palais-admin-alerts")).toContainText("Exposition du Salon");
  await page.getByRole("button", { name: "Accepter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mises à jour détectées" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Par espace" }).click();
  await page.getByRole("tab", { name: /Autres/ }).click();
  await expect(page.getByRole("tab", { name: "Salon d’honneur", exact: true })).toBeVisible();
});

test("les contacts utiles sont classés et directement appelables", async ({ page }) => {
  await prepareDemo(page);
  await openUsefulResource(page, "Contacts");

  const contactHeader = page.locator(".top-header");
  const resourcesScreen = page.locator(".useful-resources-screen");
  const contactsRoot = page.locator(".useful-contacts-screen.useful-contacts-root");
  await expect(contactsRoot).toBeVisible();
  await expect(contactsRoot.locator(".useful-resource-search")).toHaveCount(0);
  await expect(contactsRoot).toHaveCSS("border-left-width", "6px");
  await expect(contactsRoot.locator(".useful-contact-directory-grid > button i")).toHaveCount(0);
  const [contactHeaderBox, resourcesScreenBox, contactsRootBox] = await Promise.all([
    contactHeader.boundingBox(),
    resourcesScreen.boundingBox(),
    contactsRoot.boundingBox(),
  ]);
  expect(Math.abs(resourcesScreenBox!.x - contactHeaderBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(resourcesScreenBox!.width - contactHeaderBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(contactsRootBox!.width - resourcesScreenBox!.width)).toBeLessThanOrEqual(1);
  if ((page.viewportSize()?.width ?? 1000) > 900) {
    const [introBox, directoryBox] = await Promise.all([
      contactsRoot.locator(":scope > .native-screen-heading").boundingBox(),
      contactsRoot.locator(":scope > .useful-contact-directory-grid").boundingBox(),
    ]);
    expect(introBox).not.toBeNull();
    expect(directoryBox).not.toBeNull();
    expect(introBox!.x + introBox!.width).toBeLessThan(directoryBox!.x);
  }
  await expect(contactHeader.locator("h1")).toHaveText("Documents et contacts");
  await expect(contactHeader).toHaveClass(/top-header-pdf/);
  expect(await contactHeader.evaluate((node) => getComputedStyle(node, "::before").backgroundImage)).toContain("forms-header-art-fast.webp");
  await page.getByRole("button", { name: /Contacts Pompidou/ }).click();
  await expect(page.getByRole("heading", { name: "Contacts Pompidou" })).toBeVisible();
  await expect(page.locator(".useful-contacts-screen.useful-contacts-root")).toHaveCount(0);
  const categoryButtons = page.locator(".useful-contact-category-grid > button");
  await expect(categoryButtons).toHaveCount(6);
  const categoryColors = await categoryButtons.evaluateAll((buttons) => buttons.map((button) => ({
    background: getComputedStyle(button).backgroundImage,
    border: getComputedStyle(button).borderLeftColor,
  })));
  expect(new Set(categoryColors.map((color) => color.background)).size).toBeGreaterThanOrEqual(4);
  expect(new Set(categoryColors.map((color) => color.border)).size).toBe(6);
  await page.getByRole("button", { name: /^RAS/ }).click();
  await expect(page.locator(".useful-contact-card")).toHaveCount(10);
  await expect(page.getByText("Maarten Averink")).toBeVisible();
  const rasGroupMail = page.getByRole("link", { name: "Envoyer un e-mail à toute l’équipe des RAS" });
  await expect(rasGroupMail).toBeVisible();
  const rasGroupMailHref = await rasGroupMail.getAttribute("href");
  expect(rasGroupMailHref?.startsWith("mailto:")).toBe(true);
  expect(rasGroupMailHref?.slice("mailto:".length).split(",")).toHaveLength(10);
  expect(rasGroupMailHref).toContain("maarten.averink@centrepompidou.fr");
  await expect(page.getByRole("link", { name: /^Appeler.*06 21 68 83 08/i })).toHaveAttribute(
    "href",
    "tel:+33621688308",
  );
  await expect(page.getByRole("link", { name: /SMS.*06 21 68 83 08/i })).toHaveAttribute(
    "href",
    "sms:+33621688308",
  );
  await expect(page.getByRole("link", { name: /Écrire à Maarten Averink avec l.application de messagerie/i })).toHaveAttribute(
    "href",
    "mailto:maarten.averink@centrepompidou.fr",
  );
  await expect(page.getByRole("link", { name: /^Appeler Alice Toumine/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Envoyer un SMS à Alice Toumine/i })).toHaveAttribute(
    "href",
    "sms:+33763731643",
  );

  const contactsBackArea = page.getByRole("button", { name: "Revenir aux contacts Pompidou" });
  const [contactsBackBox, contactsHeaderBox] = await Promise.all([
    contactsBackArea.boundingBox(),
    page.locator(".useful-contacts-subheader").boundingBox(),
  ]);
  expect(contactsBackBox).not.toBeNull();
  expect(contactsHeaderBox).not.toBeNull();
  expect(Math.abs(contactsBackBox!.width - contactsHeaderBox!.width)).toBeLessThanOrEqual(2);
  await contactsBackArea.click({ position: { x: contactsBackBox!.width - 16, y: contactsBackBox!.height / 2 } });
  await page.getByRole("button", { name: /Bureau administratif/ }).click();
  await expect(page.getByRole("link", { name: /Écrire à Mail générique Aurélia, Esther et Agnès/i })).toHaveAttribute(
    "href",
    "mailto:absenceSAP@gmail.com",
  );
  await expect(page.locator(".useful-contact-list .useful-contact-card").last()).toContainText(
    "Mail générique Aurélia, Esther et Agnès",
  );
  await expect(page.getByRole("link", { name: /^Appeler John Lorenc au 01 44 78 49 19/i })).toHaveAttribute(
    "href",
    "tel:+33144784919",
  );
  await expect(page.locator('a[href="sms:+33144784919"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Revenir aux contacts Pompidou" }).click();
  await page.getByRole("button", { name: /Tickets restaurants/ }).click();
  await expect(page.getByRole("link", { name: /^Appeler Tickets restaurants au 01 44 78 41 48/i })).toHaveAttribute(
    "href",
    "tel:+33144784148",
  );
  await page.getByRole("button", { name: "Revenir aux contacts Pompidou" }).click();
  await page.getByRole("button", { name: /Ressources humaines/ }).click();
  await expect(page.getByRole("link", { name: /Écrire à Adresse générique avec l.application de messagerie/i })).toHaveAttribute(
    "href",
    "mailto:administration.RH@centrepompidou.fr",
  );
  await page.getByRole("button", { name: "Revenir aux contacts Pompidou" }).click();
  await page.getByRole("button", { name: "Revenir aux contacts utiles" }).click();
  await page.getByRole("button", { name: /Contact GP‑RMN/ }).click();
  await expect(page.getByText("Accident · secourisme")).toBeVisible();
  await expect(page.getByText("Superviseur Expo")).toBeVisible();
});

test("un échange exige et modifie toujours ses deux journées ensemble", async ({ page }) => {
  const now = new Date();
  const dates = Array.from(
    { length: monthDays(now.getFullYear(), now.getMonth()) },
    (_, index) => localDate(now.getFullYear(), now.getMonth(), index + 1),
  );
  const returned = dates.find((date) =>
    getDayInfo(date, 2).kind === "off" && getDayInfo(date, 1).kind === "work");
  const agreement = dates.find((date) => returned && date > returned &&
    getDayInfo(date, 2).kind === "work" && getDayInfo(date, 1).kind === "off");
  if (!agreement || !returned) throw new Error("Aucun échange complet trouvé dans le mois de test");

  await prepareDemo(page);
  await page.getByRole("button", { name: "Faire un échange" }).click();
  await page.getByPlaceholder("Prénom et/ou nom").fill("Camille");
  await page.getByRole("button", { name: "Valider les deux dates" }).click();
  await expect(page.getByRole("alert")).toContainText("deux dates");
  await page.getByRole("button", { name: "Choisir la journée de votre cycle" }).click();
  const myCycle = page.getByRole("region", { name: "Cycle de travail du groupe 2" });
  await expect(myCycle.getByLabel("Légende du groupe 2")).toContainText("TravailReposFormation");
  expect(await myCycle.locator(".exchange-cycle-day.selectable").count()).toBeGreaterThan(0);
  await expect(myCycle.locator(".exchange-cycle-day.off").first()).toHaveCSS("background-color", "rgb(23, 34, 49)");
  const trainingDays = myCycle.locator(".exchange-cycle-day.training");
  if (await trainingDays.count())
    await expect(trainingDays.first()).toHaveCSS("background-color", "rgb(184, 189, 196)");
  expect(await myCycle.locator(".exchange-cycle-unavailable").count()).toBeGreaterThan(0);
  await expect(myCycle.locator(".exchange-cycle-day.off .exchange-cycle-unavailable")).toHaveCount(0);
  await expect(myCycle.locator(".exchange-cycle-day.training .exchange-cycle-unavailable")).toHaveCount(0);
  await expect(myCycle.locator(".exchange-cycle-day.incompatible .exchange-cycle-unavailable").first()).toHaveCSS("inset", "0px");
  await myCycle.locator(`[data-date="${dateKey(agreement)}"]`).click();
  await page.getByRole("button", { name: "Choisir la journée du cycle du collègue" }).click();
  const partnerCycle = page.getByRole("region", { name: "Cycle de travail du groupe 1" });
  await expect(partnerCycle.getByLabel("Légende du groupe 1")).toContainText("TravailReposFormation");
  await partnerCycle.locator(`[data-date="${dateKey(returned)}"]`).click();
  await page.getByRole("button", { name: "Valider les deux dates" }).click();

  await expect(page.locator(".day.exchange-given")).toHaveCount(1);
  await expect(page.locator(".day.exchange-return")).toHaveCount(1);
  await expect(page.locator(".day.exchange-given")).toHaveCSS("border-top-color", "rgb(17, 24, 32)");
  await expect(page.locator(".day.exchange-given .exchange-calendar-marker")).toHaveAttribute("src", "/exchange-arrows.png");
  await expect(page.locator(".day.exchange-given .exchange-calendar-label")).toHaveText("OFF");
  await expect(page.locator(".day.exchange-return .exchange-calendar-label")).toHaveText("TRAVAIL");
  await page.setViewportSize({ width: 344, height: 900 });
  const narrowExchangeCell = page.locator(".day.exchange-return");
  const [narrowCellBox, narrowDateBox, narrowLabelBox, narrowMarkerBox] = await Promise.all([
    narrowExchangeCell.boundingBox(),
    narrowExchangeCell.locator(".date-number, .holiday-date").boundingBox(),
    narrowExchangeCell.locator(".exchange-calendar-label").boundingBox(),
    narrowExchangeCell.locator(".exchange-calendar-marker").boundingBox(),
  ]);
  expect(narrowCellBox).not.toBeNull();
  expect(narrowDateBox).not.toBeNull();
  expect(narrowLabelBox).not.toBeNull();
  expect(narrowMarkerBox).not.toBeNull();
  expect(narrowMarkerBox!.width).toBeGreaterThanOrEqual(20);
  await expect(narrowExchangeCell.locator(".exchange-calendar-marker")).toHaveCSS("border-top-width", "0px");
  await expect(narrowExchangeCell.locator(".exchange-calendar-marker")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(narrowCellBox!.x + narrowCellBox!.width - (narrowMarkerBox!.x + narrowMarkerBox!.width)).toBeLessThanOrEqual(3);
  expect(narrowMarkerBox!.y - narrowCellBox!.y).toBeLessThanOrEqual(3);
  expect(narrowCellBox!.y + narrowCellBox!.height - (narrowLabelBox!.y + narrowLabelBox!.height)).toBeLessThanOrEqual(4);
  expect(Math.abs((narrowDateBox!.y + narrowDateBox!.height / 2) - (narrowCellBox!.y + narrowCellBox!.height / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs((narrowDateBox!.x + narrowDateBox!.width / 2) - (narrowCellBox!.x + narrowCellBox!.width / 2))).toBeLessThanOrEqual(1);
  expect(narrowLabelBox!.x + narrowLabelBox!.width).toBeLessThanOrEqual(narrowCellBox!.x + narrowCellBox!.width - 2);
  await expect(page.getByRole("heading", { name: "Mes échanges" })).toBeVisible();
  await expect(page.getByText(/Camille - Groupe 1/).first()).toBeVisible();
  await expect(page.locator(".work-exchange-list article span")).toHaveText([
    `Vous la remplacez le ${longDate(returned)}`,
    `Camille vous remplace le ${longDate(agreement)}`,
  ]);

  await page.locator(".day.exchange-given").click();
  await expect(page.getByText("Échange avec Camille - Groupe 1")).toBeVisible();
  await expect(page.getByText(new RegExp(`Camille vous remplace ce jour, vous la remplacez le ${longDate(returned)}`))).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
  await page.locator(".day.exchange-return").click();
  await expect(page.getByText(new RegExp(`Vous la remplacez ce jour, Camille vous remplace le ${longDate(agreement)}`))).toBeVisible();
  await page.getByRole("button", { name: "Modifier ou supprimer l’échange" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer l’échange" }).click();
  await expect(page.locator(".day.exchange-day")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mes échanges" })).toHaveCount(0);
});

test("l’en-tête, le sélecteur d’affichage et les années sont confortables", async ({ page }, testInfo) => {
  await prepareDemo(page);
  const header = page.locator(".top-header");
  const switcher = page.getByLabel("Mode d’affichage");
  const update = page.locator(".top-header .header-update-button");
  const account = page.getByRole("button", { name: "Compte" });
  const menuButton = page.getByRole("button", { name: "Ouvrir le menu principal" });

  await expect(header).toBeVisible();
  await expect(header).toHaveCSS("background-image", /header-art-fast\.webp/);
  await expect(header).toHaveCSS("border-top-width", "2px");
  await expect(header).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.65)");
  await expect(account).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.62)");
  await expect(menuButton).toBeVisible();
  await expect(page.locator((page.viewportSize()?.width || 0) <= 720 ? ".mobile-bottom-navigation" : ".desktop-side-navigation")).toBeVisible();
  await expect(update).toHaveCount(0);
  await expect(switcher).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.62)");
  await expect(page.locator(".today-overview")).toHaveCSS("border-top-color", "rgba(91, 111, 132, 0.42)");
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
  if (testInfo.project.name === "ordinateur") {
    const deleteButtonBox = await page.locator(".calendar-bulk-delete-below").boundingBox();
    const calendarSectionBox = await page.locator(".planning-calendar-section").boundingBox();
    const calendarGridBox = await page.locator(".month-card .calendar-grid").boundingBox();
    expect(deleteButtonBox).not.toBeNull();
    expect(calendarSectionBox).not.toBeNull();
    expect(calendarGridBox).not.toBeNull();
    expect(deleteButtonBox!.width).toBeGreaterThan(calendarSectionBox!.width * 0.95);
    expect(deleteButtonBox!.y).toBeGreaterThanOrEqual(calendarGridBox!.y + calendarGridBox!.height);
  }
  const workedDaysTriggerBox = await page.locator(".worked-days-trigger").boundingBox();
  const planningTodayBox = await page.locator(".planning-today-button").boundingBox();
  expect(workedDaysTriggerBox).not.toBeNull();
  expect(planningTodayBox).not.toBeNull();
  expect(Math.abs(workedDaysTriggerBox!.width - planningTodayBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(workedDaysTriggerBox!.height - planningTodayBox!.height)).toBeLessThanOrEqual(1);
  await expect(page.locator(".planning-group-choice")).toHaveCount(0);
  expect(headerBox!.width).toBeLessThanOrEqual(viewportWidth - 12);
  expect(headerBox!.width / viewportWidth).toBeGreaterThan(
    viewportWidth >= 1200 ? 0.93 : 0.85,
  );
  expect(Math.abs(groupActionBox!.y - todayHeadingBox!.y)).toBeLessThan(
    viewportWidth <= 720 ? 12 : 1,
  );
  await expect(groupAction).toContainText(/Choisir mon groupe|Je suis groupe [123]/);
  const remainingWorkCard = page.locator(".today-remaining-work");
  await expect(remainingWorkCard).toBeVisible();
  await expect(remainingWorkCard).toContainText(/Travail restant[\s\S]*\d+[\s\S]*jour/);
  await expect(remainingWorkCard).toContainText("D’ici au 31 décembre");
  if (viewportWidth > 720) {
    await expect(page.locator(".home-notes-section")).toHaveCSS("border-left-width", "8px");
  }
  if (viewportWidth > 720) {
    const [statusBox, nextWorkBox, leaveBox, remainingBox] = await Promise.all([
      page.locator(".today-status").boundingBox(),
      page.locator(".today-next-work").boundingBox(),
      page.locator(".today-leave-balance").boundingBox(),
      remainingWorkCard.boundingBox(),
    ]);
    expect(statusBox).not.toBeNull();
    expect(nextWorkBox).not.toBeNull();
    expect(leaveBox).not.toBeNull();
    expect(remainingBox).not.toBeNull();
    expect(Math.abs(statusBox!.y - nextWorkBox!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(leaveBox!.y - remainingBox!.y)).toBeLessThanOrEqual(2);
    expect(leaveBox!.y).toBeGreaterThan(statusBox!.y + statusBox!.height);
    expect(Math.abs(statusBox!.width - nextWorkBox!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(statusBox!.width - leaveBox!.width)).toBeLessThanOrEqual(2);
  }
  if (viewportWidth <= 720) {
    await expect(page.locator(".today-overview")).toHaveCSS("border-left-width", "8px");
    await expect(page.locator(".planning-workspace-shell.framed")).toHaveCSS("border-top-width", "0px");
    await expect(page.locator(".planning-workspace-shell.framed")).toHaveCSS("border-left-width", "0px");
    await expect(page.locator(".planning-command-section")).toHaveCSS("border-left-width", "8px");
    await expect(page.locator(".planning-calendar-section")).toHaveCSS("border-left-width", "8px");
    await expect(page.locator(".home-planning-heading")).toHaveCSS("border-left-width", "0px");
    await expect(page.locator(".planning-workspace-shell.framed .controls")).toHaveCSS("border-left-width", "1px");
    await expect(page.locator(".calendar-toolbar.month-toolbar")).toHaveCSS("border-top-width", "1px");
    const cleanupButtonBox = await page.locator(".calendar-bulk-delete-below").boundingBox();
    expect(cleanupButtonBox).not.toBeNull();
    expect(cleanupButtonBox!.width).toBeGreaterThan(page.viewportSize()!.width * 0.8);
  }
  await expect(page.locator(".calendar-bulk-delete-below")).toHaveCSS("border-top-color", "rgb(17, 24, 32)");
  await expect(page.locator(".calendar-bulk-delete-below")).toHaveCSS("border-top-width", "2px");
  await expect(page.locator(".today-next-work strong")).toHaveText(
    /^[a-zà-ÿ]+ \d{2}\/\d{2}\/\d{2}(?: — (?:Formation|Fermeture exceptionnelle))?$/i,
  );
  if ((page.viewportSize()?.width || 0) >= 1200) {
    expect(Math.abs(headerBox!.x - todayOverviewBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(headerBox!.width - todayOverviewBox!.width)).toBeLessThanOrEqual(1);
  }
  await expect(switcher.getByRole("button", { name: "Mois" })).toHaveAttribute("aria-pressed", "true");
  await expect(switcher.getByRole("button", { name: "Mois" })).toHaveCSS("background-image", /gradient/);
  const switchBox = await switcher.boundingBox();
  expect(switchBox).not.toBeNull();
  expect(switchBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(switchBox!.y + switchBox!.height).toBeLessThanOrEqual(todayOverviewBox!.y);
  const modeBar = page.locator(".home-view-mode-bar");
  const modeBarBox = await modeBar.boundingBox();
  expect(modeBarBox).not.toBeNull();
  await expect(modeBar).toHaveCSS("border-top-width", "0px");
  expect(Math.abs(modeBarBox!.width - todayOverviewBox!.width)).toBeLessThanOrEqual(1);

  await page.locator('.calendar-toolbar button[aria-label="Sélectionner l’année"]').click();
  const years = page.getByRole("listbox", { name: "Sélectionner l’année" }).getByRole("option");
  await expect(years).toHaveCount(25);
  await expect(years.first()).toHaveText("2026");
  await expect(years.last()).toHaveText("2050");
  await expect(page.getByRole("button", { name: "2024", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2025", exact: true })).toHaveCount(0);
  const leaveActionBox = await page.locator(".planning-leave-panel .planning-leave-action").boundingBox();
  const exchangeActionBox = await page.locator(".planning-leave-panel .planning-exchange-action").boundingBox();
  const leavePanelBox = await page.locator(".planning-leave-panel").boundingBox();
  const periodNavigationBox = await page.locator(".calendar-toolbar .toolbar-month-picker .choice-picker-trigger").boundingBox();
  const monthCardBox = await page.locator(".month-card").boundingBox();
  expect(leaveActionBox).not.toBeNull();
  expect(exchangeActionBox).not.toBeNull();
  expect(leavePanelBox).not.toBeNull();
  expect(periodNavigationBox).not.toBeNull();
  expect(monthCardBox).not.toBeNull();
  if ((page.viewportSize()?.width || 0) >= 1101) {
    const [toolbarBox, monthPickerBox, yearPickerBox] = await Promise.all([
      page.locator(".calendar-toolbar.month-toolbar").boundingBox(),
      page.locator(".month-toolbar .toolbar-month-picker .choice-picker-trigger").boundingBox(),
      page.locator(".month-toolbar .toolbar-year-picker .choice-picker-trigger").boundingBox(),
    ]);
    expect(toolbarBox).not.toBeNull();
    expect(monthPickerBox).not.toBeNull();
    expect(yearPickerBox).not.toBeNull();
    expect(Math.abs(monthPickerBox!.width - yearPickerBox!.width)).toBeLessThanOrEqual(1);
    expect(yearPickerBox!.x + yearPickerBox!.width).toBeGreaterThan(
      toolbarBox!.x + toolbarBox!.width - 32,
    );
    await expect(page.locator(".month-toolbar .today-button")).toHaveCount(0);
  }
  expect(leaveActionBox!.y).toBeGreaterThan(periodNavigationBox!.y);
  expect(leavePanelBox!.y + leavePanelBox!.height).toBeLessThan(monthCardBox!.y);
  expect(Math.abs(leaveActionBox!.width - exchangeActionBox!.width)).toBeLessThanOrEqual(2);
  expect(exchangeActionBox!.x + exchangeActionBox!.width).toBeLessThanOrEqual(
    leavePanelBox!.x + leavePanelBox!.width,
  );
  await expect(page.getByRole("region", { name: "Outils du planning" })).toHaveCount(0);
});

test("un congé posé sur une formation retire cette date du prochain jour travaillé", async ({ page }) => {
  const expectedNext = await prepareFutureTrainingAbsenceDemo(page);
  const nextWork = page.locator(".today-next-work strong");

  await expect(nextWork).toHaveText(compactWeekdayDate(expectedNext));
});

test("une formation posée en récupération est retirée du prochain jour travaillé", async ({ page }) => {
  const expectedNext = await prepareFutureTrainingAbsenceDemo(page, "recovery");

  await expect(page.locator(".today-next-work strong")).toHaveText(
    compactWeekdayDate(expectedNext),
  );
});

test("une fermeture exceptionnelle retire la présence prévue et est annoncée comme prochain jour", async ({ page }) => {
  const group = 2;
  const closure = GRAND_PALAIS_EXCEPTIONAL_CLOSURES
    .map((item) => ({ ...item, value: new Date(`${item.date}T12:00:00`) }))
    .find((item) => getDayInfo(item.value, group).kind === "work");
  if (!closure) throw new Error("Aucune fermeture exceptionnelle ne tombe sur le cycle du groupe 2");

  await page.addInitScript((fixedTime) => {
    const NativeDate = Date;
    const fixedTimestamp = new NativeDate(fixedTime).getTime();
    class FixedDate extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...(args.length ? args : [fixedTimestamp]));
      }

      static now() {
        return fixedTimestamp;
      }
    }
    Object.defineProperty(window, "Date", { value: FixedDate });
  }, addDays(closure.value, -1).toISOString());
  await prepareDemo(page);

  await expect(page.locator(".today-next-work strong")).toContainText(
    "Fermeture exceptionnelle",
  );

  const monthCount = workedDayCount(
    closure.value.getFullYear(),
    closure.value.getMonth(),
    closure.value.getMonth(),
    group,
    [],
    {},
    [],
    480,
    (key) => GRAND_PALAIS_EXCEPTIONAL_CLOSURES.some((item) => item.date === key),
  );
  expect(monthCount.exceptionallyClosed).toBe(2);
  await expect(page.locator(".worked-days-trigger span")).toHaveText(
    `${monthCount.worked} ce mois-ci`,
  );
  await page.locator(".worked-days-trigger").click();
  const workedDaysPanel = page.locator(".worked-days-panel");
  await expect(workedDaysPanel).toContainText("2 fermetures exceptionnelles");
  const panelBox = await workedDaysPanel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
});

test("les menus déroulants restent entièrement visibles sur téléphone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Contrôle spécifique aux écrans tactiles");
  await prepareDemo(page);

  const assertVisibleMenus = async () => {
    const triggers = page.locator(".choice-picker-trigger:visible");
    await expect(triggers.first()).toBeVisible();
    const triggerCount = await triggers.count();
    expect(triggerCount).toBeGreaterThan(0);
    for (let index = 0; index < triggerCount; index += 1) {
      const trigger = triggers.nth(index);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      const menu = page.getByRole("listbox").last();
      await expect(menu).toBeVisible();
      await expect(menu).toHaveCSS("position", "fixed");
      const box = await menu.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(8);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width - 8);
      expect(box!.y).toBeGreaterThanOrEqual(8);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height - 8);
      await page.keyboard.press("Escape");
    }
  };

  await assertVisibleMenus();

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Documents et contacts/ })
    .click();
  await page.getByRole("tab", { name: "Plannings PDF" }).click();
  await assertVisibleMenus();

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await assertVisibleMenus();

  await page.setViewportSize({ width: 984, height: 1092 });
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /^Accueil/ })
    .click();
  await assertVisibleMenus();
});

test("le balayage mobile navigue entre toutes les rubriques", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Le geste tactile est réservé au téléphone");
  await prepareDemo(page);

  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Congés et récupérations");
  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Ma paie");
  const payMonth = page.locator(".pay-dashboard-month");
  const payMonthBefore = await payMonth.locator("h2").textContent();
  const monthTouch = (clientX: number) => ({ identifier: 2, clientX, clientY: 360, pageX: clientX, pageY: 360, screenX: clientX, screenY: 360 });
  const paySwipeZone = page.locator(".pay-dashboard-motion");
  await paySwipeZone.dispatchEvent("touchstart", { touches: [monthTouch(340)], changedTouches: [monthTouch(340)] });
  await paySwipeZone.dispatchEvent("touchend", { touches: [], changedTouches: [monthTouch(40)] });
  await expect(payMonth.locator("h2")).not.toHaveText(payMonthBefore || "");
  await expect(page.locator(".top-header h1")).toHaveText("Ma paie");
  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Documents et contacts");
  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Programmation GP");
  await swipeMainSection(page, 340, 40);
  await expect(page.locator(".top-header h1")).toHaveText("Planning des collègues");
  await swipeMainSection(page, 40, 340);
  await expect(page.locator(".top-header h1")).toHaveText("Programmation GP");
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
  test.skip(
    !["mobile", "z-fold"].includes(testInfo.project.name),
    "Ce contrôle nécessite une interface tactile",
  );
  await page.setViewportSize({ width: 900, height: 1000 });
  await prepareDemo(page);

  const foldNavigation = page.locator(".desktop-side-navigation");
  await expect(foldNavigation).toBeVisible();
  expect((await foldNavigation.boundingBox())!.height).toBeGreaterThanOrEqual(60);
  expect(await foldNavigation.locator("button").nth(1).evaluate((button) => getComputedStyle(button).borderLeftWidth)).toBe("1px");
  await expect(foldNavigation.getByRole("button", { name: "Accueil" })).toHaveClass(/active/);

  const headerBox = await page.locator(".top-header").boundingBox();
  expect(headerBox?.height ?? 0).toBeGreaterThanOrEqual(190);
  const [
    foldMonthBox,
    foldYearBox,
    foldTodayBox,
    foldWorkedDaysBox,
    foldModeBarBox,
    foldOverviewBox,
    foldStatusBox,
    foldNextWorkBox,
    foldLeaveBox,
    foldRemainingBox,
  ] =
    await Promise.all([
      page.locator(".month-toolbar .toolbar-month-picker .choice-picker-trigger").boundingBox(),
      page.locator(".month-toolbar .toolbar-year-picker .choice-picker-trigger").boundingBox(),
      page.locator(".planning-today-button").boundingBox(),
      page.locator(".worked-days-trigger").boundingBox(),
      page.locator(".home-view-mode-bar").boundingBox(),
      page.locator(".today-overview").boundingBox(),
      page.locator(".today-status").boundingBox(),
      page.locator(".today-next-work").boundingBox(),
      page.locator(".today-leave-balance").boundingBox(),
      page.locator(".today-remaining-work").boundingBox(),
    ]);
  expect(Math.abs(foldMonthBox!.width - foldYearBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(foldTodayBox!.width - foldWorkedDaysBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(foldModeBarBox!.width - foldOverviewBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(foldStatusBox!.y - foldNextWorkBox!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(foldLeaveBox!.y - foldRemainingBox!.y)).toBeLessThanOrEqual(2);
  expect(foldLeaveBox!.y).toBeGreaterThan(foldStatusBox!.y + foldStatusBox!.height);
  expect(Math.abs(foldStatusBox!.width - foldNextWorkBox!.width)).toBeLessThanOrEqual(2);
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
    .getByRole("button", { name: /Documents et contacts/ })
    .click();
  const formsHeader = page.locator(".top-header-pdf");
  const formsHeaderBox = (await formsHeader.boundingBox())!;
  expect(formsHeaderBox.x).toBeGreaterThanOrEqual(0);
  expect(formsHeaderBox.x + formsHeaderBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const artworkImage = await formsHeader.evaluate((node) => getComputedStyle(node, "::before").backgroundImage);
  expect(artworkImage).toContain("forms-header-art-fast.webp");
});

test("le paramètre de démonstration ne donne plus accès à l’application", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.getByRole("heading", { name: "Votre planning" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toHaveCount(0);
});

test("un compte invité peut demander un nouveau mot de passe", async ({ page }) => {
  let requestedEmail = "";
  await page.route("**/api/password-recovery", async (route) => {
    const body = route.request().postDataJSON() as { email?: string };
    requestedEmail = body.email || "";
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/");
  await page.getByLabel("Adresse e-mail").fill("Invite@Example.test");
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await expect(page.getByRole("status")).toContainText("un e-mail vient d’être envoyé");
  expect(requestedEmail).toBe("invite@example.test");
});

test("une panne des notifications ne bloque pas l’ouverture de l’application", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.route("**/api/notifications", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Notifications indisponibles" }),
  }));

  await prepareDemo(page);
  await page.waitForTimeout(300);

  await expect(page.getByRole("dialog", { name: "Impossible de continuer" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible();
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
  const updateAlert = page.locator(".account-update-alert");
  await expect(updateAlert).toContainText("Une mise à jour est disponible");
  await expect(updateAlert).toContainText("depuis ce menu");
});

test("le CET se configure et conserve un historique cohérent", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await openLeaveTool(page, "Mon CET");

  const cet = page.locator(".cet-section.cet-section-static");
  await expect(cet).toBeVisible();
  await expect(cet).toHaveClass(/open/);
  await expect(cet).toContainText("Compte épargne-temps");
  await expect(cet).toContainText("Configurez votre compte à partir de votre relevé RH");
  await expect(cet.locator(".cet-heading")).not.toHaveAttribute("aria-expanded");
  await expect(page.locator(".cet-section")).not.toContainText(
    "Planning Solo vous aide à suivre et simuler votre CET",
  );
  await expect(page.locator(".cet-heading strong")).toHaveCSS("font-size", "18.4px");
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
  await expect(existingRights).toHaveCSS("background-color", "rgb(166, 64, 0)");
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
  await expect(page.locator(".cet-heading")).toContainText("Configurez votre compte à partir de votre relevé RH");
  await expect(page.locator(".cet-summary-grid")).toHaveCount(0);
});

test("un solde manuel supérieur à 24 heures est bien enregistré", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await openLeaveTool(page, "Heures supplémentaires et récupérations");

  await page.getByRole("button", { name: "Ajouter des heures manuellement" }).click();
  const dialog = page.getByRole("dialog", { name: "Ajouter des heures manuellement" });
  await dialog.getByLabel("Heures").fill("72");
  await dialog.getByRole("button", { name: "Ajouter au solde" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("72 h disponibles")).toBeVisible();
  await page.getByLabel("Heures supplémentaires et récupérations")
    .getByRole("button", { name: "Voir l’historique" })
    .click();
  await expect(page.locator(".overtime-history")).toContainText(
    "Ajout manuel · +72 h",
  );
});

test("les heures supplémentaires du dimanche sont acceptées et reconnues", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await openLeaveTool(page, "Heures supplémentaires et récupérations");

  await page.getByRole("button", { name: "Déclarer des heures sup" }).click();
  const dialog = page.getByRole("dialog", { name: "Déclarer des heures supplémentaires" });
  await dialog.getByLabel("Date").fill("2026-05-10");
  await expect(dialog).toContainText("Tarif dimanche/jour férié reconnu automatiquement");
  await dialog.getByLabel("De").fill("10:00");
  await dialog.getByLabel("À").fill("12:30");
  await dialog.getByRole("button", { name: "Enregistrer les heures" }).click();

  await expect(dialog).toBeHidden();
  await page.getByLabel("Heures supplémentaires et récupérations")
    .getByRole("button", { name: "Voir l’historique" })
    .click();
  await expect(page.locator(".overtime-history")).toContainText("2 h 30 · À payer");
});

test("une formation utilise le bon nombre d’heures et apparaît en REC", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await openLeaveTool(page, "Heures supplémentaires et récupérations");

  await page.getByRole("button", { name: "Ajouter des heures manuellement" }).click();
  const balanceDialog = page.getByRole("dialog", { name: "Ajouter des heures manuellement" });
  await balanceDialog.getByLabel("Heures").fill("10");
  await balanceDialog.getByRole("button", { name: "Ajouter au solde" }).click();

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Accueil/ })
    .click();
  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Poser un congé" })
    .getByRole("button", { name: /^Récupération/ })
    .click();
  const recoveryPanel = page.locator("#request-panel");
  await recoveryPanel.getByRole("button", { name: /formation/i }).click();
  await page.locator(".month-card .day").first().click();
  const trainingHours = page.getByRole("dialog", { name: "Indiquez les horaires" });
  await expect(trainingHours.getByRole("button", { name: "Journée · 6 h · 10 h–16 h" })).toBeVisible();
  await expect(trainingHours.getByRole("button", { name: "Matin · 3 h · 10 h–13 h" })).toBeVisible();
  await expect(trainingHours.getByRole("button", { name: "Après-midi · 3 h · 13 h–16 h" })).toBeVisible();
  await trainingHours.getByRole("button", { name: "Journée · 6 h · 10 h–16 h" }).click();
  await trainingHours.getByRole("button", { name: "Valider les horaires" }).click();
  await recoveryPanel.getByRole("button", { name: "Enregistrer au planning sans formulaire" }).click();

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

test("les horaires du profil alimentent les propositions de congé et récupération", async ({ page }) => {
  await prepareDemo(page);
  const setup = page.locator(".home-setup-alert");
  await expect(setup).toContainText("Renseigner vos horaires de travail");
  await setup.getByRole("button", { name: "Renseigner" }).click();
  const profile = page.locator("#pay-profile-settings");
  await expect(profile).toBeInViewport();
  await expect(profile).toBeFocused();
  const startHour = page.getByLabel("Heure de début — heures");
  const startMinute = page.getByLabel("Heure de début — minutes");
  const profileTypography = await profile.evaluate((node) => {
    const style = (selector: string) => getComputedStyle(node.querySelector(selector)!);
    const quotaLabel = style(".pay-profile-settings-grid > label > span");
    const scheduleLegend = style(".pay-work-schedule legend");
    const hourLabel = style(".pay-work-time-field > span");
    const quotaValue = style(".pay-profile-picker .choice-picker-trigger");
    const hourValue = getComputedStyle(node.querySelector(".pay-work-time-picker select")!);
    return {
      labels: [quotaLabel, scheduleLegend, hourLabel].map((item) => [item.fontFamily, item.fontSize, item.fontWeight]),
      values: [quotaValue, hourValue].map((item) => [item.fontFamily, item.fontSize, item.fontWeight]),
    };
  });
  expect(new Set(profileTypography.labels.map((item) => item.join("|"))).size).toBe(1);
  expect(new Set(profileTypography.values.map((item) => item.join("|"))).size).toBe(1);
  await expect(startHour.locator("option")).toHaveText(["9 h", "10 h", "11 h", "12 h", "13 h", "14 h", "15 h", "16 h", "17 h", "18 h", "19 h"]);
  await expect(startMinute.locator("option")).toHaveText(["00", "15", "30", "45"]);
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    const profileFields = page.locator(".pay-profile-settings-grid > label");
    const [quotaBox, statusBox] = await Promise.all([
      profileFields.nth(0).boundingBox(),
      profileFields.nth(1).boundingBox(),
    ]);
    expect(statusBox!.y - quotaBox!.y - quotaBox!.height).toBeLessThanOrEqual(10);
  }
  await startHour.selectOption("10");
  await startMinute.selectOption("00");
  await page.getByLabel("Heure de fin — heures").selectOption("18");
  await page.getByLabel("Heure de fin — minutes").selectOption("00");
  const saveProfile = profile.getByRole("button", { name: "Enregistrer le profil" });
  await expect(saveProfile).toBeVisible();
  await saveProfile.click();

  await page.getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Accueil" }).click();
  await expect(page.locator(".home-setup-alert")).toHaveCount(0);
  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Poser un congé" })
    .getByRole("button", { name: /^Récupération/ }).click();
  await page.locator("#request-panel").getByRole("button", { name: /Récupération en heures/ }).click();
  await page.locator(".month-card .day.work").first().click();

  const hours = page.getByRole("dialog", { name: "Indiquez les horaires" });
  await expect(hours.getByRole("button", { name: "Matin · 10 h–14 h" })).toBeVisible();
  await expect(hours.getByRole("button", { name: "Après-midi · 14 h–18 h" })).toBeVisible();
  await expect(hours.getByLabel("De")).toHaveValue("10:00");
  await expect(hours.getByLabel("À")).toHaveValue("14:00");
});

test("Divers est explicite et le résumé apparaît avant validation", async ({ page }) => {
  await prepareDemo(page);
  const workedButton = page.getByRole("button", { name: "Détail des jours travaillés" });
  const initialWorked = Number((await workedButton.innerText()).match(/[\d,.]+/)![0].replace(",", "."));
  await page.locator(".planning-leave-panel .planning-leave-action").click();

  const chooser = page.getByRole("dialog", { name: "Poser un congé" });
  await chooser.getByText("Autres absences").click();
  const other = chooser.getByRole("button", { name: /Divers/ });
  await expect(other).not.toContainText("Grève, décharge syndicale, fermeture exceptionnelle");
  await expect(other.locator(".other-choice-dot")).toHaveCount(0);
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
  const chooser = page.getByRole("dialog", { name: "Poser un congé" });
  await chooser.getByText("Autres absences").click();
  await chooser.getByRole("button", { name: /^Grève/ }).click();
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
  await expect(page.locator(".leave-balance-grid button.annual")).toContainText("0 déjà pris");
  await page.evaluate(() => document.fonts.ready);
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    await expect.poll(async () => {
      const [strikeBox, accidentBox] = await Promise.all([
        strikeCard.boundingBox(),
        page.locator(".leave-balance-grid button.work_accident").boundingBox(),
      ]);
      return strikeBox && accidentBox ? Math.abs(strikeBox.y - accidentBox.y) : Number.POSITIVE_INFINITY;
    }).toBeLessThanOrEqual(2);
  }
  const [balanceGridBox, strikeCardBox, otherCardBox, accidentCardBox] = await Promise.all([
    page.locator(".leave-balance-grid").boundingBox(),
    strikeCard.boundingBox(),
    page.locator(".leave-balance-grid button.other").boundingBox(),
    page.locator(".leave-balance-grid button.work_accident").boundingBox(),
  ]);
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    expect(Math.abs(strikeCardBox!.width - accidentCardBox!.width)).toBeLessThanOrEqual(2);
    expect(strikeCardBox!.width).toBeGreaterThan(balanceGridBox!.width * 0.4);
    expect(Math.abs(strikeCardBox!.height - accidentCardBox!.height)).toBeLessThanOrEqual(2);
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
  await page.getByRole("button", { name: /Voir le détail du calcul/ }).click();
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
  await page.getByRole("button", { name: /Voir le détail du calcul/ }).click();
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
  await expect(page.locator(".leave-balance-grid button.annual")).toContainText(/[1-9]\d* déjà pris/);
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
  await page.getByRole("button", { name: /Voir le détail du calcul/ }).click();
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
  const chooser = page.getByRole("dialog", { name: "Poser un congé" });
  await chooser.getByText("Autres absences").click();
  await chooser.getByRole("button", { name: /^CET/ }).click();
  await expect(page.getByRole("button", { name: /Congé CET/ })).toBeVisible();
  await page.getByRole("button", { name: "Annuler la demande" }).click();

  await page.locator(".month-card .day").first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^CET/ })).toBeVisible();
});

test("les choix principaux et ceux d’une date suivent l’ordre demandé", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".planning-leave-panel .planning-leave-action").click();
  const chooser = page.getByRole("dialog", { name: "Poser un congé" });
  await expect(chooser.locator(".request-primary-choice-grid > button > strong")).toHaveText([
    "CA", "RTT", "Fractionnement", "Récupération",
  ]);
  await chooser.getByText("Autres absences").click();
  await expect(chooser.locator(".request-other-choices .choice-grid > button > strong")).toHaveText([
    "CET", "Maladie", "Garde d’enfant", "Jour exceptionnel", "Divers", "Grève",
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
    /Grève/,
    /CET/,
    /ÉchangeDeux dates obligatoires/,
    /Fermeture exceptionnelleAjouter CLOSED/,
  ]);
  await expect(dayDialog.locator(".leave-choices .other-day")).toHaveCSS(
    "background-color",
    "rgb(250, 251, 253)",
  );
  await expect(dayDialog.locator(".leave-choices .cet-day")).toHaveCSS(
    "background-color",
    "rgb(250, 251, 253)",
  );
  const choiceBorders = await dayDialog.locator(".leave-choices .other-day, .leave-choices .exchange-day-choice")
    .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).borderColor));
  expect(choiceBorders[1]).toBe(choiceBorders[0]);
});

test("une récupération ordinaire affiche le cycle sans reproposer Formation", async ({ page }) => {
  await prepareDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await openLeaveTool(page, "Heures supplémentaires et récupérations");
  await page.getByRole("button", { name: "Ajouter des heures manuellement" }).click();
  const balanceDialog = page.getByRole("dialog", { name: "Ajouter des heures manuellement" });
  await balanceDialog.getByLabel("Heures").fill("10");
  await balanceDialog.getByRole("button", { name: "Ajouter au solde" }).click();
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Accueil/ })
    .click();
  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Poser un congé" })
    .getByRole("button", { name: /^Récupération/ })
    .click();
  const recoveryPanel = page.locator("#request-panel");
  await recoveryPanel.getByRole("button", { name: /Récupération en heures/ }).click();
  await page.locator(".month-card .day").first().click();
  const timeDialog = page.getByRole("dialog", { name: "Indiquez les horaires" });
  await expect(timeDialog.getByText("Horaires habituels")).toBeVisible();
  await timeDialog.getByRole("button", { name: /Après-midi/ }).click();
  await timeDialog.getByRole("button", { name: "Valider les horaires" }).click();
  await recoveryPanel.getByRole("button", { name: "Enregistrer au planning sans formulaire" }).click();

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
  const recoveryPanel = page.locator("#request-panel");
  await expect(recoveryPanel.getByLabel("Résumé avant validation").getByText("1 date", { exact: true })).toBeVisible();
  await expect(recoveryPanel.getByLabel("Résumé avant validation")).toContainText("Vous n’avez plus d’heures de récupération disponibles.");
  await expect(recoveryPanel.getByRole("button", { name: "Récupération en journée" })).toHaveClass(/active/);
  await expect(recoveryPanel.getByRole("button", { name: "Continuer vers le formulaire" })).toBeDisabled();
  const directPlanningChoice = recoveryPanel.getByRole("button", { name: "Enregistrer au planning sans formulaire" });
  await expect(directPlanningChoice).toBeVisible();
  await expect(directPlanningChoice).toBeDisabled();
  await expect(directPlanningChoice).toHaveClass(/request-planning-choice/);
  await expect(directPlanningChoice.getByText("Sans préparer de formulaire")).toBeVisible();
  await expect(directPlanningChoice).toHaveCSS("border-radius", "14px");
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
    await page.locator(".planning-leave-panel .planning-leave-action").click();
    const chooser = page.getByRole("dialog", { name: "Poser un congé" });
    await chooser.getByRole("button", {
      name: index === 0 ? /^CA Congés annuels/ : index === 1 ? /^RTT/ : /^Fractionnement/,
    }).click();
    const request = page.locator("#request-panel");
    await day.click();
    await request.getByRole("button", { name: "Enregistrer au planning sans formulaire" }).click();
    await expect(day.getByText(choices[index].marker, { exact: true })).toBeVisible();
  }
});

test("une demande mixte détaille séparément les CA et les RTT", async ({ page }) => {
  await prepareDemo(page);
  const workDays = page.locator(".month-card .day.work");
  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Poser un congé" })
    .getByRole("button", { name: /^CA Congés annuels/ })
    .click();
  const request = page.locator("#request-panel");
  await workDays.nth(0).click();
  await request.getByRole("button", { name: "RTT", exact: true }).click();
  await workDays.nth(1).click();
  const summary = request.getByLabel("Résumé avant validation");
  await expect(summary).toContainText(/CA : 1 jour déduit · \d+ → \d+/);
  await expect(summary).toContainText(/RTT : 1 jour déduit · \d+ → \d+/);
  await expect(request.getByRole("button", { name: "Continuer vers le formulaire" })).toBeEnabled();
});

test("nettoyage et gestion d’un congé utilisent des actions directes", async ({ page }) => {
  await prepareDemo(page, true);

  await page.locator(".calendar-bulk-delete-button:visible, .calendar-bulk-delete-mobile:visible").click();
  const cleanup = page.locator(".calendar-delete-panel");
  await expect(cleanup).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) > 720) {
    await expect(cleanup).toBeFocused();
    const cleanupBox = await cleanup.boundingBox();
    expect(cleanupBox).not.toBeNull();
    expect(cleanupBox!.y).toBeGreaterThanOrEqual(0);
    expect(cleanupBox!.y).toBeLessThan(page.viewportSize()!.height);
  }
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
  await dayDialog.getByRole("button", { name: "Annuler le congé" }).click();
  await page.getByRole("alertdialog", { name: "Annuler cette période ?" })
    .getByRole("button", { name: "Annuler la période" })
    .click();
  const undo = page.locator(".undo-toast");
  await expect(undo).toContainText("L’absence a été supprimée");
  await undo.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.locator('.month-card .day[aria-current="date"]').click();
  await expect(page.getByRole("dialog", { name: /.+/ }).getByText("Périodes concernant cette date")).toBeVisible();
});

test("les parcours congé, récupération et maladie s’ouvrent correctement", async ({ page }) => {
  await prepareDemo(page);

  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Poser un congé" })
    .getByRole("button", { name: /^CA Congés annuels/ })
    .click();
  await expect(page.getByRole("heading", { name: "Sélectionnez vos congés" })).toBeVisible();
  await page.locator(".month-card .day").first().click();
  await expect(page.getByLabel("Résumé avant validation")).toBeVisible();
  await page.getByRole("button", { name: "Annuler la demande" }).click();

  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Poser un congé" })
    .getByRole("button", { name: /^Récupération/ })
    .click();
  const recovery = page.locator("#request-panel");
  await expect(recovery.locator(".type-tabs > button")).toHaveCount(5);
  await expect(recovery.getByRole("button", { name: /formation/i })).toBeVisible();
  await recovery.getByRole("button", { name: "Annuler la demande" }).click();

  await page.locator(".planning-leave-panel .planning-leave-action").click();
  const sickChooser = page.getByRole("dialog", { name: "Poser un congé" });
  await sickChooser.getByText("Autres absences").click();
  await sickChooser.getByRole("button", { name: /^Maladie/ }).click();
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

test("les dates choisies sont préremplies dans le formulaire de congé", async ({ page }) => {
  await prepareDemo(page);

  await page.locator(".planning-leave-panel .planning-leave-action").click();
  await page.getByRole("dialog", { name: "Poser un congé" })
    .getByRole("button", { name: /^CA Congés annuels/ })
    .click();

  await page.locator(".month-card .day.work").first().click();
  await expect(page.getByLabel("Résumé avant validation")).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/formulaire\/index\.html\?planning=1/),
    page.getByRole("button", { name: "Continuer vers le formulaire" }).click(),
  ]);

  const handoff = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("planning:form-handoff-v1") || "null"),
  );
  expect(handoff?.periods?.[0]).toMatchObject({ type: "annual" });
  expect(handoff?.periods?.[0]?.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByLabel("Congés annuels — ligne 1 — du")).not.toHaveValue("");
  await expect(page.getByLabel("Congés annuels — ligne 1 — au")).not.toHaveValue("");
  await expect(page.locator("#msg")).toContainText("dates choisies");
});

test("la signature enregistrée sur téléphone est synchronisée avec le profil", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "La conservation volontaire est proposée sur téléphone");
  let savedProfile: Record<string, unknown> | null = null;
  await page.route("**/api/calendar", async (route) => {
    const request = route.request();
    if (request.method() === "POST") savedProfile = request.postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.addInitScript(() => {
    localStorage.setItem("planning:form-handoff-v1", JSON.stringify({
      version: 1,
      requestId: "e2e-signature-sync",
      requestKind: "leave",
      group: 2,
      createdAt: new Date().toISOString(),
      profile: { fullName: "Agnès Martin", group: "2", signature: "" },
      periods: [{ from: "2026-08-26", to: "2026-08-26", type: "annual" }],
      timed: [],
    }));
    localStorage.removeItem("planning:e2e-demo-enabled");
  });
  await page.goto("/formulaire/index.html?planning=1");
  await page.locator("#sig").click();
  const signatureCanvas = page.locator("#sigBig");
  const signatureBox = await signatureCanvas.boundingBox();
  expect(signatureBox).not.toBeNull();
  await page.mouse.move(signatureBox!.x + 30, signatureBox!.y + 40);
  await page.mouse.down();
  await page.mouse.move(signatureBox!.x + 150, signatureBox!.y + 85, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  const savePrompt = page.getByRole("alertdialog", { name: "Conserver cette signature ?" });
  await expect(savePrompt).toContainText("synchronisée avec votre compte Planning Solo");
  await savePrompt.getByRole("button", { name: "Oui, enregistrer" }).click();
  await expect.poll(() => savedProfile).toMatchObject({
    action: "save-form-profile",
    fullName: "Agnès Martin",
    group: "2",
  });
  expect(String(savedProfile?.signature || "")).toMatch(/^data:image\/png;base64,/);
  await expect(page.locator("#msg")).toContainText("synchronisée avec votre compte");
});

test("les détails des soldes présentent seulement les mois concernés", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "planning:demo-completed-request-v1",
      JSON.stringify({
        requestId: "e2e-one-balance-month",
        requestKind: "leave",
        group: 2,
        periods: [
          { from: "2026-07-01", to: "2026-07-01", type: "annual" },
          { from: "2026-10-01", to: "2026-10-01", type: "annual" },
        ],
        timed: [],
      }),
    );
  });
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
  await expect(months).toHaveCount(2);
  await expect(months.nth(0)).toContainText("juillet 2026");
  await expect(months.nth(1)).toContainText("octobre 2026");
  await expect(months.locator("[open]")).toHaveCount(0);
  await months.first().locator("summary").click();
  await expect(months.first()).toHaveAttribute("open", "");
  await expect(months.first().locator(".balance-detail-taken")).toContainText("Déjà pris · voir et gérer cette absence");
  await expect(months.first().locator(".balance-detail-taken .balance-detail-open")).toHaveCSS("background-image", /linear-gradient/);
  await months.nth(1).locator("summary").click();
  await expect(months.nth(1).locator(".balance-detail-upcoming")).toContainText("À venir · voir et gérer cette absence");
  await expect(months.nth(1).locator(".balance-detail-upcoming .balance-detail-open")).toHaveCSS("background-image", /linear-gradient/);
});

test("Ma paie couvre août, septembre et octobre avec un calcul détaillé", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.clock.setFixedTime(new Date("2026-08-30T12:00:00+02:00"));
  await prepareCompletePayDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();

  const payDashboard = page.locator(".pay-dashboard");
  const monthHeading = payDashboard.locator(".pay-dashboard-month h2");
  const nextMonth = payDashboard.locator(".pay-dashboard-month").getByRole("button", { name: "Mois suivant" });
  await expect(monthHeading).toHaveText("Août 2026");
  await expect(payDashboard.getByText("Aucun élément variable prévu pour ce mois.")).toBeVisible();
  await expect(payDashboard.getByText("Profil utilisé pour les calculs", { exact: true })).toBeVisible();

  const settingsToggle = payDashboard.getByRole("button", { name: /Réglages et explications/ });
  await settingsToggle.click();
  await expect(settingsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(payDashboard.getByText("Mon profil de paie", { exact: true })).toBeVisible();
  await settingsToggle.click();
  await expect(settingsToggle).toHaveAttribute("aria-expanded", "false");

  await nextMonth.click();
  await expect(monthHeading).toHaveText("Septembre 2026");
  await expect(payDashboard.getByText(/Jours fériés \(1\)/)).toBeVisible();

  await nextMonth.click();
  await expect(monthHeading).toHaveText("Octobre 2026");
  await expect(payDashboard.getByText("Dimanches (8)", { exact: true })).toBeVisible();
  await expect(payDashboard.getByText(/dont 1 reporté/)).toBeVisible();

  await payDashboard.getByRole("button", { name: "Voir le détail du calcul" }).click();
  await expect(page.getByRole("heading", { name: "Composition du brut" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retenues et passage au net" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /^Traitement indiciaire/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /^Indemnité de résidence/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /^IFSE/ })).toBeVisible();
  await expect(page.getByText("Net avant prélèvement à la source", { exact: true })).toBeVisible();
  await expect(page.getByText("Net estimé final", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revenir au tableau de bord de paie" }).click();
  await expect(monthHeading).toHaveText("Octobre 2026");

  await payDashboard.getByRole("button", { name: "Primes et jours fériés" }).click();
  await expect(page.locator(".allowance-note").filter({ hasText: /dimanches? effectués? sur/ })).toBeVisible();
  await page.getByRole("button", { name: "Revenir au tableau de bord de paie" }).click();
  await expect(monthHeading).toHaveText("Octobre 2026");

  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 740 });
    await expect(payDashboard).toBeVisible();
    const [narrowMonthCopy, narrowMonthActions, narrowMonthCard] = await Promise.all([
      payDashboard.locator(".pay-dashboard-month > div").first().boundingBox(),
      payDashboard.locator(".pay-dashboard-month-actions").boundingBox(),
      payDashboard.locator(".pay-dashboard-month").boundingBox(),
    ]);
    expect(narrowMonthCopy).not.toBeNull();
    expect(narrowMonthActions).not.toBeNull();
    expect(narrowMonthCard).not.toBeNull();
    expect(narrowMonthActions!.x).toBeGreaterThan(narrowMonthCopy!.x);
    expect(narrowMonthCard!.height).toBeLessThanOrEqual(120);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const overflowingElements = await page.locator("body *").evaluateAll((elements) =>
      elements
        .map((element) => ({
          tag: element.tagName,
          className: element.getAttribute("class") || "",
          right: Math.round(element.getBoundingClientRect().right),
        }))
        .filter((element) => element.right > document.documentElement.clientWidth + 1)
        .slice(0, 8),
    );
    expect(overflow, JSON.stringify(overflowingElements)).toBeLessThanOrEqual(1);
  }
  expect(consoleErrors).toEqual([]);
});

test("le mois de paie reste indépendant du planning et suit une alerte datée", async ({ page }) => {
  await prepareCompletePayDemo(page);
  const planningMonth = page.getByRole("button", { name: "Sélectionner le mois" });
  const initialPlanningMonth = (await planningMonth.textContent())?.trim();
  await page.locator(".important-alert").click();
  await expect(page.locator(".pay-dashboard-month h2")).toHaveText("Octobre 2026");

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /^Accueil/ })
    .click();
  await expect(planningMonth).toHaveText(initialPlanningMonth || "");

  const calendar = page.locator(".month-card");
  const touch = (clientX: number) => ({ identifier: 1, clientX, clientY: 420, pageX: clientX, pageY: 420, screenX: clientX, screenY: 420 });
  await calendar.dispatchEvent("touchstart", { touches: [touch(340)], changedTouches: [touch(340)] });
  await calendar.dispatchEvent("touchend", { touches: [], changedTouches: [touch(40)] });
  await expect(planningMonth).not.toHaveText(initialPlanningMonth || "");

  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();
  await expect(page.locator(".pay-dashboard-month h2")).toHaveText("Octobre 2026");
});

test("le profil de paie d’une nouvelle année peut être confirmé sans modifier un montant", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-30T12:00:00+02:00"));
  await prepareCompletePayDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();

  const dashboard = page.locator(".pay-dashboard");
  const nextMonth = dashboard.getByRole("button", { name: "Mois suivant" });
  for (let month = 0; month < 5; month += 1) await nextMonth.click();
  await expect(dashboard.locator(".pay-dashboard-month h2")).toHaveText("Janvier 2027");
  const settingsToggle = dashboard.getByRole("button", { name: /Réglages et explications/ });
  await settingsToggle.click();
  await expect(settingsToggle).toHaveAttribute("aria-expanded", "true");
  const confirm = dashboard.getByRole("button", { name: "Utiliser ces valeurs pour 2027" });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(dashboard.locator(".pay-year-notice")).toHaveCount(0);
});

test("Z Fold ouvert : le tableau de bord de paie garde sa grille sans débordement", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "z-fold", "Ce contrôle cible le Fold déplié");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await prepareCompletePayDemo(page);
  await openMainMenu(page);
  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Ma paie/ })
    .click();
  const dashboard = page.locator(".pay-dashboard");
  await expect(dashboard).toBeVisible();
  const columns = await dashboard.locator(".pay-dashboard-priority-grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
});

test("le tableau de bord de paie ouvre ses deux pages détaillées", async ({ page }) => {
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
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
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
    )).toBeLessThan(3.1);
    await expect(closeDetails).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -4)");
    await expect(variableTotal).toHaveCSS("font-size", "15px");
  }
  await page.getByRole("button", { name: "Revenir au tableau de bord de paie" }).click();
  await page.getByRole("button", { name: /Voir le détail du calcul/ }).click();
  await expect(page.locator(".pay-detail-sticky-header h2")).toHaveText("Détail du calcul");
  await expect(page.getByText("Détail de la paie du mois affiché", { exact: true })).toBeVisible();
  await expect(page.locator(".pay-reliability")).toContainText(/Données à compléter|Valeurs enregistrées|dernières valeurs|Valeurs vérifiées/);
  await page.getByRole("button", { name: "Revenir au tableau de bord de paie" }).click();
  await expect(page.locator(".pay-dashboard-month h2")).toHaveText(/^[a-zûéèàôîç]+ 2026$/i);
});

test("le groupe, les notes, les sauvegardes et le retour du formulaire restent accessibles", async ({ page }) => {
  await prepareDemo(page);

  await page.locator(".today-overview-heading .group-heading-action").click();
  const groups = page.getByRole("dialog", { name: "Choisir mon groupe" });
  await expect(groups.locator(".group-choice-grid > button")).toHaveCount(3);
  await groups.locator(".group-choice-grid > button").first().click();
  await expect(groups).toHaveCount(0);
  await expect(page.locator(".today-overview-heading .group-heading-action")).toHaveText("Je suis groupe 1");

  await page.locator(".home-notes-toggle").click();
  await page.getByRole("button", { name: "Ajouter une note" }).click();
  const note = page.getByRole("dialog", { name: "Ajouter une note" });
  await note.getByLabel("Date de la note").fill("2026-09-15");
  await expect(note.getByLabel("Date de la note")).toHaveValue("2026-09-15");
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

test("Mika et Agnès peuvent supprimer chaque note partagée après confirmation", async ({ page }) => {
  await prepareDemo(page);
  await page.locator(".home-notes-toggle").click();

  const personalNotes = page.locator(".home-notes-content .upcoming-item").filter({
    has: page.locator(".note-author-mika"),
  });
  await expect(personalNotes).toHaveCount(2);
  const mikaDeleteButtons = page.getByRole("button", { name: /Supprimer la note de Mika du/ });
  const agnesDeleteButtons = page.getByRole("button", { name: /Supprimer la note d’Agnès du/ });
  await expect(mikaDeleteButtons).toHaveCount(2);
  await expect(agnesDeleteButtons).toHaveCount(2);
  if ((page.viewportSize()?.width ?? 1000) > 720) {
    expect(await page.locator(".home-notes-content .note-column-layout").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(1);
  }

  page.once("dialog", async (dialog) => dialog.accept());
  await personalNotes.first().getByRole("button", { name: /Supprimer la note de Mika du/ }).click();
  await expect(mikaDeleteButtons).toHaveCount(1);

  page.once("dialog", async (dialog) => dialog.dismiss());
  await agnesDeleteButtons.first().click();
  await expect(agnesDeleteButtons).toHaveCount(2);

  page.once("dialog", async (dialog) => dialog.accept());
  await agnesDeleteButtons.first().click();
  await expect(agnesDeleteButtons).toHaveCount(1);
});
