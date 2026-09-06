import { describe, expect, it } from "vitest";
import {
  isPayslipImage,
  mergePayslipPageReadings,
  readPayslipOcrText,
} from "./payslipOcr";

describe("lecture locale d’une photo de bulletin", () => {
  it("reconnaît les principales lignes OCR sans confondre les codes", () => {
    const reading = readPayslipOcrText(`
      Bulletin de paie Septembre 2026
      1.00 300.00 Traitement de Base 1 855,88 1 855,88
      3.00 308.00 Indemnité de Résidence 1 855,88 55,68
      400.00 IFSE 415,00
      Indemnité trav. dom > 10 dim 54,93 219,72
      Titres repas carte 20,00 -82,40
      PAS - Taux 1,90
      CUMUL BRUT 2 962,07
      NET A PAYER AVANT IMPOT SUR LE REVENU 2 311,42
    `);
    expect(reading).toMatchObject({
      month: 8,
      year: 2026,
      baseSalary: 1855.88,
      residenceAllowance: 55.68,
      ifse: 415,
      sundaysBeyondTen: 4,
      mealVoucherDeduction: 82.4,
      pasRate: 1.9,
      gross: 2962.07,
      netBeforeTax: 2311.42,
    });
  });

  it("additionne plusieurs jours de carence et ignore les libellés absents", () => {
    const reading = readPayslipOcrText(`
      Mars 2026
      Jour de carence 2026/03/02 77,50 -77,50
      Jour de carence 2026/03/18 77,50 -77,50
    `);
    expect(reading.carenceDay).toBe(155);
    expect(reading.gross).toBeUndefined();
  });

  it("lit les colonnes d’un bulletin papier même avec les traits du tableau", () => {
    const reading = readPayslipOcrText(`
      Janvier 2025
      300,00 [Traitement de Base 1841,12 1.00 1841.12
      308.00 [Indemnité de Résidence 1841.12 3.00 5.23
      641.28 [IFSE 416.66 0.00 416.66
      ICUMUL BRUT 3106.02
      823.22 [Forfait Navigo TZ mensuel 66.60 1.00 66.60
      870.02 [Titres repas carte 4.12 20.00 -82.40
      884.71 [PAS - Taux 2.10
      NET A PAYER AVANT IMPOT
      ligne intermédiaire
      EN EUROS 2586.44
    `);
    expect(reading).toMatchObject({
      month: 0,
      year: 2025,
      baseSalary: 1841.12,
      residenceAllowance: 55.23,
      ifse: 416.66,
      gross: 3106.02,
      navigo: 66.6,
      mealVoucherDeduction: 82.4,
      pasRate: 2.1,
      netBeforeTax: 2586.44,
    });
  });

  it("accepte les formats d’image réellement lisibles par le navigateur", () => {
    expect(isPayslipImage(new File(["x"], "photo.JPG", { type: "image/jpeg" }))).toBe(true);
    expect(isPayslipImage(new File(["x"], "scan.webp", { type: "" }))).toBe(true);
    expect(isPayslipImage(new File(["x"], "bulletin.pdf", { type: "application/pdf" }))).toBe(false);
  });

  it("réunit deux photos du même bulletin en une seule lecture", () => {
    expect(mergePayslipPageReadings([
      {
        month: 0,
        year: 2025,
        baseSalary: 1841.12,
        ifse: 416.66,
        gross: 3106.02,
        sundaysBeyondTen: 4,
      },
      {
        month: 0,
        year: 2025,
        netBeforeTax: 2586.44,
        mealVoucherDeduction: 82.4,
        pasRate: 2.1,
        sundaysBeyondTen: 0,
      },
    ])).toMatchObject({
      month: 0,
      year: 2025,
      baseSalary: 1841.12,
      ifse: 416.66,
      gross: 3106.02,
      netBeforeTax: 2586.44,
      mealVoucherDeduction: 82.4,
      pasRate: 2.1,
      sundaysBeyondTen: 4,
    });
  });

  it("refuse de réunir des pages reconnues sur deux mois différents", () => {
    expect(() => mergePayslipPageReadings([
      { month: 0, year: 2025, sundaysBeyondTen: 0 },
      { month: 1, year: 2025, sundaysBeyondTen: 0 },
    ])).toThrow("mois différents");
  });
});
