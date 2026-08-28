import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./dataManagement.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if ("serviceWorker" in navigator) {
  const publicDemoBuild = Boolean(import.meta.env.VITE_PUBLIC_DEMO_UNTIL);
  if (import.meta.env.PROD && !publicDemoBuild) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          const notifyUpdateAvailable = () =>
            window.dispatchEvent(new Event("planning-app-update-available"));
          const watchInstallingWorker = () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller)
                notifyUpdateAvailable();
            });
          };
          if (registration.waiting) notifyUpdateAvailable();
          registration.addEventListener("updatefound", watchInstallingWorker);
          const checkForUpdate = () => {
            if (document.visibilityState === "visible")
              void registration.update().catch(() => {});
          };
          checkForUpdate();
          document.addEventListener("visibilitychange", checkForUpdate);
          window.setInterval(checkForUpdate, 2 * 60 * 1000);
        })
        .catch(() => {});
    });
  } else {
    // Les builds de démonstration restent de simples pages web : aucun service
    // worker ni cache installable. En développement, cela évite aussi qu'un
    // ancien cache PWA masque les changements locaux.
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
  }
}
