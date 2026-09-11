import { useState } from "react";
import {
  hasDismissedAppleInstall,
  readInstallEnvironment,
  rememberAppleInstallDismissed,
  shouldGuideAppleInstall,
} from "./iosInstall";

/**
 * Sur iPhone et iPad, aucun site ne peut déclencher l'installation : Safari
 * n'expose pas `beforeinstallprompt`, et le geste appartient à la personne.
 * On ne propose donc pas un bouton qui installe, mais la marche à suivre —
 * écartable, et rappelée en permanence dans le menu.
 */
export function AppleInstallNotice({ enabled }: { enabled: boolean }) {
  const [dismissed, setDismissed] = useState(() =>
    typeof localStorage === "undefined"
      ? false
      : hasDismissedAppleInstall(localStorage),
  );
  const [guide] = useState(() =>
    typeof navigator === "undefined"
      ? false
      : shouldGuideAppleInstall(readInstallEnvironment()),
  );

  if (!enabled || !guide || dismissed) return null;

  return (
    <section className="important-alert apple-install-notice" aria-live="polite">
      <span className="apple-install-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15V3" />
          <path d="m8 7 4-4 4 4" />
          <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
        </svg>
      </span>
      <div>
        <strong>Ajouter Planning Solo à votre écran d’accueil</strong>
        <small>
          Touchez <b>Partager</b> dans la barre de Safari, puis{" "}
          <b>Sur l’écran d’accueil</b>. L’application s’ouvrira ensuite comme
          une vraie application, en plein écran.
        </small>
      </div>
      <button
        type="button"
        className="apple-install-dismiss"
        onClick={() => {
          setDismissed(true);
          if (typeof localStorage !== "undefined")
            rememberAppleInstallDismissed(localStorage);
        }}
      >
        Plus tard
      </button>
    </section>
  );
}
