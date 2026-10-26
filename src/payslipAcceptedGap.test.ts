import { describe, expect, it } from "vitest";
import { acceptedGapSummary, correctedPayMonth, type PayMonthFigures } from "./payslipAcceptedGap";
import type { PayslipGapRecord } from "./payslipVerificationRecords";

const october: PayMonthFigures = {
  gross: 2822.48,
  net: 2224.24,
  variables: [{ key: "sundays", label: "Dimanches (7)", quantity: "7 × 54,93 €", amount: 384.51 }],
  calculation: {
    grossComposition: [
      { key: "base", label: "Traitement de base", detail: "", amount: 1934.94 },
      { key: "sunday-flat", label: "Forfait mensuel de dimanches", detail: "", amount: 89.59 },
      { key: "sundays", label: "Dimanches (7)", detail: "", amount: 384.51 },
    ],
    grossDeductions: [],
    grossBeforeDeductions: 2822.48,
    variableAdditions: 474.1,
    netRatioFixed: 79.5,
    netRatioVariable: 89.7,
    estimatedContributions: 530.99,
    navigo: 0,
    mealVoucherDeduction: 14.3,
    netBeforeTax: 2277.19,
    pasRate: 2.2,
    incomeTax: 52.95,
    totalDeductions: 598.24,
  },
};

const gap: PayslipGapRecord = {
  level: "net",
  expected: { gross: 2822.48, netBeforeTax: 2277.19, incomeTax: 52.95, net: 2224.24 },
  actual: { gross: 2795.02, netBeforeTax: 2252.55, incomeTax: 52.38, net: 2200.17 },
  gap: -24.07,
  lines: [
    { key: "sundays", title: "Un demi-dimanche non payé", detail: "", amount: -27.46, kind: "cause", found: 6.5, expected: 7 },
    { key: "contributions", title: "Moins de cotisations", detail: "", amount: 2.82, kind: "follow" },
    { key: "income-tax", title: "Moins d’impôt", detail: "", amount: 0.57, kind: "follow" },
  ],
};

describe("correctedPayMonth", () => {
  it("prend les montants du bulletin, ligne en cause comprise", () => {
    const corrected = correctedPayMonth(october, gap);
    expect(corrected.gross).toBe(2795.02);
    expect(corrected.net).toBe(2200.17);
    expect(corrected.variables[0]).toMatchObject({ label: "Dimanches (6,5)", amount: 357.05, quantity: "payés sur le bulletin · ½ manquant" });
    expect(corrected.calculation.grossComposition.find((row) => row.key === "sundays")).toMatchObject({ label: "Dimanches (6,5)", amount: 357.05 });
    expect(corrected.calculation.estimatedContributions).toBe(528.17);
    expect(corrected.calculation.netBeforeTax).toBe(2252.55);
    expect(corrected.calculation.incomeTax).toBe(52.38);
    expect(corrected.calculation.totalDeductions).toBe(594.85);
    // Brut − cotisations − titres repas = net avant impôt, au centime.
    const { calculation } = corrected;
    expect(Math.round((corrected.gross - (calculation.estimatedContributions ?? 0) - calculation.mealVoucherDeduction) * 100) / 100).toBe(2252.55);
  });

  it("ajoute une ligne du bulletin que l’estimation n’a pas", () => {
    const corrected = correctedPayMonth(october, {
      ...gap,
      lines: [{ key: "gross-other", title: "Brut plus bas, sans ligne en cause", detail: "", amount: -27.46, kind: "unknown" }],
    });
    expect(corrected.variables.at(-1)).toMatchObject({ key: "payslip-gross-other", amount: -27.46 });
    expect(corrected.calculation.grossComposition.at(-1)).toMatchObject({ key: "payslip-gross-other", amount: -27.46 });
  });

  it("descend un écart du seul brut jusqu’au net avec les taux de l’estimation", () => {
    const corrected = correctedPayMonth(october, {
      level: "gross",
      expected: { gross: 2822.48 },
      actual: { gross: 2795.02 },
      gap: -27.46,
      lines: [gap.lines[0]],
    });
    expect(corrected.gross).toBe(2795.02);
    expect(corrected.calculation.netBeforeTax).toBe(2252.56);
    expect(corrected.net).toBe(2200.18);
  });

  it("résume l’écart pour la note du net payé", () => {
    expect(acceptedGapSummary(gap)).toEqual({ expected: 2224.24, gap: -24.07, cause: "un demi-dimanche non payé" });
    // Un sigle garde sa majuscule ; les autres causes sont comptées.
    const two: PayslipGapRecord = { ...gap, lines: [
      { key: "ifse", title: "IFSE : 16,66 € de moins que prévu", detail: "", amount: -16.66, kind: "cause" },
      { key: "contributions", title: "Moins de cotisations", detail: "", amount: 3.6, kind: "follow" },
      { key: "pas-rate", title: "Taux d’imposition de 2 % au lieu de 1,7 %", detail: "", amount: -6.97, kind: "cause" },
    ] };
    expect(acceptedGapSummary(two).cause).toBe("IFSE : 16,66 € de moins que prévu, et 1 autre cause");
  });
});
