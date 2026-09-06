import { describe, expect, it } from "vitest";
import { evaluatePayslipImageQuality } from "./payslipImageQuality";

describe("contrôle rapide d’une photo de bulletin", () => {
  it("laisse passer une photo nette, droite et correctement éclairée", () => {
    expect(evaluatePayslipImageQuality({ width: 1600, height: 2200, meanLuma: 180, contrast: 54, sharpness: 18, edgeDetailRatio: 0.08, skewDegrees: 1 })).toEqual([]);
  });

  it("explique tous les défauts détectés", () => {
    const issues = evaluatePayslipImageQuality({ width: 600, height: 800, meanLuma: 55, contrast: 35, sharpness: 4, edgeDetailRatio: 0.31, skewDegrees: 6 });
    expect(issues.map(({ kind }) => kind)).toEqual(["resolution", "dark", "blur", "crop", "skew"]);
    expect(issues.every(({ advice }) => advice.length > 20)).toBe(true);
  });
});
