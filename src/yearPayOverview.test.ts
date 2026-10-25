import { describe, expect, it } from "vitest";
import { yearPayOverview, type YearPayMonthInput } from "./yearPayOverview";

const ratios = { netRatioFixed: 80, netRatioVariable: 90, navigo: 0, mealVoucherDeduction: 50, pasRate: 2, pasBaseAdjustment: 1 };
const estimate = { gross: 2500, grossFixed: 2000, grossVariable: 500, premiums: 300, mecenat: 0 };

describe("l'année de paie en un coup d'œil", () => {
  it("calcule chaque mois comme la paie du mois, et lit le bulletin vérifié quand il existe", () => {
    const inputs: YearPayMonthInput[] = [
      { index: 0, estimate, ratios },
      // Un bulletin vérifié : son brut et son net avant impôt remplacent l'estimation.
      { index: 1, estimate, ratios, real: { gross: 2600, netBeforeTax: 2100 } },
      // Décembre : pas de titres repas.
      { index: 11, estimate, ratios },
    ];
    const overview = yearPayOverview(2026, inputs, new Date(2026, 9, 24));
    expect(overview.months).toHaveLength(12);
    const january = overview.months[0];
    // 2 000 × 80 % + 500 × 90 % = 2 050 ; − 50 de titres repas = 2 000 ; impôt 2 % = 40.
    expect(january).toMatchObject({ gross: 2500, netBeforeTax: 2000, tax: 40, net: 1960, verified: false, future: false, premiums: 300 });
    expect(overview.months[1]).toMatchObject({ gross: 2600, netBeforeTax: 2100, tax: 42, net: 2058, verified: true });
    expect(overview.months[11]).toMatchObject({ netBeforeTax: 2050, future: true });
    // Un mois sans entrée reste inconnu, sans compter pour zéro.
    expect(overview.months[5]).toMatchObject({ gross: null, net: null, verified: false });
    expect(overview.knownCount).toBe(3);
    expect(overview.verifiedCount).toBe(1);
    expect(overview.totals).toEqual({ gross: 7600, premiums: 900, mecenat: 0, tax: 123, net: 6027 });
  });

  it("ne donne pas de net sans traitement ni sans taux", () => {
    const overview = yearPayOverview(2027, [
      { index: 0, estimate: null, ratios },
      { index: 1, estimate, ratios: null },
    ], new Date(2026, 9, 24));
    expect(overview.months[0].net).toBeNull();
    expect(overview.months[1]).toMatchObject({ gross: 2500, net: null, future: true });
    expect(overview.knownCount).toBe(0);
    expect(overview.totals.net).toBe(0);
  });
});
