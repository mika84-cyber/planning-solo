import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./dataManagement.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if ("serviceWorker" in navigator) {
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
