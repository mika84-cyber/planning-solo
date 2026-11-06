/* La mise à jour de l'application installée (public/sw.js).

   Dès qu'une nouvelle version est prête, la fenêtre « Une mise à jour est
   disponible » le dit, et rien ne se recharge sans accord. Après « Plus tard »,
   elle revient quand on rouvre l'application : le téléphone rouvre la page
   laissée en arrière-plan, dans sa version d'alors, et la nouvelle ne doit pas
   y rester oubliée. */

/** Une absence plus courte, le temps de lire un message, n'est pas une réouverture. */
export const AWAY_MS = 60_000;

/** Suit les versions publiées une fois le service worker enregistré. */
export function watchAppUpdates(registration: ServiceWorkerRegistration) {
  let asked: ServiceWorker | null = null;
  let hiddenAt = 0;

  // Une fois par version ; la toute première installation n'a rien à remplacer.
  const ask = () => {
    const worker = registration.waiting;
    if (!worker || !navigator.serviceWorker.controller || asked === worker) return;
    asked = worker;
    dispatchEvent(new Event("planning-app-update-available"));
  };

  const watchInstall = (worker: ServiceWorker | null) =>
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") ask();
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
    // De retour après une absence : c'est une réouverture, on redemande.
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) asked = null;
    hiddenAt = 0;
    ask();
    checkForUpdate();
  });
  // Une version publiée se signale vite : au retour sur la fenêtre, au retour
  // du réseau et toutes les minutes.
  addEventListener("focus", checkForUpdate);
  addEventListener("online", checkForUpdate);
  setInterval(checkForUpdate, 60 * 1000);
  ask();
  checkForUpdate();
}
