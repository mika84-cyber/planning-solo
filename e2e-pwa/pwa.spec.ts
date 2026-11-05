import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* L'application installable, telle qu'elle est publiée : le service worker se
   met en place, garde de quoi rouvrir l'application sans réseau, et une
   nouvelle version publiée est signalée puis remplace l'ancienne avec son
   cache. La démonstration n'existe qu'en développement : ces tests passent
   donc par l'écran de connexion, premier écran qu'on doit pouvoir rouvrir. */

/** Le service worker servi par scripts/serve-dist.mjs, relu à chaque demande. */
const SW_FILE = "dist-pwa-e2e/sw.js";
/** La page servie pour toutes les adresses de l'application. */
const PAGE_FILE = "dist-pwa-e2e/index.html";

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

/** Publie une nouvelle version en réécrivant sw.js (autre nom de cache), et
 *  la page avec si elle a aussi été rechargée depuis le réseau. Rend de quoi
 *  revenir aux fichiers construits. */
function publish(build: string, { withPage = false } = {}) {
  const swSource = readFileSync(SW_FILE, "utf8");
  const pageSource = readFileSync(PAGE_FILE, "utf8");
  writeFileSync(SW_FILE, swSource.replace(/const CACHE = "[^"]*";/, `const CACHE = "planning-solo-${build}";`));
  if (withPage) writeFileSync(PAGE_FILE, pageSource.replace(/<meta name="planning-build" content="[^"]*"/, `<meta name="planning-build" content="${build}"`));
  return () => {
    writeFileSync(SW_FILE, swSource);
    writeFileSync(PAGE_FILE, pageSource);
  };
}

/** La version qui sert la page : celle dont le cache reste seul, une fois
 *  l'ancien effacé par la nouvelle à sa prise de main. */
function servingBuild(page: Page) {
  return page.evaluate(async () => {
    if (!navigator.serviceWorker.controller) return null;
    const names = (await caches.keys()).filter((name) => name.startsWith("planning-solo-"));
    return names.length === 1 ? names[0].replace("planning-solo-", "") : null;
  });
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
const announcement = (page: Page) => page.evaluate(() => new Promise<boolean>((resolve) => {
  window.addEventListener("planning-app-update-available", () => resolve(true), { once: true });
}));

test("au retour après une absence, l’application rouvre d’elle-même dans la dernière version", async ({ page }) => {
  await openControlled(page);
  const oldCache = (await page.evaluate(() => caches.keys())).find((name) => name.startsWith("planning-solo-"));
  // On s'en est servi, puis l'application est restée en arrière-plan
  // pendant qu'une nouvelle version était publiée.
  await advanceClock(page, 2 * 60_000);
  await setVisibility(page, "hidden");
  const restore = publish("nouvelle1");
  try {
    await advanceClock(page, 5 * 60_000);
    await markPage(page);
    const reloaded = page.waitForEvent("load");
    await setVisibility(page, "visible");
    await reloaded;
    expect(await pageMarked(page)).toBe(false);
    await expect(shell(page)).toBeVisible();
    await expect.poll(() => servingBuild(page)).toBe("nouvelle1");
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain(oldCache);
  } finally {
    restore();
  }
});

test("pendant qu’on s’en sert, une nouvelle version est signalée et attend l’accord", async ({ page }) => {
  await openControlled(page);
  const oldCache = (await page.evaluate(() => caches.keys())).find((name) => name.startsWith("planning-solo-"));
  expect(oldCache).toBeTruthy();
  // Le lancement est passé : on se sert de l'application.
  await advanceClock(page, 2 * 60_000);
  const restore = publish("nouvelle1");
  try {
    await markPage(page);
    // L'application écoute l'événement qui ouvre la fenêtre « Une mise à jour
    // est disponible » : il doit partir sans rechargement automatique.
    const announced = announcement(page);
    await updateNow(page);
    expect(await announced).toBe(true);
    await expect.poll(() => page.evaluate(() =>
      navigator.serviceWorker.getRegistration().then((registration) => Boolean(registration?.waiting)))).toBe(true);
    await page.waitForTimeout(1500);
    expect(await pageMarked(page)).toBe(true);
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
    restore();
  }
});

test("à l’ouverture, un texte en cours de saisie n’est pas perdu : la mise à jour est proposée", async ({ page }) => {
  await openControlled(page);
  const email = page.getByLabel("Adresse e-mail");
  await email.fill("mika@exemple.fr");
  const restore = publish("nouvelle1");
  try {
    await markPage(page);
    const announced = announcement(page);
    await updateNow(page);
    expect(await announced).toBe(true);
    await page.waitForTimeout(1500);
    expect(await pageMarked(page)).toBe(true);
    await expect(email).toHaveValue("mika@exemple.fr");
  } finally {
    restore();
  }
});

test("une page déjà à jour adopte son service worker, sans fenêtre ni rechargement", async ({ page }) => {
  await page.addInitScript(() => {
    const counter = window as unknown as { announcements: number };
    counter.announcements = 0;
    window.addEventListener("planning-app-update-available", () => { counter.announcements += 1; });
  });
  await openControlled(page);
  const oldCache = (await page.evaluate(() => caches.keys())).find((name) => name.startsWith("planning-solo-"));
  // Publiée pendant que l'application était fermée : on la rouvre, la page
  // vient du réseau dans la nouvelle version, l'ancien service worker sert
  // encore et le nouveau s'installe derrière.
  const restore = publish("nouvelle1", { withPage: true });
  try {
    await page.reload();
    await expect(shell(page)).toBeVisible();
    await markPage(page);
    await expect.poll(() => servingBuild(page)).toBe("nouvelle1");
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain(oldCache);
    expect(await pageMarked(page)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { announcements: number }).announcements)).toBe(0);
  } finally {
    restore();
  }
});

test("après « Plus tard », la version téléchargée s’ouvre au retour, même hors connexion", async ({ page, context }) => {
  await openControlled(page);
  await advanceClock(page, 2 * 60_000);
  const restore = publish("nouvelle1");
  try {
    const announced = announcement(page);
    await updateNow(page);
    expect(await announced).toBe(true);
    await expect.poll(() => page.evaluate(() =>
      navigator.serviceWorker.getRegistration().then((registration) => Boolean(registration?.waiting)))).toBe(true);
    // « Plus tard » : on quitte l'application, et on la rouvre sans réseau.
    await setVisibility(page, "hidden");
    await context.setOffline(true);
    await advanceClock(page, 5 * 60_000);
    await markPage(page);
    const reloaded = page.waitForEvent("load");
    await setVisibility(page, "visible");
    await reloaded;
    expect(await pageMarked(page)).toBe(false);
    await expect(shell(page)).toBeVisible();
    await expect.poll(() => servingBuild(page)).toBe("nouvelle1");
  } finally {
    await context.setOffline(false);
    restore();
  }
});
