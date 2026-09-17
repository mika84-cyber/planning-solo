import { useEffect, useState } from "react";
import {
  currentResolvedTheme,
  readThemePreference,
  setThemePreference,
  THEME_CHANGE_EVENT,
  type ThemePreference,
} from "./theme";

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

/** Apparence : automatique (suit le téléphone), claire ou sombre. */
export function ThemePreferenceControl() {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference());
  const [resolved, setResolved] = useState(() => currentResolvedTheme());

  useEffect(() => {
    const update = () => {
      setPreference(readThemePreference());
      setResolved(currentResolvedTheme());
    };
    window.addEventListener(THEME_CHANGE_EVENT, update);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, update);
  }, []);

  return (
    <div className="main-menu-theme">
      <span className="main-menu-index" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
      </span>
      <span className="main-menu-copy">
        <strong id="theme-preference-title">Apparence</strong>
        <small>{preference === "system" ? `Automatique · ${resolved === "dark" ? "sombre" : "clair"}` : preference === "dark" ? "Mode sombre" : "Mode clair"}</small>
      </span>
      <div className="main-menu-theme-options" role="radiogroup" aria-label="Choisir l’apparence">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            className={preference === option.value ? "active" : ""}
            onClick={() => setThemePreference(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
