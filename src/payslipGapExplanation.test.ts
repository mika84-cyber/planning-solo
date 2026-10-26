import { describe, expect, it } from "vitest";
import { estimatedIncomeTax } from "./payEstimate";
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

describe("heures sup et mécénats payés en rappel", () => {
  // Un bulletin d'octobre 2026 : 6 dimanches pour 5 attendus, 13 h 30
  // d'heures sup pour environ 15 h 30 attendues, et les mécénats payés au
  // seul taux de jour.
  const checks: PayslipReviewCheck[] = [
    { key: "gross", label: "Cumul brut", found: 3204.83, expected: 3212.47 },
    { key: "base", label: "Traitement de base", found: 1895.27, expected: 1895.27 },
    { key: "pas-rate", label: "Taux d’imposition (PAS)", found: 5.7, expected: 5.7, tolerance: 0.01 },
    { key: "sundays", label: "Dimanches payés", found: 6, expected: 5, tolerance: 0.25 },
    { key: "overtime", label: "Heures supplémentaires", found: 225.23, expected: 257.55, tolerance: 0.5 },
    { key: "mecenat", label: "Mécénats", found: 171.75, expected: 202, tolerance: 0.1 },
  ];
  const expectedTax = estimatedIncomeTax(2687.32, 5.7, 1.057, 257.55 + 202);
  const explanation = explainPayslipGapChain({
    checks,
    expected: { gross: 3212.47, netBeforeTax: 2687.32, incomeTax: expectedTax },
    actual: { gross: 3204.83, netBeforeTax: 2637.11, incomeTax: 137.04 },
    netRatioFixed: 79.96,
    netRatioVariable: 90.54,
    applied: { "contributions-other": "taux de cotisations recalés sur ce bulletin" },
    details: { mecenat: "7 h 30 payées au taux de jour (22,90 €) : la majoration de nuit de 2 h 30 manque" },
    references: { mecenat: "article 2 de l’arrêté du 18 mai 2010, modifié par l’arrêté du 15 décembre 2023, fixe un taux majoré" },
    taxBase: { pasRate: 5.7, adjustment: 1.057, exemptActual: 225.23 + 171.75 },
  });

  it("dit chaque cause, sans rappel compté deux fois ni brut inexpliqué", () => {
    expect(explanation?.lines.map(({ key, kind, amount }) => ({ key, kind, amount }))).toEqual([
      { key: "sundays", kind: "cause", amount: 54.93 },
      { key: "overtime", kind: "cause", amount: -32.32 },
      { key: "mecenat", kind: "cause", amount: -30.25 },
      { key: "contributions", kind: "follow", amount: 0.72 },
      { key: "contributions-other", kind: "cause", amount: -43.29 },
      { key: "income-tax", kind: "follow", amount: 0.42 },
    ]);
    expect(explanation && isPayslipGapExplained(explanation)).toBe(true);
    const total = explanation?.lines.reduce((sum, line) => sum + line.amount, 0) ?? 0;
    expect(Math.round(total * 100) / 100).toBe(explanation?.gap);
  });

  it("dit la majoration de nuit des mécénats qui manque, et le texte qui la fixe", () => {
    const mecenat = explanation?.lines.find((line) => line.key === "mecenat");
    expect(plain(mecenat?.title ?? "")).toBe("Mécénats : 30,25 € de moins que prévu");
    expect(mecenat?.detail).toContain("la majoration de nuit de 2 h 30 manque");
    expect(mecenat?.reference).toContain("arrêté du 18 mai 2010");
  });

  it("explique les cotisations recalées et l'impôt des heures exonérées", () => {
    const recalibrated = explanation?.lines.find((line) => line.key === "contributions-other");
    expect(recalibrated?.applied).toBe("taux de cotisations recalés sur ce bulletin");
    expect(explanation?.lines.find((line) => line.key === "income-tax")?.detail).toBe("5,7 % sur ce qui reste ; heures sup et mécénats exonérés");
  });
});
