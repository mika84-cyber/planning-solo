import { describe, expect, it } from "vitest";
import { explainPayslipGapChain, isPayslipGapExplained, payslipGapHeadline } from "./payslipGapExplanation";
import type { PayslipReviewCheck } from "./payslipReview";

const plain = (text: string) => text.replace(/[  ]/g, " ");

// Le bulletin d'octobre 2026 : un demi-dimanche de moins que prévu.
const octobre: PayslipReviewCheck[] = [
  { key: "gross", label: "Cumul brut", found: 2795.02, expected: 2822.48 },
  { key: "net-before-tax", label: "Net avant impôt", found: 2252.55, expected: 2277.19, tolerance: 0.5 },
  { key: "base", label: "Traitement de base", found: 1934.94, expected: 1934.94 },
  { key: "residence", label: "Indemnité de résidence", found: 58.05, expected: 58.05 },
  { key: "ifse", label: "IFSE", found: 395.39, expected: 395.39 },
  { key: "pas-rate", label: "Taux d’imposition (PAS)", found: 2.2, expected: 2.2, tolerance: 0.01 },
  { key: "sunday-flat", label: "Forfait des dimanches", found: 89.59, expected: 89.59 },
  { key: "sundays", label: "Dimanches payés", found: 6.5, expected: 7, tolerance: 0.25 },
];

const octobreInput = {
  checks: octobre,
  expected: { gross: 2822.48, netBeforeTax: 2277.19, incomeTax: 52.95 },
  actual: { gross: 2795.02, netBeforeTax: 2252.55, incomeTax: 52.38 },
  netRatioFixed: 79.5,
  netRatioVariable: 89.7,
};

describe("explainPayslipGapChain", () => {
  it("remonte du demi-dimanche manquant jusqu'au net versé, au centime", () => {
    const explanation = explainPayslipGapChain(octobreInput);
    expect(explanation).not.toBeNull();
    if (!explanation) return;
    expect(explanation.gap).toBe(-24.07);
    expect(explanation.expected.net).toBe(2224.24);
    expect(explanation.actual.net).toBe(2200.17);
    expect(explanation.lines.map(({ key, kind, amount }) => ({ key, kind, amount }))).toEqual([
      { key: "sundays", kind: "cause", amount: -27.46 },
      { key: "contributions", kind: "follow", amount: 2.82 },
      { key: "income-tax", kind: "follow", amount: 0.57 },
    ]);
    expect(plain(explanation.lines[0].title)).toBe("Un demi-dimanche non payé");
    expect(explanation.lines[1].detail).toBe("prélevées sur ce demi-dimanche");
    expect(explanation.lines[2].detail).toBe("2,2 % sur ce qui reste");
    expect(isPayslipGapExplained(explanation)).toBe(true);
    expect(explanation.matching).toBe(5);
    expect(plain(payslipGapHeadline(explanation))).toBe("Il manque 24,07 € sur votre net");
  });

  it("garde l'écart que rien n'explique sur une ligne à part", () => {
    const explanation = explainPayslipGapChain({
      ...octobreInput,
      checks: octobre.map((check) =>
        check.key === "gross" ? { ...check, found: 2775.02 } : check.key === "net-before-tax" ? { ...check, found: 2234.61 } : check),
      actual: { gross: 2775.02, netBeforeTax: 2234.61, incomeTax: 51.96 },
    });
    expect(explanation?.lines.find((line) => line.key === "gross-other")).toMatchObject({ kind: "unknown", amount: -20 });
    expect(explanation && isPayslipGapExplained(explanation)).toBe(false);
    const total = explanation?.lines.reduce((sum, line) => sum + line.amount, 0) ?? 0;
    expect(Math.round(total * 100) / 100).toBe(explanation?.gap);
  });

  it("fait du nouveau taux d'imposition une cause", () => {
    const explanation = explainPayslipGapChain({
      ...octobreInput,
      checks: octobre.map((check) =>
        check.key === "pas-rate" ? { ...check, found: 2.6 } : check.key === "sundays" ? { ...check, found: 7 } : check.key === "gross" ? { ...check, found: 2822.48 } : check.key === "net-before-tax" ? { ...check, found: 2277.19 } : check),
      actual: { gross: 2822.48, netBeforeTax: 2277.19, incomeTax: 62.58 },
    });
    expect(explanation?.lines).toHaveLength(1);
    expect(explanation?.lines[0]).toMatchObject({ key: "pas-rate", kind: "cause", amount: -9.63 });
  });

  it("s'en tient au brut quand le net avant impôt n'est pas lu", () => {
    const explanation = explainPayslipGapChain({ ...octobreInput, actual: { gross: 2795.02 } });
    expect(explanation?.level).toBe("gross");
    expect(explanation?.gap).toBe(-27.46);
    expect(plain(explanation ? payslipGapHeadline(explanation) : "")).toBe("Il manque 27,46 € sur votre brut");
  });

  it("ne dit rien sans brut lu", () => {
    expect(explainPayslipGapChain({ ...octobreInput, actual: {} })).toBeNull();
  });
});

describe("un bulletin conforme", () => {
  it("ne dit rien de quelques centimes d’arrondi", () => {
    const checks: PayslipReviewCheck[] = [
      { key: "gross", label: "Cumul brut", found: 2822.48, expected: 2822.48 },
      { key: "net-before-tax", label: "Net avant impôt", found: 2277.4, expected: 2277.19, tolerance: 0.5 },
    ];
    const explanation = explainPayslipGapChain({
      ...octobreInput,
      checks,
      actual: { gross: 2822.48, netBeforeTax: 2277.4 },
    });
    expect(explanation?.matches).toBe(true);
    expect(explanation?.lines).toEqual([]);
    expect(plain(explanation ? payslipGapHeadline(explanation) : "")).toBe("Le bulletin correspond à l’estimation, à 0,21 € près");
  });
});
