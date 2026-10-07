import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* L'application installable, telle qu'elle est publiée : le service worker se
   met en place, garde de quoi rouvrir l'application sans réseau, et une
   nouvelle version publiée est signalée puis remplace l'ancienne avec son
   cache. La démonstration n'existe qu'en développement : ces tests passent
   donc par l'écran de connexion, premier écran qu'on doit pouvoir rouvrir. */

/** Le service worker servi par scripts/serve-dist.mjs, relu à chaque demande. */
const SW_FILE = "dist-pwa-e2e/sw.js";

const shell = (page: Page) => page.getByRole("heading", { name: "Votre planning" });

async function openControlled(page: Page) {
  await page.goto("/");
  await expect(shell(page)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await expect(shell(page)).toBeVisible();
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
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

test("une nouvelle version publiée est signalée, puis remplace l’ancienne et son cache", async ({ page }) => {
  await openControlled(page);
  const oldCache = (await page.evaluate(() => caches.keys())).find((name) => name.startsWith("planning-solo-"));
  expect(oldCache).toBeTruthy();

  // Une publication change le service worker : on réécrit sw.js avec un
  // autre nom de cache, comme le ferait une nouvelle version construite.
  const original = readFileSync(SW_FILE, "utf8");
  writeFileSync(SW_FILE, original.replace(/const CACHE = "[^"]*";/, 'const CACHE = "planning-solo-nouvelle1";'));
  try {
    // L'application écoute l'événement qui ouvre la fenêtre « Une mise à jour
    // est disponible » : il doit partir sans rechargement automatique.
    const announced = page.evaluate(() => new Promise<boolean>((resolve) => {
      window.addEventListener("planning-app-update-available", () => resolve(true), { once: true });
    }));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration?.update()));
    expect(await announced).toBe(true);
    await expect.poll(() => page.evaluate(() =>
      navigator.serviceWorker.getRegistration().then((registration) => Boolean(registration?.waiting)))).toBe(true);
    await expect(shell(page)).toBeVisible();

    // Confirmée, la nouvelle version prend la main et efface l'ancien cache.
    await page.evaluate(() => new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
      void navigator.serviceWorker.getRegistration().then((registration) =>
        registration?.waiting?.postMessage({ type: "SKIP_WAITING" }));
    }));
    await expect.poll(() => page.evaluate(() => caches.keys())).toContain("planning-solo-nouvelle1");
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain(oldCache);
  } finally {
    writeFileSync(SW_FILE, original);
  }
});
