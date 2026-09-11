import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function prepareDemo(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("planning:e2e-demo-enabled", "1");
    localStorage.setItem("planning:guide-seen-v1:demo", "1");
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible();
}

async function expectNoSeriousAccessibilityViolation(page: Page, context: string) {
  // Auditer une page encore en train d'apparaître fausse le contrôle de
  // contraste : axe compose la couleur du texte avec un fond encore
  // semi-transparent. On attend donc la fin du chargement différé et des
  // animations d'entrée avant de mesurer.
  await expect(page.locator(".deferred-section-loading")).toHaveCount(0);
  await page
    .waitForFunction(
      () => document.getAnimations().every((animation) => animation.playState !== "running"),
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = result.violations.filter(({ impact }) =>
    impact === "serious" || impact === "critical",
  );
  expect(
    violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.flatMap(({ target }) => target).slice(0, 8),
    })),
    `Violations d’accessibilité ${context}`,
  ).toEqual([]);
}

async function openMainMenu(page: Page) {
  await page.getByRole("button", { name: "Ouvrir le menu principal" }).click();
}

test("les parcours essentiels ne présentent pas de violation d’accessibilité grave", async ({ page }) => {
  await prepareDemo(page);
  await expectNoSeriousAccessibilityViolation(page, "sur l’accueil");

  await openMainMenu(page);
  const menu = page.getByRole("complementary", { name: "Menu principal" });
  await expect(menu).toBeVisible();
  await expectNoSeriousAccessibilityViolation(page, "dans le menu principal");
  await menu.getByRole("button", { name: "Fermer le menu" }).click();

  const navigation = page.locator('nav[aria-label="Navigation principale"]:visible');
  await navigation.getByRole("button", { name: "Congés", exact: true }).click();
  await expect(page.locator(".top-header h1")).toHaveText("Congés et récupérations");
  await expectNoSeriousAccessibilityViolation(page, "sur les congés et récupérations");
  for (const name of [/Ma paie/, /Docs|Documents/, /Expos|Programme/, /Collègues/]) {
    await navigation.getByRole("button", { name }).click();
    await expectNoSeriousAccessibilityViolation(page, `dans ${name.source}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
