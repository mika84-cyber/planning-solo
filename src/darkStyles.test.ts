import { describe, expect, it } from "vitest";
import { adaptAccentText, borderColorPart, colorRole, darkenColorsIn } from "./darkStyles";
import { normalizeThemePreference, resolveTheme } from "./theme";

const lightness = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map(Number);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
};

describe("conversion des couleurs du mode sombre", () => {
  it("assombrit les fonds clairs et garde les fonds déjà sombres", () => {
    expect(lightness(darkenColorsIn("#ffffff", "background"))).toBeLessThan(0.15);
    expect(lightness(darkenColorsIn("#fbf6ef", "background"))).toBeLessThan(0.18);
    expect(darkenColorsIn("#2c2621", "background")).toBe("#2c2621");
  });

  it("éclaircit les textes sombres sans toucher aux textes déjà clairs", () => {
    expect(lightness(darkenColorsIn("#2c2621", "text"))).toBeGreaterThan(0.75);
    expect(darkenColorsIn("#fff", "text")).toBe("#fff");
  });

  it("laisse les couleurs franches, comme le terracotta des boutons", () => {
    expect(darkenColorsIn("#985438", "background")).toBe("#985438");
  });

  it("garde la transparence et convertit chaque couleur d’un dégradé", () => {
    const gradient = darkenColorsIn("linear-gradient(145deg, #fff 0%, rgba(255, 255, 255, 0.5) 100%)", "background");
    expect(gradient).toContain("rgba(");
    expect(gradient).toContain(", 0.5)");
    expect(gradient).not.toContain("#fff");
  });

  it("classe chaque propriété selon le rôle de sa couleur", () => {
    expect(colorRole("background-color")).toBe("background");
    expect(colorRole("color")).toBe("text");
    expect(colorRole("border-left-color")).toBe("border");
    expect(colorRole("border-left-width")).toBeNull();
    expect(colorRole("--surface-high")).toBe("background");
    expect(colorRole("--border-soft")).toBe("border");
    expect(colorRole("--muted")).toBe("text");
    expect(colorRole("--accent")).toBeNull();
  });

  it("ne garde que la couleur d’un raccourci de filet", () => {
    expect(borderColorPart("1px solid var(--border-card)")).toBe("var(--border-card)");
    expect(borderColorPart("2px dashed rgba(44, 38, 33, 0.3)")).toBe("rgba(44, 38, 33, 0.3)");
    expect(borderColorPart("0")).toBe("");
  });

  it("éclaircit le terracotta seulement quand il colore un texte", () => {
    expect(adaptAccentText("var(--accent-strong)", "text")).toBe("#e2a383");
    expect(adaptAccentText("var(--accent)", "background")).toBe("var(--accent)");
  });
});

describe("choix de l’apparence", () => {
  it("suit le système par défaut et respecte un choix explicite", () => {
    expect(normalizeThemePreference(null)).toBe("system");
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
