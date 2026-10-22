import { describe, expect, it } from "vitest";
import { evaluatePayslipImageQuality } from "./payslipImageQuality";

describe("contrôle rapide d’une photo de bulletin", () => {
  it("laisse passer une photo nette, droite et correctement éclairée", () => {
    expect(evaluatePayslipImageQuality({ width: 3024, height: 4032, meanLuma: 180, contrast: 54, sharpness: 18, edgeDetailRatio: 0.08, skewDegrees: 1 })).toEqual([]);
    expect(evaluatePayslipImageQuality({ width: 2268, height: 3024, meanLuma: 180, contrast: 54, sharpness: 18, edgeDetailRatio: 0.08, skewDegrees: -3 })).toEqual([]);
  });

  it("signale une photo réduite par une messagerie, où les chiffres se confondent", () => {
    for (const [width, height] of [[1600, 2200], [1200, 1600]])
      expect(evaluatePayslipImageQuality({ width, height, meanLuma: 180, contrast: 54, sharpness: 18, edgeDetailRatio: 0.08, skewDegrees: 0 }).map(({ kind }) => kind))
        .toEqual(["resolution"]);
  });

  it("explique tous les défauts détectés", () => {
    const issues = evaluatePayslipImageQuality({ width: 600, height: 800, meanLuma: 55, contrast: 35, sharpness: 4, edgeDetailRatio: 0.31, skewDegrees: 6 });
    expect(issues.map(({ kind }) => kind)).toEqual(["resolution", "dark", "blur", "crop", "skew"]);
    expect(issues.every(({ advice }) => advice.length > 20)).toBe(true);
  });
});
