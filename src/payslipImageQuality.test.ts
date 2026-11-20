import { describe, expect, it } from "vitest";
import { evaluatePayslipImageQuality } from "./payslipImageQuality";

describe("contrôle rapide d’une photo de bulletin", () => {
  it("laisse passer une photo nette et correctement éclairée, même réduite par une messagerie", () => {
    expect(evaluatePayslipImageQuality({ width: 3024, height: 4032, meanLuma: 180, contrast: 54, sharpness: 18, edgeDetailRatio: 0.08 })).toEqual([]);
    // 1 500 × 2 000 px : la taille d'une photo passée par une messagerie, lue sans faute.
    expect(evaluatePayslipImageQuality({ width: 1500, height: 2000, meanLuma: 180, contrast: 54, sharpness: 18, edgeDetailRatio: 0.08 })).toEqual([]);
  });

  it("signale une photo trop petite pour que les chiffres gardent leur trait", () => {
    for (const [width, height] of [[900, 1200], [800, 1500]])
      expect(evaluatePayslipImageQuality({ width, height, meanLuma: 180, contrast: 54, sharpness: 18, edgeDetailRatio: 0.08 }).map(({ kind }) => kind))
        .toEqual(["resolution"]);
  });

  it("explique tous les défauts détectés", () => {
    const issues = evaluatePayslipImageQuality({ width: 600, height: 800, meanLuma: 55, contrast: 35, sharpness: 4, edgeDetailRatio: 0.31 });
    expect(issues.map(({ kind }) => kind)).toEqual(["resolution", "dark", "blur", "crop"]);
    expect(issues.every(({ advice }) => advice.length > 20)).toBe(true);
  });
});
