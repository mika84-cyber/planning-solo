import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./dataManagement.css";
import { isDemoInstallationLink } from "./useInstallPrompt";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

const installationDemo = isDemoInstallationLink(
  window.location.hostname,
  window.location.search,
);

if ("serviceWorker" in navigator && !installationDemo) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      let reloadingForUpdate = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloadingForUpdate) return;
        reloadingForUpdate = true;
        window.location.reload();
      });

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
          window.setInterval(checkForUpdate, 15 * 60 * 1000);
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
