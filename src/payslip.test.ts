import { describe, expect, it } from "vitest";
import { readPayslip } from "./payslip";

/** Les fragments de texte relevés sur le bulletin de juin 2026, dans l'ordre
 *  où le PDF les écrit. Le libellé précède son montant, et les lignes n'ont
 *  pas toutes le même nombre de colonnes. */
const juin2026 = [
  "1.00",
  "300.00",
  "Traitement de Base",
  "1855.88",
  "1855.88",
  "3.00",
  "308.00",
  "Indemnité de Résidence",
  "1855.88",
  "55.68",
  "310.00",
  "Indemnité comp. au SMIC",
  "11.14",
  "453.07",
  "FERIES DES 08 ET 24 MAI 2026",
  "524.10",
  "5/2026",
  "R",
  "1.00",
  "454.02",
  "Indem trav dominical régulier",
  "89.59",
  "89.59",
  "0.00",
  "641.28",
  "IFSE",
  "416.66",
  "416.66",
  "CUMUL BRUT",
  "2962.07",
  "11.10",
  "724.00",
  "Cotisation Pension Civile",
];

/** Les fragments du bulletin de juillet 2026 : quatre dimanches de rappel,
 *  référencés « 6/2026 » (juin), plus le CIA — une ligne nouvelle cette
 *  année-là, absente des sept bulletins précédents. */
const juillet2026 = [
  "1.00",
  "300.00",
  "Traitement de Base",
  "1855.88",
  "1855.88",
  "3.00",
  "308.00",
  "Indemnité de Résidence",
  "1855.88",
  "55.68",
  "310.00",
  "Indemnité comp. au SMIC",
  "11.14",
  "1.00",
  "454.02",
  "Indem trav dominical régulier",
  "89.59",
  "89.59",
  "4.00",
  "454.08",
  "Indemnité trav. dom > 10 dim",
  "54.93",
  "219.72",
  "6/2026",
  "R",
  "1.00",
  "636.83",
  "ICHCSG",
  "17.94",
  "17.94",
  "1.00",
  "639.54",
  "Aide employeur options MGEN",
  "5.00",
  "5.00",
  "1.00",
  "641.25",
  "CIA",
  "476.00",
  "476.00",
  "0.00",
  "641.28",
  "IFSE",
  "416.66",
  "416.66",
  "1.00",
  "641.29",
  "Transfert primes/points",
  "13.92",
  "-13.92",
  "CUMUL BRUT",
  "3133.69",
  "11.10",
  "724.00",
  "Cotisation Pension Civile",
];

/** Le bulletin de janvier 2026 : deux dimanches de rappel, référencés
 *  « 12/2025 » (décembre de l'année précédente). */
const janvier2026 = [
  "2.00",
  "454.08",
  "Indemnité trav. dom > 10 dim",
  "54.93",
  "109.86",
  "12/2025",
  "R",
];

describe("lecture d'un bulletin", () => {
  it("relève le brut, le traitement et l'IFSE", () => {
    expect(readPayslip(juin2026)).toEqual({
      gross: 2962.07,
      baseSalary: 1855.88,
      ifse: 416.66,
      sundaysBeyondTen: 0,
    });
  });

  it("ne confond pas le brut avec la ligne suivante", () => {
    // « CUMUL BRUT » est suivi du total, puis du taux de la ligne d'après :
    // seul le premier nombre compte.
    expect(readPayslip(juin2026).gross).not.toBe(11.1);
  });

  it("ne renvoie rien quand le libellé manque", () => {
    expect(readPayslip(["Autre chose", "12.34"])).toEqual({
      gross: undefined,
      baseSalary: undefined,
      ifse: undefined,
      sundaysBeyondTen: 0,
    });
  });

  it("ignore un libellé suivi d'autre chose qu'un nombre", () => {
    expect(readPayslip(["CUMUL BRUT", "néant"]).gross).toBeUndefined();
  });
});

describe("lecture du nombre de dimanches", () => {
  it("compte les quatre dimanches du rappel de juillet 2026", () => {
    expect(readPayslip(juillet2026).sundaysBeyondTen).toBe(4);
  });

  it("compte les deux dimanches du rappel de janvier 2026", () => {
    expect(readPayslip(janvier2026).sundaysBeyondTen).toBe(2);
  });

  it("ne confond pas le taux (54,93 €) avec le montant", () => {
    // Prendre le premier nombre après le libellé donnerait 1 (54,93 / 54,93),
    // pas 4 : c'est le second nombre qui est le montant.
    expect(readPayslip(juillet2026).sundaysBeyondTen).not.toBe(1);
  });

  it("vaut 0 quand la ligne est absente, sans le signaler comme une erreur", () => {
    expect(readPayslip(juin2026).sundaysBeyondTen).toBe(0);
  });

  it("se méfie d'un taux qui ne vaut pas 54,93 €", () => {
    // Si le taux a changé ou que ce n'est pas la bonne ligne, mieux vaut 0
    // qu'un compte inventé.
    expect(
      readPayslip([
        "Indemnité trav. dom > 10 dim",
        "60.00",
        "240.00",
      ]).sundaysBeyondTen,
    ).toBe(0);
  });
});
