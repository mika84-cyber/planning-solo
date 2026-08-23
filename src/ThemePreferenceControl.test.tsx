import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemePreferenceControl } from "./ThemePreferenceControl";

describe("sélecteur d’apparence", () => {
  it("propose automatique, clair et sombre avec le choix courant", () => {
    const html = renderToStaticMarkup(
      <ThemePreferenceControl preference="dark" resolvedTheme="dark" onChange={() => {}} />,
    );
    expect(html).toContain("Apparence");
    expect(html).toContain("Auto");
    expect(html).toContain("Clair");
    expect(html).toContain("Sombre");
    expect(html).toContain('aria-checked="true"');
  });
});
