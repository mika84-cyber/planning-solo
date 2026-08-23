import type { ResolvedTheme, ThemePreference } from "./theme";

type ThemePreferenceControlProps = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  onChange: (preference: ThemePreference) => void;
};

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: string;
}> = [
  { value: "system", label: "Auto", icon: "◐" },
  { value: "light", label: "Clair", icon: "☀" },
  { value: "dark", label: "Sombre", icon: "☾" },
];

export function ThemePreferenceControl({
  preference,
  resolvedTheme,
  onChange,
}: ThemePreferenceControlProps) {
  return (
    <section className="theme-preference-control" aria-labelledby="theme-preference-title">
      <div className="theme-preference-heading">
        <strong id="theme-preference-title">Apparence</strong>
        <small>{preference === "system" ? `Automatique · ${resolvedTheme === "dark" ? "sombre" : "clair"}` : "Choix mémorisé"}</small>
      </div>
      <div className="theme-preference-options" role="radiogroup" aria-label="Choisir l’apparence">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            className={preference === option.value ? "active" : ""}
            onClick={() => onChange(option.value)}
          >
            <span aria-hidden="true">{option.icon}</span>
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
