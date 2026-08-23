import { describe, expect, it } from "vitest";
import { normalizeThemePreference, resolveTheme } from "./theme";

describe("préférence de thème", () => {
  it("accepte les trois choix et sécurise une ancienne valeur", () => {
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("system")).toBe("system");
    expect(normalizeThemePreference("inconnu")).toBe("system");
  });

  it("suit l’appareil uniquement en mode automatique", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
