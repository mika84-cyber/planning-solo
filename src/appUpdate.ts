import { rememberScreenBeforeUpdate, resumedScreen } from "./updateResume";

/* La mise à jour de l'application installée (public/sw.js).

   Ouvrir l'application, c'est trouver sa dernière version. Au lancement, la
   page vient du réseau : elle est à jour, et le service worker de sa version,
   qui s'installe derrière elle, prend la main sans rien demander. Au retour
   après une absence, le téléphone rouvre la page laissée en arrière-plan,
   dans sa version d'alors : si une version plus récente est prête, la page se
   recharge d'elle-même et rouvre là où l'on était (updateResume). Hors
   connexion, c'est la dernière version téléchargée qui s'ouvre.

   Pendant qu'on se sert de l'application, ou si une fenêtre est ouverte ou un
   texte en cours de saisie, rien ne se recharge : la fenêtre « Une mise à jour
   est disponible » laisse choisir le moment. */

/** Après le lancement ou le retour, le temps de trouver et préparer la nouvelle version. */
export const OPENING_MS = 30_000;
/** Une absence plus courte, le temps de lire un message, n'est pas une réouverture. */
export const AWAY_MS = 60_000;

export type UpdateChoice = "adopt" | "reload" | "ask";

/** Ce que devient une version installée qui attend son tour : la page la
 *  porte déjà (ouverte depuis le réseau après la publication), on l'adopte
 *  sans rien recharger ; on ouvre l'application et rien n'est en cours, on
 *  recharge ; sinon, on demande. */
export function updateChoice(sameVersion: boolean, opening: boolean, busy: boolean): UpdateChoice {
  if (sameVersion) return "adopt";
  return opening && !busy ? "reload" : "ask";
}

type PageState = { activeElement: Element | null; querySelector(selector: string): Element | null };

/** Une fenêtre ouverte (sauf celle de la mise à jour) ou un texte en cours de
 *  saisie : on ne recharge pas sous les doigts. Toutes les fenêtres de
 *  l'application portent aria-modal ou sont des <dialog>. */
export function pageBusy(page: PageState = document) {
  const active = page.activeElement as HTMLInputElement | null;
  return Boolean(
    (active?.matches("textarea,input:not([type=checkbox],[type=radio])") && active.value) ||
      page.querySelector("[aria-modal=true]:not(.update-available-modal),dialog[open]"),
  );
}

/** La page porte-t-elle la version la plus récente téléchargée ? Chaque
 *  version a son cache, nommé d'après son empreinte, et le navigateur rend
 *  les caches dans leur ordre de création : le dernier est celui du service
 *  worker qui attend. */
export function isNewestBuild(cacheNames: string[], build: string | undefined) {
  return Boolean(build) && cacheNames.filter((name) => name.startsWith("planning-solo-")).pop() === `planning-solo-${build}`;
}

/** Suit les versions publiées une fois le service worker enregistré. */
export function watchAppUpdates(registration: ServiceWorkerRegistration) {
  const build = document.querySelector<HTMLMetaElement>('meta[name="planning-build"]')?.content;
  const skipWaiting = { type: "SKIP_WAITING" };
  let openedAt = Date.now();
  let hiddenAt = 0;
  let asked: ServiceWorker | null = null;
  let reloading = false;

  const settle = async () => {
    const worker = registration.waiting;
    if (!worker || reloading || !navigator.serviceWorker.controller) return;
    const sameVersion = isNewestBuild(await caches.keys(), build);
    if (worker !== registration.waiting || reloading) return;
    // Tout juste rechargée pour une mise à jour : jamais deux fois de suite.
    const justUpdated = Date.now() - (resumedScreen()?.at ?? 0) < AWAY_MS;
    const choice = updateChoice(sameVersion, Date.now() - openedAt < OPENING_MS && !justUpdated, pageBusy());
    if (choice === "adopt") worker.postMessage(skipWaiting);
    else if (choice === "reload") {
      reloading = true;
      rememberScreenBeforeUpdate();
      const reload = () => location.reload();
      navigator.serviceWorker.addEventListener("controllerchange", reload);
      worker.postMessage(skipWaiting);
      // Secours : en ligne, la page rechargée vient de toute façon du réseau.
      setTimeout(reload, 3000);
    } else if (asked !== worker) {
      asked = worker;
      dispatchEvent(new Event("planning-app-update-available"));
    }
  };

  const watchInstall = (worker: ServiceWorker | null) =>
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") void settle();
    });
  watchInstall(registration.installing);
  registration.addEventListener("updatefound", () => watchInstall(registration.installing));

  const checkForUpdate = () => {
    if (!document.hidden) void registration.update().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    // De retour après une absence : c'est une réouverture.
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) openedAt = Date.now();
    hiddenAt = 0;
    void settle();
    checkForUpdate();
  });
  // Une version publiée se signale vite : au retour sur la fenêtre, au retour
  // du réseau et toutes les minutes.
  addEventListener("focus", checkForUpdate);
  addEventListener("online", checkForUpdate);
  setInterval(checkForUpdate, 60 * 1000);
  void settle();
  checkForUpdate();
}
