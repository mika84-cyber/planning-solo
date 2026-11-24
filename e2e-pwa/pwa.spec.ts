import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* L'application installable, telle qu'elle est publiée : le service worker se
   met en place, garde de quoi rouvrir l'application sans réseau, et une
   nouvelle version publiée est signalée puis remplace l'ancienne avec son
   cache. La démonstration n'existe qu'en développement : ces tests passent
   donc par l'écran de connexion, premier écran qu'on doit pouvoir rouvrir. */

/** Le service worker servi par scripts/serve-dist.mjs, relu à chaque demande. */
const SW_FILE = "dist-pwa-e2e/sw.js";
const VERSION_FILE = "dist-pwa-e2e/version.json";
const INDEX_FILE = "dist-pwa-e2e/index.html";

const shell = (page: Page) => page.getByRole("heading", { name: "Votre planning" });

async function openControlled(page: Page, ready = shell) {
  await page.goto("/");
  await expect(ready(page)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await expect(ready(page)).toBeVisible();
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

const appShell = (page: Page) => page.locator('nav[aria-label="Navigation principale"]:visible');

/** Un compte connecté, le serveur simulé : la fenêtre de mise à jour vit dans
 *  l'application, pas sur l'écran de connexion. */
async function openSignedIn(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: "u-maj", email: "agent@example.test", exp })}.signature`;
  await page.addInitScript(({ accessToken, expiresAt }) => {
    localStorage.setItem("gotrue.user", JSON.stringify({
      id: "u-maj",
      email: "agent@example.test",
      url: `${location.origin}/.netlify/identity`,
      audience: "",
      token: { access_token: accessToken, token_type: "bearer", expires_in: 3600, refresh_token: "r1", expires_at: expiresAt * 1000 },
    }));
    localStorage.setItem("planning:install-notice-dismissed-v1", "1");
    localStorage.setItem("planning:guide-seen-v1:u-maj", "1");
    document.cookie = `nf_jwt=${accessToken}; path=/`;
  }, { accessToken: token, expiresAt: exp });
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "Indisponible" } }));
  await page.route("**/api/calendar", (route) => route.fulfill({
    json: { email: "agent@example.test", entries: [], form_profile: { full_name: "Agent", group: "2", signature: "", status: "fonctionnaire", work_quota: "full" } },
  }));
  await openControlled(page, appShell);
}

/** Les fichiers que le service worker télécharge dès son installation. */
function precacheList() {
  const match = /const PRECACHE = (\[[^\]]*\]);/.exec(readFileSync(SW_FILE, "utf8"));
  return JSON.parse(match?.[1] ?? "[]") as string[];
}

async function cachedPaths(page: Page) {
  return page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.startsWith("planning-solo-"));
    const requests = name ? await (await caches.open(name)).keys() : [];
    return requests.map((request) => new URL(request.url).pathname);
  });
}

test("dès la première visite, toute l’application est en cache et s’ouvre hors ligne", async ({ page, context }) => {
  const expected = precacheList();
  // Le code de chaque écran, ses styles et ses polices : pas seulement l'accueil.
  expect(expected.filter((path) => path.startsWith("/assets/") && path.endsWith(".js")).length).toBeGreaterThan(20);
  expect(expected.some((path) => path.endsWith(".css"))).toBe(true);
  expect(expected.some((path) => path.startsWith("/fonts/"))).toBe(true);

  // Une seule visite, sans rien rouvrir : l'installation suffit.
  await page.goto("/");
  await expect(shell(page)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(async () => {
    const cached = new Set(await cachedPaths(page));
    return expected.filter((path) => !cached.has(path));
  }).toEqual([]);

  // Le cache porte l'empreinte de la version construite, pas le nom de départ.
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some((name) => /^planning-solo-[0-9a-f]{12}$/.test(name))).toBe(true);
  expect(cacheNames).not.toContain("planning-solo-v1");

  await context.setOffline(true);
  await page.reload();
  await expect(shell(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await context.setOffline(false);
});

test("un fichier non préchargé entre dans le cache dès sa première utilisation", async ({ page }) => {
  await openControlled(page);
  // Une grande photo d'en-tête n'est pas téléchargée d'avance : elle doit être
  // gardée dès qu'elle sert. Avant correction, la copie arrivait trop tard et
  // rien n'entrait dans le cache.
  expect(precacheList()).not.toContain("/header-art.jpg");
  await page.evaluate(() => fetch("/header-art.jpg").then((response) => response.blob()));
  await expect.poll(() => cachedPaths(page)).toContain("/header-art.jpg");
});

/** Publie une nouvelle version en réécrivant sw.js, version.json et index.html.
 *  Rend de quoi revenir aux fichiers construits. */
function publish(build: string) {
  const swSource = readFileSync(SW_FILE, "utf8");
  const versionSource = readFileSync(VERSION_FILE, "utf8");
  const indexSource = readFileSync(INDEX_FILE, "utf8");
  writeFileSync(SW_FILE, swSource.replace(/const CACHE = "[^"]*";/, `const CACHE = "planning-solo-${build}";`));
  writeFileSync(VERSION_FILE, `${JSON.stringify({ version: build })}\n`);
  writeFileSync(INDEX_FILE, indexSource.replace(/<meta name="app-version" content="[^"]*" \/>/, `<meta name="app-version" content="${build}" />`));
  return () => {
    writeFileSync(SW_FILE, swSource);
    writeFileSync(VERSION_FILE, versionSource);
    writeFileSync(INDEX_FILE, indexSource);
  };
}

/** Simule un cache bloqué : version.json annonce une nouvelle version mais
 *  index.html et sw.js restent sur l'ancienne. */
function publishStuckVersion(build: string) {
  const versionSource = readFileSync(VERSION_FILE, "utf8");
  writeFileSync(VERSION_FILE, `${JSON.stringify({ version: build })}\n`);
  return () => writeFileSync(VERSION_FILE, versionSource);
}

/** La version qui sert la page : celle dont le cache reste seul, une fois
 *  l'ancien effacé par la nouvelle à sa prise de main. */
async function servingBuild(page: Page) {
  try {
    return await page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) return null;
      const names = (await caches.keys()).filter((name) => name.startsWith("planning-solo-"));
      return names.length === 1 ? names[0].replace("planning-solo-", "") : null;
    });
  } catch {
    // Rechargement automatique en cours : le poll suivant lira la nouvelle page.
    return null;
  }
}

/** Avance l'horloge de la page (Date.now), sans attendre pour de vrai. */
function advanceClock(page: Page, ms: number) {
  return page.evaluate((ms) => {
    const clock = window as unknown as { realNow?: () => number; offset: number };
    if (!clock.realNow) {
      clock.realNow = Date.now.bind(Date);
      clock.offset = 0;
      Date.now = () => (clock.realNow as () => number)() + clock.offset;
    }
    clock.offset += ms;
  }, ms);
}

/** L'application passe en arrière-plan, ou revient au premier plan. */
function setVisibility(page: Page, state: "hidden" | "visible") {
  return page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => state === "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

const markPage = (page: Page) => page.evaluate(() => { (window as unknown as { leftHere: boolean }).leftHere = true; });
const pageMarked = (page: Page) => page.evaluate(() => (window as unknown as { leftHere?: boolean }).leftHere === true);
const updateNow = (page: Page) => page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration?.update()));

const updateDialog = (page: Page) => page.getByRole("alertdialog", { name: "Une mise à jour est disponible" });

test("au retour après une absence, la dernière version s’installe automatiquement et le toast reste au-dessus des onglets", async ({ page }) => {
  await openSignedIn(page);
  const oldCache = (await page.evaluate(() => caches.keys())).find((name) => name.startsWith("planning-solo-"));
  await setVisibility(page, "hidden");
  const restore = publish("nouvelle1");
  try {
    await advanceClock(page, 5 * 60_000);
    await markPage(page);
    const reloaded = page.waitForEvent("load");
    await setVisibility(page, "visible");
    await reloaded;
    expect(await pageMarked(page)).toBe(false);
    await expect(appShell(page)).toBeVisible();
    await expect.poll(() => servingBuild(page)).toBe("nouvelle1");
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain(oldCache);
    await expect(updateDialog(page)).toHaveCount(0);
    // Le toast de confirmation apparaît sans recouvrir la barre de navigation.
    const toast = page.locator(".success-toast");
    await expect(toast).toContainText("Application mise à jour.");
    const [toastBox, dockBox] = await Promise.all([
      toast.boundingBox(),
      page.locator(".section-dock").boundingBox(),
    ]);
    expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(dockBox!.y);
  } finally {
    restore();
  }
});

test("pendant une consultation calme, une nouvelle version s’installe automatiquement", async ({ page }) => {
  await openSignedIn(page);
  const oldCache = (await page.evaluate(() => caches.keys())).find((name) => name.startsWith("planning-solo-"));
  expect(oldCache).toBeTruthy();
  const restore = publish("nouvelle1");
  try {
    await markPage(page);
    const reloaded = page.waitForEvent("load");
    await updateNow(page);
    await reloaded;
    expect(await pageMarked(page)).toBe(false);
    await expect(appShell(page)).toBeVisible();
    await expect.poll(() => servingBuild(page)).toBe("nouvelle1");
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain(oldCache);
    await expect(updateDialog(page)).toHaveCount(0);
  } finally {
    restore();
  }
});

test("un texte en cours de saisie n’est pas perdu : la mise à jour patiente puis s’applique dès la fin", async ({ page }) => {
  await openControlled(page);
  const email = page.getByLabel("Adresse e-mail");
  await email.fill("mika@exemple.fr");
  const restore = publish("nouvelle1");
  try {
    await markPage(page);
    await updateNow(page);
    await expect.poll(() => page.evaluate(() =>
      navigator.serviceWorker.getRegistration().then((registration) => Boolean(registration?.waiting)))).toBe(true);
    await page.waitForTimeout(1500);
    expect(await pageMarked(page)).toBe(true);
    await expect(email).toHaveValue("mika@exemple.fr");
    // Une fois la saisie quittée, la mise à jour s'applique d'elle-même.
    const reloaded = page.waitForEvent("load");
    await email.blur();
    await reloaded;
    expect(await pageMarked(page)).toBe(false);
    await expect.poll(() => servingBuild(page)).toBe("nouvelle1");
  } finally {
    restore();
  }
});

test("rouverte après une publication, l’application charge automatiquement la nouvelle version", async ({ page }) => {
  await openSignedIn(page);
  const restore = publish("nouvelle1");
  try {
    await page.reload();
    await expect(appShell(page)).toBeVisible();
    await expect.poll(() => servingBuild(page), { timeout: 30_000 }).toBe("nouvelle1");
    await expect(updateDialog(page)).toHaveCount(0);
  } finally {
    restore();
  }
});

test("si la mise à jour automatique échoue (cache bloqué), le message manuel apparaît sans boucler", async ({ page }) => {
  await openSignedIn(page);
  const restore = publishStuckVersion("bloquee99999");
  try {
    // 1re détection via version.json : une tentative automatique de rechargement.
    const reloaded = page.waitForEvent("load");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await reloaded;
    await expect(appShell(page)).toBeVisible();
    // La page est toujours sur l'ancienne empreinte : pas de boucle, le message apparaît.
    await expect(updateDialog(page)).toBeVisible({ timeout: 15_000 });
    await expect(updateDialog(page)).toContainText("La mise à jour automatique n’a pas pu se charger correctement");
    await markPage(page);
    await page.waitForTimeout(1500);
    expect(await pageMarked(page)).toBe(true);
    // Après « Plus tard », la fenêtre ne revient qu'après une vraie absence.
    await updateDialog(page).getByRole("button", { name: "Plus tard" }).click();
    await expect(updateDialog(page)).toHaveCount(0);
    await setVisibility(page, "hidden");
    await advanceClock(page, 10_000);
    await setVisibility(page, "visible");
    await page.waitForTimeout(400);
    await expect(updateDialog(page)).toHaveCount(0);
    await setVisibility(page, "hidden");
    await advanceClock(page, 5 * 60_000);
    await setVisibility(page, "visible");
    await expect(updateDialog(page)).toBeVisible();
  } finally {
    restore();
  }
});
