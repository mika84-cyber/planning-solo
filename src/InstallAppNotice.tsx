import { useState } from "react";

export const INSTALL_NOTICE_DISMISSED_KEY = "planning:install-notice-dismissed-v1";

function hasDismissedInstallNotice() {
  try {
    return typeof localStorage !== "undefined"
      && localStorage.getItem(INSTALL_NOTICE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Pour les invités dont le navigateur sait installer l'application (Android,
 * ordinateur) et qui ne l'ont pas encore fait : un bandeau propose de
 * l'installer d'un geste. Sur iPhone et iPad, `AppleInstallNotice` explique
 * la marche à suivre, Safari ne laissant pas une page lancer l'installation.
 * Écarté, le bandeau ne revient pas ; l'entrée du menu reste disponible.
 */
export function InstallAppNotice({ available, onInstall }: { available: boolean; onInstall: () => void }) {
  const [dismissed, setDismissed] = useState(hasDismissedInstallNotice);
  if (!available || dismissed) return null;

  return (
    <section className="important-alert apple-install-notice app-install-notice" aria-labelledby="app-install-title" aria-live="polite">
      <span className="apple-install-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v11" />
          <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
          <path d="M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />
        </svg>
      </span>
      <div>
        <strong id="app-install-title">Installer Planning Solo</strong>
        <small>Ajoutez l’application à votre écran d’accueil : elle s’ouvrira en plein écran, sans passer par le navigateur.</small>
      </div>
      <div className="app-install-actions">
        <button type="button" className="app-install-button" onClick={onInstall}>Installer</button>
        <button
          type="button"
          className="apple-install-dismiss"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(INSTALL_NOTICE_DISMISSED_KEY, "1");
            } catch {
              // Sans stockage, le bandeau reviendra simplement à la prochaine visite.
            }
          }}
        >
          Plus tard
        </button>
      </div>
    </section>
  );
}
