import { describe, expect, it } from "vitest";
import { calculateNetRatios, type PayslipReading } from "./payslip";
import {
  combinePayslipRateReadings,
  mergePayslipRateSamples,
  payslipRateSampleFromReading,
  payslipRateSamplesFromReadings,
  sanitizePayslipRateSamples,
} from "./payslipRateSamples";

const september: PayslipReading = {
  year: 2026,
  month: 8,
  gross: 2450,
  baseSalary: 1850,
  ifse: 425,
  otherFixed: 75,
  netBeforeTax: 1938.46,
  navigo: 64.8,
  mealVoucherDeduction: 82.4,
  sundaysBeyondTen: 0,
  pasRate: 4.2,
  cia: 500,
  carenceDates: ["2026-09-03"],
  extraLines: [{ label: "Prime nouvelle", amount: 40, recall: false, fixed: false }],
};

const august: PayslipReading = {
  year: 2026,
  month: 7,
  gross: 2950,
  baseSalary: 1850,
  ifse: 425,
  otherFixed: 75,
  netBeforeTax: 2388.06,
  navigo: 64.8,
  mealVoucherDeduction: 82.4,
  sundaysBeyondTen: 4,
};

describe("montants gardés des bulletins vérifiés", () => {
  it("ne garde que les montants du calcul des taux, sous le mois du bulletin", () => {
    expect(payslipRateSamplesFromReadings([september])).toEqual({
      "2026-09": {
        year: 2026,
        month: 8,
        gross: 2450,
        netBeforeTax: 1938.46,
        baseSalary: 1850,
        ifse: 425,
        otherFixed: 75,
        navigo: 64.8,
        mealVoucherDeduction: 82.4,
      },
    });
  });

  it("laisse de côté un bulletin sans mois, sans brut, sans traitement ou sans net", () => {
    expect(payslipRateSampleFromReading({ ...september, year: undefined, month: undefined })).toBeNull();
    expect(payslipRateSampleFromReading({ ...september, gross: undefined })).toBeNull();
    expect(payslipRateSampleFromReading({ ...september, baseSalary: undefined })).toBeNull();
    expect(payslipRateSampleFromReading({ ...september, netBeforeTax: undefined })).toBeNull();
  });

  it("refuse les mois et montants mal formés, et garde les deux dernières années", () => {
    const sample = payslipRateSampleFromReading(september);
    expect(
      sanitizePayslipRateSamples({
        "2026-09": { ...sample, year: 1999, month: 3 },
        "2026-13": sample,
        "septembre": sample,
        "2026-08": { ...sample, gross: "2950" },
        "2026-07": { ...sample, netBeforeTax: -1 },
      }),
    ).toEqual({ "2026-09": { ...sample, year: 2026, month: 8 } });
    expect(sanitizePayslipRateSamples(["2026-09"])).toEqual({});
    expect(sanitizePayslipRateSamples(null)).toEqual({});

    const many = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => {
        const year = 2024 + Math.floor(index / 12);
        const month = index % 12;
        return [`${year}-${String(month + 1).padStart(2, "0")}`, { ...sample, year, month }];
      }),
    );
    const kept = Object.keys(sanitizePayslipRateSamples(many));
    expect(kept).toHaveLength(24);
    expect(kept[0]).toBe("2024-07");
    expect(kept.at(-1)).toBe("2026-06");
  });

  it("ajoute un nouveau bulletin aux anciens ; pour un même mois, le dernier vérifié l'emporte", () => {
    const stored = payslipRateSamplesFromReadings([september]);
    const merged = mergePayslipRateSamples(
      stored,
      payslipRateSamplesFromReadings([august, { ...september, netBeforeTax: 1940 }]),
    );
    expect(Object.keys(merged).sort()).toEqual(["2026-08", "2026-09"]);
    expect(merged["2026-09"].netBeforeTax).toBe(1940);
  });

  it("affine les taux avec un bulletin d'une visite précédente et un de cette visite", () => {
    // Première visite : septembre seul ne suffit pas.
    const firstVisit = combinePayslipRateReadings(undefined, [{ name: "septembre.pdf", reading: september }]);
    expect(calculateNetRatios(firstVisit.map((item) => item.reading))).toBeUndefined();
    const stored = payslipRateSamplesFromReadings(firstVisit.map((item) => item.reading));

    // Seconde visite, après rechargement : rien en mémoire, août s'ajoute
    // aux montants gardés dans le compte.
    const secondVisit = combinePayslipRateReadings(stored, [{ name: "aout.pdf", reading: august }]);
    expect(secondVisit).toHaveLength(2);
    expect(calculateNetRatios(secondVisit.map((item) => item.reading))).toEqual({
      netRatioFixed: 79.41,
      netRatioVariable: 89.92,
    });
  });

  it("compte une seule fois un mois gardé puis relu pendant la visite", () => {
    const stored = payslipRateSamplesFromReadings([september]);
    const combined = combinePayslipRateReadings(stored, [
      { name: "septembre-corrige.pdf", reading: { ...september, netBeforeTax: 1940 } },
      { name: "sans-mois.pdf", reading: { ...august, year: undefined, month: undefined } },
    ]);
    expect(combined.map((item) => item.name)).toEqual(["septembre-corrige.pdf", "sans-mois.pdf"]);
    expect(combined[0].reading.netBeforeTax).toBe(1940);
  });
});
