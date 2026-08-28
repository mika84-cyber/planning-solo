import { describe, expect, it } from "vitest";
import {
  isUnplannedPayslipCarence,
  shouldReportMissingPayslipField,
  summarizePayslipReview,
} from "./payslipReview";

describe("résumé de vérification d'un bulletin", () => {
  it("annonce un résultat rassurant quand les lignes lisibles concordent", () => {
    const result = summarizePayslipReview([
      { key: "gross", label: "Cumul brut", found: 2600, expected: 2600 },
      { key: "sundays", label: "Dimanches", found: 3, expected: 3, tolerance: 1 },
    ]);
    expect(result.verdict).toBe("Tout semble correct");
    expect(result.tone).toBe("ok");
  });

  it("compte seulement les écarts réellement vérifiables", () => {
    const result = summarizePayslipReview([
      { key: "gross", label: "Cumul brut", found: 2500, expected: 2600 },
      { key: "ifse", label: "IFSE", found: undefined, expected: 300 },
      { key: "sundays", label: "Dimanches", found: 2, expected: 4, tolerance: 1 },
    ]);
    expect(result.verdict).toBe("2 points à vérifier");
    expect(result.issues.map((item) => item.key)).toEqual(["gross", "sundays"]);
    expect(result.unavailable.map((item) => item.key)).toEqual(["ifse"]);
  });

  it("ne transforme pas un bulletin illisible en faux problème", () => {
    const result = summarizePayslipReview([
      { key: "gross", label: "Cumul brut", found: undefined, expected: 2600 },
    ]);
    expect(result.verdict).toBe("Comparaison impossible");
    expect(result.tone).toBe("unknown");
    expect(result.issues).toHaveLength(0);
  });

  it("ne réclame ni CIA ni carence absents pendant une simple vérification", () => {
    expect(shouldReportMissingPayslipField("cia", "verify")).toBe(false);
    expect(shouldReportMissingPayslipField("carenceDay", "verify")).toBe(false);
    expect(shouldReportMissingPayslipField("baseSalary", "verify")).toBe(true);
    expect(shouldReportMissingPayslipField("cia", "calibrate")).toBe(true);
  });

  it("signale une carence lue seulement quand aucun arrêt n’était prévu", () => {
    expect(isUnplannedPayslipCarence(77.5, 0)).toBe(true);
    expect(isUnplannedPayslipCarence(77.5, 1)).toBe(false);
    expect(isUnplannedPayslipCarence(undefined, 0)).toBe(false);
  });
});
