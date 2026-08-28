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

test("les parcours essentiels ne présentent pas de violation d’accessibilité grave", async ({ page }) => {
  await prepareDemo(page);
  await expectNoSeriousAccessibilityViolation(page, "sur l’accueil");

  await page.getByRole("button", { name: "Ouvrir le menu principal" }).click();
  await expect(page.getByRole("complementary", { name: "Menu principal" })).toBeVisible();
  await expectNoSeriousAccessibilityViolation(page, "dans le menu principal");

  await page.getByRole("complementary", { name: "Menu principal" })
    .getByRole("button", { name: /Congés et récupérations/ })
    .click();
  await expect(page.locator(".top-header h1")).toHaveText("Congés et récupérations");
  await expectNoSeriousAccessibilityViolation(page, "sur les congés et récupérations");
});
