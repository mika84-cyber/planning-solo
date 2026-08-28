import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("budget de complexité CSS", () => {
  it("contrôle la cascade globale et les familles historiquement dupliquées", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/check-css-complexity.mjs"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toContain("La complexité CSS reste dans la baseline validée.");
    expect(output).toContain("Références de sélecteurs top-header");
    expect(output).toContain("Références de sélecteurs pdf-download-screen");
    expect(output).toContain("Références de sélecteurs today-overview");
  });

  it("documente pourquoi les surcharges restantes ne sont pas déplacées", () => {
    const documentation = readFileSync("src/styles/README.md", "utf8");
    expect(documentation).toContain("Budget automatique");
    expect(documentation).toContain("ordre historique de la cascade");
    expect(documentation).toContain("prefers-reduced-motion");
  });
});
