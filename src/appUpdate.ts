import { rememberScreenBeforeUpdate } from "./updateResume";

/* Mise à jour automatique de l'application installée (public/sw.js + version.json).
   Dès qu'une version est prête et qu'aucune saisie n'est en cours, elle s'active
   seule et rouvre sur le même écran. La fenêtre manuelle n'apparaît que si la
   mise à jour automatique a échoué (timeout, cache bloqué sur une ancienne
   version ou erreur de chargement d'écran). */

/** Une absence plus courte, le temps de lire un message, n'est pas une réouverture. */
export const AWAY_MS = 60_000;
/** Délai maximal attendu pour le passage de relais du service worker. */
export const UPDATE_TIMEOUT_MS = 4_000;
/** Clé sessionStorage anti-boucle : une seule tentative automatique par version. */
export const AUTO_ATTEMPT_KEY = "planning:auto-update-attempt";

/** Vrai quand une fenêtre, une sélection sur le planning ou une saisie est en cours. */
export function isUserEditing() {
  const active = document.activeElement as { tagName?: string; isContentEditable?: boolean } | null;
  if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName || "") || active.isContentEditable)) return true;
  return Boolean(document.querySelector?.('[role="dialog"]:not(.expo-notices),[role="alertdialog"],.request-panel,.calendar-delete-panel,.cet-window-reminder-balance'));
}

/** Empreinte de la version en mémoire, posée dans index.html par stamp-sw.mjs. */
export function currentAppVersion() {
  return document.querySelector?.('meta[name="app-version"]')?.getAttribute("content") || "";
}

function readAttempt(): { target: string; at: number } | null {
  try {
    const raw = sessionStorage.getItem(AUTO_ATTEMPT_KEY);
    return raw ? (JSON.parse(raw) as { target: string; at: number }) : null;
  } catch {
    return null;
  }
}

function saveAttempt(target: string) {
  try { sessionStorage.setItem(AUTO_ATTEMPT_KEY, JSON.stringify({ target, at: Date.now() })); } catch {}
}

export function clearAutoUpdateAttempt() {
  try { sessionStorage.removeItem(AUTO_ATTEMPT_KEY); } catch {}
}

/** Suit les versions publiées une fois le service worker enregistré. */
export function watchAppUpdates(registration: ServiceWorkerRegistration) {
  let applying = false;
  let failed = false;
  let notifiedFailure = false;
  let pendingTarget = "";
  let deferTimer: ReturnType<typeof setInterval> | null = null;
  let hiddenAt = 0;

  const stopDefer = () => {
    if (deferTimer !== null) {
      clearInterval(deferTimer);
      deferTimer = null;
    }
  };

  const signalFailure = () => {
    failed = true;
    applying = false;
    pendingTarget = "";
    stopDefer();
    if (notifiedFailure) return;
    notifiedFailure = true;
    dispatchEvent(new Event("planning-app-update-available"));
  };

  const reloadApp = () => {
    rememberScreenBeforeUpdate();
    location.reload();
  };

  const tryAutoApply = (target?: string, readyWorker?: ServiceWorker | null) => {
    if (!navigator.serviceWorker.controller || applying) return;
    const wanted = target || pendingTarget || currentAppVersion() || "sw";
    if (document.hidden || isUserEditing()) {
      pendingTarget = wanted;
      if (!document.hidden && deferTimer === null) deferTimer = setInterval(() => tryAutoApply(), 2_000);
      return;
    }
    const last = readAttempt();
    if (last && last.target === wanted && Date.now() - last.at < 2 * 60_000) {
      signalFailure();
      return;
    }
    applying = true;
    pendingTarget = "";
    stopDefer();
    saveAttempt(wanted);
    const waiting = readyWorker || registration.waiting;
    if (!waiting) {
      reloadApp();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reloadApp();
    };
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      navigator.serviceWorker.removeEventListener?.("controllerchange", finish);
      signalFailure();
    }, UPDATE_TIMEOUT_MS);
    navigator.serviceWorker.addEventListener?.("controllerchange", finish, { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const checkServerVersion = async () => {
    const local = currentAppVersion();
    if (!local || typeof fetch !== "function") return;
    try {
      const res = await fetch("/version.json", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      const remote = data.version;
      if (!remote) return;
      if (remote === local) {
        clearAutoUpdateAttempt();
        return;
      }
      await registration.update().catch(() => {});
      if (registration.installing) {
        pendingTarget = remote;
        return;
      }
      tryAutoApply(remote);
    } catch {
      // Hors connexion ou version.json absent : on ignore.
    }
  };

  const watchInstall = (worker: ServiceWorker | null) =>
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") tryAutoApply(undefined, worker);
    });
  watchInstall(registration.installing);
  registration.addEventListener("updatefound", () => watchInstall(registration.installing));

  const checkForUpdate = () => {
    if (document.hidden) return;
    void registration.update().catch(() => {});
    void checkServerVersion();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      stopDefer();
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) notifiedFailure = false;
    hiddenAt = 0;
    if (failed) signalFailure();
    else if (registration.waiting || pendingTarget) tryAutoApply();
    checkForUpdate();
  });
  document.addEventListener("focusout", () => {
    if (pendingTarget) setTimeout(() => tryAutoApply(), 50);
  });
  addEventListener("vite:preloadError", (event) => {
    event.preventDefault?.();
    tryAutoApply("preload");
  });
  addEventListener("focus", checkForUpdate);
  addEventListener("online", checkForUpdate);
  setInterval(checkForUpdate, 60 * 1000);
  if (registration.waiting) tryAutoApply();
  checkForUpdate();
}
