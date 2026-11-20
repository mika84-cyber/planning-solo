import { describe, expect, it } from "vitest";
import { mergePayslipPageReadings } from "./payslipOcr";
import { NET_PAGE_LAYOUT, RUBRICS_PAGE_LAYOUT } from "./payslipPhotoFixture";
import type { PhotoLayout } from "./payslipPhotoLayout";
import {
  finishPayslipReading,
  readPayslipPhotoLayout,
  withoutImpossibleValues,
  workTimeFromPaidRate,
} from "./payslipPhotoReading";

/** La même page, où un montant a été mal reconnu. */
function withWord(layout: PhotoLayout, from: string, to: string): PhotoLayout {
  let done = false;
  return {
    ...layout,
    fragments: layout.fragments.map((fragment) => ({
      ...fragment,
      words: fragment.words.map((word) => {
        if (done || word.text !== from) return word;
        done = true;
        return { ...word, text: to };
      }),
    })),
  };
}

describe("lecture d'une photo de bulletin de contractuel", () => {
  it("lit la page des rubriques d'une vraie photo, et prouve le brut par la somme des lignes", () => {
    const reading = readPayslipPhotoLayout(RUBRICS_PAGE_LAYOUT);
    expect(reading).toMatchObject({
      month: 9,
      year: 2026,
      gross: 2466.52,
      baseSalary: 2142.85,
      residenceAllowance: 64.29,
      // Résidence et aide employeur MGEN.
      otherFixed: 69.29,
      sundayFlat: 89.59,
      // Trois dimanches de septembre, payés en rappel.
      sundaysBeyondTen: 3,
      navigo: 68.1,
      mealVoucherDeduction: 99,
      pasRate: 0,
      incomeTax: 0,
      // L'assiette de l'impôt, sur la ligne « PAS ».
      taxableNet: 2052.24,
      // L'IRCANTEC et le « CDI » de l'en-tête ; 80 %, payé 6/7.
      status: "contractuel",
      workTime: 80,
    });
    // Aucune ligne inconnue : le rappel de dimanches est reconnu comme tel.
    expect(reading.extraLines).toBeUndefined();
    expect(reading.rows?.deductions).toHaveLength(12);
    expect(reading.proof).toMatchObject({ gross: true, deductionsTotal: 519.03, repaired: [] });
    // Le net n'est pas sur cette page : il reste à prouver.
    expect(reading.netBeforeTax).toBeUndefined();
    expect(reading.proof?.net).toBeUndefined();
  });

  it("lit les cases du pied de page à leur place, sans prendre le net imposable pour le net", () => {
    const reading = readPayslipPhotoLayout(NET_PAGE_LAYOUT);
    expect(reading).toMatchObject({
      month: 9,
      year: 2026,
      netBeforeTax: 1916.59,
      netPaid: 1916.59,
      taxableNet: 2052.24,
      totalEarnings: 2435.62,
      totalDeductions: 519.03,
      status: "contractuel",
      workTime: 80,
    });
    expect(reading.gross).toBeUndefined();
    expect(reading.rows).toBeUndefined();
  });

  it("prouve le bulletin entier quand les deux pages sont réunies, dans un ordre ou dans l'autre", () => {
    const rubrics = readPayslipPhotoLayout(RUBRICS_PAGE_LAYOUT);
    const net = readPayslipPhotoLayout(NET_PAGE_LAYOUT);
    for (const pages of [[rubrics, net], [net, rubrics]]) {
      const whole = finishPayslipReading(mergePayslipPageReadings(pages));
      expect(whole).toMatchObject({ gross: 2466.52, netBeforeTax: 1916.59, baseSalary: 2142.85, status: "contractuel", workTime: 80 });
      // Brut = somme des lignes ; net = brut − cotisations + Navigo − titres
      // repas ; « à payer » − « à déduire » = net.
      expect(whole.proof).toEqual({ gross: true, net: true, totals: true, deductionsTotal: 519.03, repaired: [] });
    }
  });

  it("corrige par le calcul un chiffre mal reconnu, et le dit", () => {
    // 69,06 € d'IRCANTEC lus 29,06 € : base × taux le rétablit, le total le prouve.
    const rubrics = readPayslipPhotoLayout(withWord(RUBRICS_PAGE_LAYOUT, "69.06", "29.06"));
    const whole = finishPayslipReading(mergePayslipPageReadings([rubrics, readPayslipPhotoLayout(NET_PAGE_LAYOUT)]));
    expect(whole.proof).toMatchObject({ net: true, repaired: ["Cotisation IRCANTEC Tranche A"] });
    // Le montant de la résidence lu 84,29 € : la somme des lignes ne donnait plus le brut.
    const residence = readPayslipPhotoLayout(withWord(RUBRICS_PAGE_LAYOUT, "64.29", "84.29"));
    expect(residence).toMatchObject({ residenceAllowance: 64.29, otherFixed: 69.29 });
    expect(residence.proof).toMatchObject({ gross: true, repaired: ["Indemnité de Résidence"] });
  });

  it("retrouve le net par les totaux du pied de page quand sa case est illisible", () => {
    const net = readPayslipPhotoLayout(withWord(withWord(NET_PAGE_LAYOUT, "1916.59", "?"), "1916.59", "?"));
    expect(net.netBeforeTax).toBeUndefined();
    const whole = finishPayslipReading(mergePayslipPageReadings([readPayslipPhotoLayout(RUBRICS_PAGE_LAYOUT), net]));
    // Sans les totaux non plus (ils se repèrent par le net), rien n'est inventé.
    expect(whole.netBeforeTax).toBeUndefined();
    // Avec eux : 2 435,62 − 519,03.
    const fromTotals = finishPayslipReading({ ...whole, totalEarnings: 2435.62, totalDeductions: 519.03 });
    expect(fromTotals.netBeforeTax).toBe(1916.59);
    expect(fromTotals.proof).toMatchObject({ net: true, totals: true });
  });

  it("écarte une valeur impossible plutôt que de la proposer", () => {
    const base = { sundaysBeyondTen: 0, gross: 2635.13, baseSalary: 2253.22 };
    // Une indemnité de résidence au niveau du traitement : la colonne « Base ».
    expect(withoutImpossibleValues({ ...base, residenceAllowance: 2253.22, otherFixed: 2258.22 })).toMatchObject({ residenceAllowance: undefined, otherFixed: undefined });
    // 732 dimanches, un net de 1,06 € ou plus gros que le brut.
    expect(withoutImpossibleValues({ ...base, sundaysBeyondTen: 732 }).sundaysBeyondTen).toBe(0);
    expect(withoutImpossibleValues({ ...base, netBeforeTax: 1.06 }).netBeforeTax).toBeUndefined();
    expect(withoutImpossibleValues({ ...base, netBeforeTax: 13081.06 }).netBeforeTax).toBeUndefined();
    // Un traitement plus gros que le brut, un Navigo de 2 000 €.
    expect(withoutImpossibleValues({ sundaysBeyondTen: 0, gross: 2635.13, baseSalary: 26287.6 }).baseSalary).toBeUndefined();
    expect(withoutImpossibleValues({ ...base, navigo: 2078.37 }).navigo).toBeUndefined();
    // Un bulletin ordinaire n'est pas touché.
    const fine = { ...base, residenceAllowance: 67.6, otherFixed: 72.6, navigo: 68.1, netBeforeTax: 2050.89, sundaysBeyondTen: 4 };
    expect(withoutImpossibleValues(fine)).toEqual(fine);
  });

  it("traduit le taux payé du traitement en temps de travail", () => {
    expect(workTimeFromPaidRate(0.85714)).toBe(80);
    expect(workTimeFromPaidRate(0.91429)).toBe(90);
    expect(workTimeFromPaidRate(1)).toBe(100);
    expect(workTimeFromPaidRate(0.5)).toBe(50);
    expect(workTimeFromPaidRate(0.7)).toBe(70);
    expect(workTimeFromPaidRate(0.8333)).toBeUndefined();
  });
});
