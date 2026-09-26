import { expect, test, type Page } from "@playwright/test";

// Un vrai compte (hors démo) resté connecté : la session et le dernier
// planning sont gardés sur l'appareil, le serveur est simulé et lent.
const exp = Math.floor(Date.now() / 1000) + 3600;
const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: "u-1", email: "mika@example.test", exp })}.signature`;

function dayKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

async function seedRememberedSession(page: Page, day: string) {
  await page.addInitScript(({ token, expiresAt, noteDay }) => {
    localStorage.setItem("gotrue.user", JSON.stringify({
      id: "u-1",
      email: "mika@example.test",
      url: `${location.origin}/.netlify/identity`,
      audience: "",
      token: { access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: "r1", expires_at: expiresAt * 1000 },
    }));
    localStorage.setItem("planning:calendar-snapshot-v1", JSON.stringify({
      userId: "u-1",
      savedAt: new Date().toISOString(),
      data: { email: "mika@example.test", entries: [{ date: noteDay, note_text: "Note gardée sur l’appareil" }] },
    }));
    localStorage.setItem("planning:install-notice-dismissed-v1", "1");
    document.cookie = `nf_jwt=${token}; path=/`;
  }, { token: accessToken, expiresAt: exp, noteDay: day });
  // Les autres services restent muets : seul le planning compte ici.
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "Indisponible" } }));
}

test("Rester connecté : le dernier planning s’affiche avant la réponse du serveur, puis se met à jour", async ({ page }) => {
  const day = dayKey(1);
  await seedRememberedSession(page, day);
  let answerCalendar: () => void = () => undefined;
  const calendarAsked = new Promise<void>((resolve) => { answerCalendar = resolve; });
  await page.route("**/api/calendar", async (route) => {
    await calendarAsked;
    await route.fulfill({ json: { email: "mika@example.test", entries: [{ date: day, note_text: "Note lue sur le serveur" }] } });
  });

  await page.goto("/");
  // Le serveur n'a pas encore répondu : le planning gardé est déjà là.
  await expect(page.locator(".auth-shell, .auth-screen")).toHaveCount(0);
  await page.locator(".home-notes-toggle h2").click();
  await page.locator(".home-notes-content .note-month > summary").first().click();
  await expect(page.getByText("Note gardée sur l’appareil")).toBeVisible();

  // La réponse du serveur remplace la copie.
  answerCalendar();
  await expect(page.getByText("Note lue sur le serveur")).toBeVisible();
  await expect(page.getByText("Note gardée sur l’appareil")).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem("planning:calendar-snapshot-v1") || "");
  expect(saved).toContain("Note lue sur le serveur");
});

test("Rester connecté : sans réseau, le planning gardé reste affiché", async ({ page }) => {
  await seedRememberedSession(page, dayKey(1));
  await page.route("**/api/calendar", (route) => route.abort("internetdisconnected"));
  await page.goto("/");
  await page.locator(".home-notes-toggle h2").click();
  await page.locator(".home-notes-content .note-month > summary").first().click();
  await expect(page.getByText("Note gardée sur l’appareil")).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(page.getByText("Note gardée sur l’appareil")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toHaveCount(0);
});
