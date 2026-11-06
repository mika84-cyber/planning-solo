import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./styles/16-work-accident.css";
import "./dataManagement.css";
import "./styles/19-leave-page.css";
import "./productRefinements.css";
import "./planningCalendarRefinement.css";
import "./pageHeaders.css";
import "./darkTheme.css";
import { initTheme } from "./theme";
import { watchAppUpdates } from "./appUpdate";

// Le thème est posé avant le premier rendu : pas d'éclair clair au lancement.
initTheme();

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if ("serviceWorker" in navigator) {
  const publicDemoBuild = Boolean(import.meta.env.VITE_PUBLIC_DEMO_UNTIL);
  if (import.meta.env.PROD && !publicDemoBuild) {
    window.addEventListener("load", () => {
      // Une nouvelle version prête : la fenêtre « Une mise à jour est
      // disponible » laisse choisir le moment (appUpdate.ts).
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(watchAppUpdates)
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
