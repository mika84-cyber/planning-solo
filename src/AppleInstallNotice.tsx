import { useState } from "react";
import {
  type AppleInstallGesture,
  appleInstallGesture,
  hasDismissedAppleInstall,
  readInstallEnvironment,
  rememberAppleInstallDismissed,
  shouldGuideAppleInstall,
} from "./iosInstall";

/**
 * Sur iPhone et iPad, aucun site ne peut déclencher l'installation : Safari
 * n'expose pas `beforeinstallprompt`, et le geste appartient à la personne.
 * On ne propose donc pas un bouton qui installe, mais la marche à suivre —
 * écartable, et différente selon le navigateur.
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
  const [gesture] = useState<AppleInstallGesture>(() =>
    typeof navigator === "undefined"
      ? "share"
      : appleInstallGesture(navigator.userAgent),
  );

  if (!enabled || !guide || dismissed) return null;

  return (
    <section className="important-alert apple-install-notice" aria-live="polite">
      <span className="apple-install-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {gesture === "menu" ? (
            <>
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </>
          ) : (
            <>
              <path d="M12 15V3" />
              <path d="m8 7 4-4 4 4" />
              <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
            </>
          )}
        </svg>
      </span>
      <div>
        <strong>Ajouter Planning Solo à votre écran d’accueil</strong>
        <small>
          {gesture === "share" ? (
            <>
              Touchez <b>Partager</b> dans la barre du bas, puis{" "}
              <b>Sur l’écran d’accueil</b>.
            </>
          ) : null}
          {gesture === "menu" ? (
            <>
              Touchez le menu <b>⋯</b> en haut à droite, puis{" "}
              <b>Ajouter à l’écran d’accueil</b>.
            </>
          ) : null}
          {gesture === "other" ? (
            <>
              Si votre navigateur ne le propose pas, ouvrez le planning dans{" "}
              <b>Safari</b> : le bouton <b>Partager</b> permet alors{" "}
              <b>Sur l’écran d’accueil</b>.
            </>
          ) : null}{" "}
          L’application s’ouvrira ensuite en plein écran.
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
