import { useEffect } from "react";
import { setInstallMetadataEnabled } from "./useInstallPrompt";
import { warmUpScreens } from "./warmUpScreens";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useAuthUiState } from "./useAuthUiState";

type ShellEffectsOptions = {
  authStatus: ReturnType<typeof useAuthUiState>["authStatus"];
  isProgramAdmin: boolean;
  demoMode: boolean;
  /** L'installation sur l'écran d'accueil est proposée (compte connecté, hors démo). */
  installationEnabled: boolean;
  appShellUi: Pick<
    ReturnType<typeof useAppShellUiState>,
    "setFeedbackOpen" | "setHomeSection" | "setNarrowScreen" | "setAppUpdateAvailable" | "setAppUpdatePromptOpen"
    | "accountMenuOpen" | "setAccountMenuOpen" | "accountMenuRef" | "accountButtonRef"
    | "viewportDebugEnabled" | "setViewportSize" | "checkingAppUpdate" | "setCheckingAppUpdate"
  >;
};

/**
 * L'enveloppe de l'application : les écrans préparés au repos, les
 * paramètres d'adresse qui ouvrent une rubrique, l'installation, la largeur
 * d'écran, la mise à jour annoncée par le service worker, la fermeture des
 * menus au clavier ou au clic ailleurs, et la taille de fenêtre affichée en
 * débogage.
 */
export function useShellEffects({ authStatus, isProgramAdmin, demoMode, installationEnabled, appShellUi }: ShellEffectsOptions) {
  const {
    setFeedbackOpen, setHomeSection, setNarrowScreen, setAppUpdateAvailable, setAppUpdatePromptOpen,
    accountMenuOpen, setAccountMenuOpen, accountMenuRef, accountButtonRef,
    viewportDebugEnabled, setViewportSize, checkingAppUpdate, setCheckingAppUpdate,
  } = appShellUi;
  // Les écrans secondaires (fiche du jour, demandes, paie, formulaires…) sont
  // chargés à part : on les prépare dès que l'app est prête et au repos.
  useEffect(() => {
    if (authStatus === "ready") warmUpScreens();
  }, [authStatus]);

  useEffect(() => {
    const requestedView = new URLSearchParams(location.search).get("feedback");
    if (authStatus !== "ready" || (requestedView !== "compose" && requestedView !== "inbox")) return;
    if (requestedView === "inbox" && !isProgramAdmin) return;
    setFeedbackOpen(true);
    const url = new URL(location.href);
    url.searchParams.delete("feedback");
    history.replaceState(history.state, "", url);
  }, [authStatus, isProgramAdmin, setFeedbackOpen]);
  useEffect(() => {
    if (authStatus !== "ready" || new URLSearchParams(location.search).get("section") !== "forms") return;
    setHomeSection("forms");
    const url = new URL(location.href);
    url.searchParams.delete("section");
    history.replaceState(history.state, "", url);
  }, [authStatus, setHomeSection]);
  useEffect(() => {
    setInstallMetadataEnabled(installationEnabled);
    return () => setInstallMetadataEnabled(false);
  }, [installationEnabled]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setNarrowScreen(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [setNarrowScreen]);
  useEffect(() => {
    const showUpdateAlert = () => {
      setAppUpdateAvailable(true);
      setAppUpdatePromptOpen(true);
    };
    window.addEventListener("planning-app-update-available", showUpdateAlert);
    return () => window.removeEventListener("planning-app-update-available", showUpdateAlert);
  }, [setAppUpdateAvailable, setAppUpdatePromptOpen]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      accountButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen, accountMenuRef, accountButtonRef, setAccountMenuOpen]);
  useEffect(() => {
    if (!viewportDebugEnabled) return;
    const update = () =>
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [viewportDebugEnabled, setViewportSize]);

  async function checkForAppUpdate() {
    if (checkingAppUpdate) return;
    setCheckingAppUpdate(true);
    try {
      if (!demoMode && "serviceWorker" in navigator) {
        const registration =
          (await navigator.serviceWorker.getRegistration()) ??
          (await navigator.serviceWorker.register("/sw.js", {
            updateViaCache: "none",
          }));
        await registration.update();
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      }
    } catch {
      // Le rechargement ci-dessous reste utile même si le contrôle du service
      // worker échoue (hors connexion, navigateur ancien ou cache corrompu).
    } finally {
      window.setTimeout(() => window.location.reload(), 250);
    }
  }

  return { checkForAppUpdate };
}
