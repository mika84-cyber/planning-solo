import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "planning:theme-preference-v1";

export function normalizeThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? systemPrefersDark ? "dark" : "light"
    : preference;
}

function readStoredPreference() {
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system" as const;
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(preference: ThemePreference, prefersDark: boolean) {
  const resolved = resolveTheme(preference, prefersDark);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function applyInitialTheme() {
  if (typeof window === "undefined") return;
  applyTheme(readStoredPreference(), systemPrefersDark());
}

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [prefersDark, setPrefersDark] = useState(() => systemPrefersDark());
  const resolvedTheme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setPrefersDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    applyTheme(preference, prefersDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Le thème reste actif pour la session si le stockage est indisponible.
    }
  }, [preference, prefersDark]);

  return {
    preference,
    resolvedTheme,
    setPreference: setPreferenceState,
  };
}
