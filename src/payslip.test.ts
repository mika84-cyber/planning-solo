import { describe, expect, it } from "vitest";
import { calculateNetRatios, readPayslip } from "./payslip";

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

/** Le bulletin de mars 2024 : un jour de carence posé le 20 mars, les
 *  titres repas, le Navigo et le taux de PAS — quatre lignes absentes des
 *  bulletins ci-dessus. Le taux et l'assiette diffèrent du montant réel sur
 *  la ligne des titres repas (20 tickets à 4,12 €), ce que confond une
 *  lecture au premier nombre plutôt qu'au second. */
const mars2024 = [
  "1.00",
  "648.60",
  "Jour de carence 20/3/2024",
  "77.50",
  "-77.50",
  "1.00",
  "823.22",
  "Forfait  Navigo TZ mensuel",
  "64.80",
  "64.80",
  "20.00",
  "870.02",
  "Titres repas carte",
  "4.12",
  "-82.40",
  "1.90",
  "884.70",
  "PAS prélèvement à la source",
  "2200.00",
  "41.80",
  "884.71",
  "PAS - Taux",
  "1.90",
  "886.15",
  "MONTANT NET SOCIAL",
];

describe("lecture d'un bulletin", () => {
  it("relève le brut, le traitement et l'IFSE", () => {
    expect(readPayslip(juin2026)).toMatchObject({
      gross: 2962.07,
      baseSalary: 1855.88,
      ifse: 416.66,
      otherFixed: 66.82,
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

describe("lecture des éléments de paie ajoutés au profil", () => {
  it("relève le CIA, second nombre après le libellé", () => {
    // Le premier nombre (l'assiette) vaut aussi 476 ici, donc ce test seul
    // ne distinguerait pas un offset de l'autre — corrigé par le suivant.
    expect(readPayslip(juillet2026).cia).toBe(476);
  });

  it("additionne les cinq lignes des « Autres éléments fixes »", () => {
    // 55.68 + 11.14 + 17.94 + 5.00 - 13.92 = 75.84 (le signe du transfert
    // est déjà négatif sur le bulletin, pas de moins à appliquer ici).
    expect(readPayslip(juillet2026).otherFixed).toBe(75.84);
  });

  it("calcule les « Autres éléments fixes » avec les lignes présentes ce mois-là", () => {
    // Juin ne porte encore que résidence + compensation SMIC.
    expect(readPayslip(juin2026).otherFixed).toBe(66.82);
  });

  it("lit le net avant impôt malgré les accents et la casse", () => {
    expect(
      readPayslip([
        "Net à payer avant impôt sur le revenu",
        "1938,46",
      ]).netBeforeTax,
    ).toBe(1938.46);
  });

  it("calcule séparément les taux du traitement et des primes", () => {
    expect(
      calculateNetRatios([
        {
          gross: 2450,
          baseSalary: 1850,
          ifse: 425,
          otherFixed: 75,
          netBeforeTax: 1938.46,
          navigo: 64.8,
          mealVoucherDeduction: 82.4,
          sundaysBeyondTen: 0,
        },
        {
          gross: 2950,
          baseSalary: 1850,
          ifse: 425,
          otherFixed: 75,
          netBeforeTax: 2388.06,
          navigo: 64.8,
          mealVoucherDeduction: 82.4,
          sundaysBeyondTen: 4,
        },
      ]),
    ).toEqual({ netRatioFixed: 79.41, netRatioVariable: 89.92 });
  });

  it("demande au moins deux bulletins différenciés pour séparer les taux", () => {
    expect(
      calculateNetRatios([
        {
          gross: 2450,
          baseSalary: 1850,
          netBeforeTax: 1950,
          sundaysBeyondTen: 0,
        },
      ]),
    ).toBeUndefined();
  });

  it("relève un jour de carence malgré la date dans le libellé", () => {
    // Le libellé exact (« Jour de carence 20/3/2024 ») ne se reverra jamais
    // à l'identique : seul le préfixe permet de le repérer.
    expect(readPayslip(mars2024).carenceDay).toBe(77.5);
  });

  it("ramène la retenue des titres repas à une valeur positive", () => {
    // -82.40 sur le bulletin (20 tickets à 4,12 €) : le champ du profil
    // attend un montant positif.
    expect(readPayslip(mars2024).mealVoucherDeduction).toBe(82.4);
  });

  it("ne prend pas le prix unitaire du ticket pour le montant retenu", () => {
    // Le premier nombre après le libellé (4.12, le prix d'un ticket) n'est
    // pas la retenue totale (-82.40, pour 20 tickets).
    expect(readPayslip(mars2024).mealVoucherDeduction).not.toBe(4.12);
  });

  it("relève le Navigo remboursé", () => {
    expect(readPayslip(mars2024).navigo).toBe(64.8);
  });

  it("relève le taux de PAS, une ligne à un seul nombre", () => {
    expect(readPayslip(mars2024).pasRate).toBe(1.9);
  });

  it("ne renvoie rien pour les lignes absentes du bulletin", () => {
    const reading = readPayslip(janvier2026);
    expect(reading.cia).toBeUndefined();
    expect(reading.navigo).toBeUndefined();
    expect(reading.mealVoucherDeduction).toBeUndefined();
    expect(reading.carenceDay).toBeUndefined();
    expect(reading.pasRate).toBeUndefined();
    expect(reading.otherFixed).toBeUndefined();
  });
});
