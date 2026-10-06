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

test("le service worker garde les fichiers de l’application et la rouvre hors ligne", async ({ page, context }) => {
  await openControlled(page);
  // Les fichiers chargés sous son contrôle entrent dans le cache : avant
  // correction, seuls les six fichiers de départ y étaient, et l'application
  // s'ouvrait sur une page blanche sans réseau.
  await page.reload();
  await expect(shell(page)).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.startsWith("planning-solo-"));
    const requests = name ? await (await caches.open(name)).keys() : [];
    return requests.filter((request) => /\/assets\/.+\.js$/.test(request.url)).length;
  })).toBeGreaterThan(2);

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
