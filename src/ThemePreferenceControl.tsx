import { useEffect, useState } from "react";
import { currentResolvedTheme, setThemePreference, THEME_CHANGE_EVENT } from "./theme";

/** Interrupteur du mode sombre, dans le menu du compte. Tant qu'on n'y a pas
 *  touché, l'application suit l'apparence du téléphone ; dès qu'on bascule,
 *  le choix est mémorisé. */
export function ThemeSwitch() {
  const [dark, setDark] = useState(() => currentResolvedTheme() === "dark");

  useEffect(() => {
    const update = () => setDark(currentResolvedTheme() === "dark");
    window.addEventListener(THEME_CHANGE_EVENT, update);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, update);
  }, []);

  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={dark}
      className={`account-menu-theme${dark ? " active" : ""}`}
      onClick={() => setThemePreference(dark ? "light" : "dark")}
    >
      <span className="account-menu-theme-copy">
        <strong>Mode sombre</strong>
        <small>{dark ? "Activé" : "Désactivé"}</small>
      </span>
      <span className="account-menu-switch" aria-hidden="true"><i /></span>
    </button>
  );
}
