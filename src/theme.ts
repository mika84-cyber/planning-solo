export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "planning:theme-preference-v2";
export const THEME_CHANGE_EVENT = "planning-theme-change";

const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#10233f", dark: "#141110" };

export function normalizeThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  return preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function currentResolvedTheme(): ResolvedTheme {
  return resolveTheme(readThemePreference(), systemPrefersDark());
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference, systemPrefersDark());
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
  // La conversion sombre n'est chargée que si elle sert ; en clair, on retire
  // simplement la feuille qu'elle avait posée.
  if (resolved === "dark") void import("./darkStyles").then(({ syncDarkStyles }) => syncDarkStyles(currentResolvedTheme() === "dark"));
  else document.getElementById("planning-dark-theme")?.remove();
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { preference, resolved } }));
  return resolved;
}

/** Au lancement : applique le choix mémorisé, puis suit le système quand le
 *  choix est « Automatique ». */
export function initTheme() {
  if (typeof window === "undefined") return;
  applyTheme(readThemePreference());
  if (typeof window.matchMedia !== "function") return;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (readThemePreference() === "system") applyTheme("system");
  });
}

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Le thème reste actif pour la session si le stockage est indisponible.
  }
  return applyTheme(preference);
}
