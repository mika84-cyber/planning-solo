import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./dataManagement.css";
import { applyInitialTheme } from "./theme";

applyInitialTheme();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
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
    // En développement, un ancien cache PWA peut masquer les changements et
    // faire croire qu'une correction locale ne fonctionne pas. La production
    // conserve naturellement son mode hors ligne.
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
  }
}
