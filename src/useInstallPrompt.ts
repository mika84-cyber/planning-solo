import { useEffect, useState } from "react";

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isNetlifyDeployPreview(hostname: string) {
  return /^deploy-preview-\d+--planning-solo\.netlify\.app$/i.test(hostname);
}

export function isDemoInstallationLink(hostname: string, search: string) {
  return (
    isNetlifyDeployPreview(hostname) ||
    new URLSearchParams(search).has("demo")
  );
}

export function canEnableInstallation(
  authStatus: string,
  demoMode: boolean,
  hostname: string,
  search: string,
) {
  return (
    authStatus === "ready" &&
    !demoMode &&
    !isDemoInstallationLink(hostname, search)
  );
}

/** Le manifeste et l'icône d'installation ne sont exposés qu'une fois le
 * compte authentifié. La page publique de connexion et les démos restent de
 * simples pages web, sans proposition PWA. */
export function setInstallMetadataEnabled(enabled: boolean) {
  document
    .querySelectorAll<HTMLLinkElement>('link[data-planning-install="true"]')
    .forEach((link) => link.remove());
  if (!enabled) return;
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "/manifest.webmanifest";
  manifest.dataset.planningInstall = "true";
  document.head.append(manifest);
  const appleIcon = document.createElement("link");
  appleIcon.rel = "apple-touch-icon";
  appleIcon.href = "/planning-icon-v3-apple.png";
  appleIcon.dataset.planningInstall = "true";
  document.head.append(appleIcon);
}

export function useInstallPrompt(enabled = true) {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      // Netlify injecte sa barre d'outils dans les deploy previews. Une PWA
      // installée depuis cette adresse conserverait donc cette barre.
      if (!enabled || isDemoInstallationLink(location.hostname, location.search))
        return;
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
    if (!enabled) setInstallPrompt(null);
  }, [enabled]);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return { installPrompt, installApp };
}
