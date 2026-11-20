import { describe, expect, it } from "vitest";
import {
  canonicalPayslipLine,
  legalDeductionRate,
  parsePayslipRow,
  provePayslip,
  readPayslipRows,
  repairEarningLines,
} from "./payslipRows";

/** Les rubriques d'un bulletin de contractuelle à 80 % (montants fictifs,
 *  cohérents au centime), telles qu'une photo les rend. */
const BULLETIN = [
  "300.00 [Traitement de Base 2500.00 0.85714 2142.85",
  "308.00 [Indemnité de Résidence 2142.85 3.00 64.29",
  "454.02 [Indem trav dominical régulier 89.59 1.00 89.59",
  "9/2026 R}|454.08 [Indemnité trav. dom > 10 dim 54.93 3.00 164.79",
  "639.54 [Aide employeur options MGEN 5.00 1.00 5.00",
  "ICUMUL BRUT 2466.52",
  "674.00 [Cotisation vieillesse 2466,52 6.90 170.19",
  "675.00 [Cotis vieillesse déplafonnée 2466.52 0.40 9.87",
  "751.00 [Cotisation IRCANTEC Tranche A 2466.52 2.80 69.06",
  "794.28 [MGEN part individuelle forfaitaire <67.02 20.00 13.40",
  "794.29 [MGEN part individuelle solidaire * % 2301.73 0.70 16.11",
  "9/2026 R{ 794.29 [MGEN part individuelle solidaire 164.79 0.70 1.15",
  "794.38 [MGEN fonds aide aux retraités 29.51 2.65 0.78",
  "9/2026 R} 794.38 [MGEN fonds aide aux retraités 1.15 2.65 0.03",
  "794,39 [MGEN fonds accompagnement social 29,51 0.44 0.13",
  "797.00 |C.S.G. Déductible 2456.87 6.80 167.07",
  "798.00 [Remboursement Dette Sociale 2456.87 0.50 12.28",
  "799.00 [Cont. Sociale généralisée 2456.87 2.40 58.96",
  "823.22 [Forfait Navigo TZ mensuel 68.10 1.00 68.10",
  "870.02 ÎTitres repas carte 4.95 20.00 -99.00",
  "884.70 [PAS prélèvement à la source 2052.24 0.00 0.00",
  "886.15 [MONTANT NET SOCIAL 1944.07",
  "900.00 [Contrib.SS.Non Plaf. Tx Réduit 2466.52 172.65",
  "977.02 jTitres repas carte 4.95 99.00",
];
/** 2 466,52 − 519,03 de cotisations + 68,10 − 99,00. */
const NET = 1916.59;

describe("rubriques d'un bulletin photographié", () => {
  it("lit le code, le libellé et les nombres d'une ligne, malgré les traits du tableau", () => {
    expect(parsePayslipRow("300.00 [Traitement de Base 2500.00 0.85714 2142.85")).toEqual({
      code: "300.00",
      label: "Traitement de Base",
      numbers: [2500, 0.85714, 2142.85],
    });
    // Un rappel : son mois, « R », et le trait du tableau lu comme un « 1 ».
    expect(parsePayslipRow("9/2026 R1454.08 [Indemnité trav. dom > 10 dim 54.93 3.00 164.79")).toMatchObject({
      code: "454.08",
      origin: "R",
      label: "Indemnité trav. dom > 10 dim",
      numbers: [54.93, 3, 164.79],
    });
    // Le trait collé au libellé (« ÎTitres »), un vrai signe moins.
    expect(parsePayslipRow("870.02 ÎTitres repas carte 4.95 20.00 -99.00")).toMatchObject({ label: "Titres repas carte", numbers: [4.95, 20, -99] });
    // Une IFSE garde son « I » : ce n'est pas un trait.
    expect(parsePayslipRow("641.28 |IFSE 416.66 0.00 416.66")).toMatchObject({ label: "IFSE", numbers: [416.66, 0, 416.66] });
    // Débris devant le code, après les montants, entre eux ; centimes sans zéro.
    expect(parsePayslipRow("ta 675.00 [Cotis vieillesse déplafonnée 2466.52 0.40 9.87")).toMatchObject({ code: "675.00", numbers: [2466.52, 0.4, 9.87] });
    expect(parsePayslipRow("794.28 |MGEN part individuelle forfaitaire 67.02 20.00 13.40 dE")).toMatchObject({ numbers: [67.02, 20, 13.4] });
    expect(parsePayslipRow("794.29 [MGEN part individuelle solidaire * % 2301.73 0.70 16.11")).toMatchObject({ numbers: [2301.73, 0.7, 16.11] });
    expect(parsePayslipRow("9/2026 R| 794.38 [MGEN fonds aide aux retraités 1.15 2.65 .03")).toMatchObject({ origin: "R", numbers: [1.15, 2.65, 0.03] });
    // Un tiret de tableau n'est pas un signe moins.
    expect(parsePayslipRow("902.00 [Contribution Vieillesse —”2466,52 210.88")).toMatchObject({ numbers: [2466.52, 210.88] });
    // Pas une rubrique : l'en-tête, le cumul, une date.
    expect(parsePayslipRow("09000000 GR1 1 600 520 CDI L332-1 80.00 121,34 0")).toBeNull();
    expect(parsePayslipRow("CUMUL BRUT 2466.52")).toBeNull();
    expect(parsePayslipRow("Période du 01/10/2026 au 31/10/2026")).toBeNull();
  });

  it("remet une ligne au propre, et rétablit par son code un libellé écorché", () => {
    expect(canonicalPayslipLine("9/2026 R}|454.08 [Indemnité trav. dom > 10 dim 54.93 3.00 164.79"))
      .toBe("9/2026 R 454.08 Indemnité trav. dom > 10 dim 54.93 3.00 164.79");
    expect(canonicalPayslipLine("300.00 [Traitement de Rase 2500.00 0.85714 2142.85"))
      .toBe("300.00 Traitement de Base 2500.00 0.85714 2142.85");
    // Un libellé sans rapport avec le code connu reste tel quel.
    expect(canonicalPayslipLine("300.00 Prime nouvelle 40,00 1,00 40,00")).toBe("300.00 Prime nouvelle 40.00 1.00 40.00");
    // Ce qui n'est pas une rubrique n'est pas touché.
    expect(canonicalPayslipLine("NET A PAYER AVANT IMPOT")).toBe("NET A PAYER AVANT IMPOT");
  });

  it("range les rubriques : rémunérations, cotisations, remboursements, titres repas, impôt", () => {
    const rows = readPayslipRows(BULLETIN);
    expect(rows.hasGross).toBe(true);
    expect(rows.earnings.map((row) => row.code)).toEqual(["300.00", "308.00", "454.02", "454.08", "639.54"]);
    // Douze cotisations salariales ; la part patronale (codes 900 et plus) ne compte pas.
    expect(rows.deductions).toHaveLength(12);
    expect(rows.deductions[0]).toEqual({ code: "674.00", label: "Cotisation vieillesse", base: 2466.52, rate: 6.9, amount: 170.19 });
    // Un rappel garde son origine : deux lignes « 794.29 » ne se confondent pas.
    expect(rows.deductions[5]).toMatchObject({ code: "794.29", origin: "R", amount: 1.15 });
    expect(rows.deductionsComplete).toBe(true);
    expect(rows.reimbursements).toBe(68.1);
    expect(rows.mealVouchers).toBe(99);
    // L'assiette de l'impôt est le net imposable.
    expect(rows.taxableNet).toBe(2052.24);
    expect(rows.netSocial).toBe(1944.07);
    // Le taux payé du traitement : 6/7, un temps partiel à 80 %.
    expect(rows.paidRate).toBe(0.85714);
    expect(rows.fullBaseSalary).toBe(2500);
    // L'IRCANTEC ne se cotise que sous contrat.
    expect(rows.status).toBe("contractuel");
    expect(readPayslipRows(["CUMUL BRUT 3000.00", "724.00 Cotisation Pension Civile 2000.00 11.10 222.00"]).status).toBe("fonctionnaire");
    // Sans cumul brut (la page du net), aucune section n'est sûre.
    expect(readPayslipRows(["NET A PAYER AVANT IMPOT", "EN EUROS 1916.59"])).toMatchObject({ hasGross: false, deductionsComplete: false, earnings: [], deductions: [] });
  });

  it("connaît les taux légaux des cotisations salariales", () => {
    expect(legalDeductionRate("Cotisation vieillesse")?.rate).toBe(6.9);
    expect(legalDeductionRate("Cotis vieillesse déplafonnée")?.rate).toBe(0.4);
    expect(legalDeductionRate("Cotisation IRCANTEC Tranche A")?.rate).toBe(2.8);
    expect(legalDeductionRate("C.S.G. Déductible")?.rate).toBe(6.8);
    expect(legalDeductionRate("Remboursement Dette Sociale")?.rate).toBe(0.5);
    expect(legalDeductionRate("Cont. Sociale généralisée")?.rate).toBe(2.4);
    expect(legalDeductionRate("Cotisation Pension Civile")?.rate).toBe(11.1);
    expect(legalDeductionRate("MGEN part individuelle solidaire")).toBeUndefined();
  });
});

describe("preuve par le calcul", () => {
  it("retrouve le net au centime : brut − cotisations + remboursements − titres repas", () => {
    const rows = readPayslipRows(BULLETIN);
    const proof = provePayslip({ gross: 2466.52, netBeforeTax: NET, rows });
    expect(proof).toEqual({ gross: true, net: true, deductionsTotal: 519.03, repaired: [] });
    // Le total écrit au pied du bulletin prouve les cotisations sans le net.
    expect(provePayslip({ gross: 2466.52, rows, totalDeductions: 519.03 }).net).toBe(true);
    // Et « à payer » moins « à déduire » confirme le net de la case.
    expect(provePayslip({ netBeforeTax: NET, totalEarnings: 2435.62, totalDeductions: 519.03 }).totals).toBe(true);
    expect(provePayslip({ netBeforeTax: 2052.24, totalEarnings: 2435.62, totalDeductions: 519.03 }).totals).toBe(false);
  });

  it("corrige une cotisation mal lue : son montant recalculé fait tomber le total juste", () => {
    // La photo donne 23,78 € d'IRCANTEC au lieu de 69,06 €.
    const lines = BULLETIN.map((line) => line.startsWith("751.00") ? "751.00 [Cotisation IRCANTEC Tranche A 2466.52 2.80 23.78" : line);
    const rows = readPayslipRows(lines);
    expect(rows.deductions[2]).toMatchObject({ amount: 23.78, computed: 69.06 });
    const proof = provePayslip({ gross: 2466.52, netBeforeTax: NET, rows });
    expect(proof.net).toBe(true);
    expect(proof.repaired).toEqual(["Cotisation IRCANTEC Tranche A"]);
    expect(rows.deductions[2]).toEqual({ code: "751.00", label: "Cotisation IRCANTEC Tranche A", base: 2466.52, rate: 2.8, amount: 69.06, repaired: true });
    // Une base mal lue (« <67.02 » → 467,02) ne change pas le montant lu.
    const stained = readPayslipRows(BULLETIN.map((line) => line.replace("<67.02", "467.02")));
    expect(stained.deductions[3]).toMatchObject({ amount: 13.4, computed: 93.4 });
    expect(provePayslip({ gross: 2466.52, netBeforeTax: NET, rows: stained })).toMatchObject({ net: true, repaired: [] });
    // Un montant manquant se calcule : base × taux.
    const missing = readPayslipRows(BULLETIN.map((line) => line.startsWith("794,39") ? "794,39 [MGEN fonds accompagnement social 29,51 0.44" : line));
    expect(missing.deductions[8]).toMatchObject({ amount: 0.13, repaired: true });
    expect(provePayslip({ gross: 2466.52, netBeforeTax: NET, rows: missing }).net).toBe(true);
  });

  it("ne prouve rien quand une ligne manque ou que le total ne tombe pas", () => {
    // Une cotisation illisible : pas de montant, donc pas de total.
    const unread = readPayslipRows(BULLETIN.map((line) => line.startsWith("797.00") ? "797.00 |C.S.G. Déductible" : line));
    expect(unread.deductionsComplete).toBe(false);
    expect(provePayslip({ gross: 2466.52, netBeforeTax: NET, rows: unread }).net).toBeUndefined();
    // Un net faux : la preuve le dit.
    expect(provePayslip({ gross: 2466.52, netBeforeTax: 2052.24, rows: readPayslipRows(BULLETIN) }).net).toBe(false);
    // Un brut qui n'est pas la somme des lignes.
    expect(provePayslip({ gross: 2566.52, netBeforeTax: NET, rows: readPayslipRows(BULLETIN) }).gross).toBe(false);
    expect(provePayslip({ gross: 2466.52 })).toEqual({ repaired: [] });
  });

  it("corrige une ligne de rémunération mal lue, pour que leur somme donne le brut", () => {
    // Le montant de l'aide MGEN manque ; celui de la résidence a un chiffre faux.
    const lines = BULLETIN.map((line) =>
      line.startsWith("639.54") ? "639.54 [Aide employeur options MGEN 5.00 1.00"
        : line.startsWith("308.00") ? "308.00 [Indemnité de Résidence 2142.85 3.00 84.29" : line);
    const repair = repairEarningLines(lines);
    expect(repair.repaired).toEqual(["Indemnité de Résidence", "Aide employeur options MGEN"]);
    expect(repair.lines[1]).toBe("308.00 Indemnité de Résidence 2142.85 3.00 64.29");
    expect(repair.lines[4]).toBe("639.54 Aide employeur options MGEN 5.00 1.00 5.00");
    // Déjà juste : rien ne change.
    expect(repairEarningLines(BULLETIN)).toEqual({ lines: BULLETIN, repaired: [] });
    // Sans solution, on ne touche à rien.
    const hopeless = BULLETIN.map((line) => line.startsWith("ICUMUL") ? "ICUMUL BRUT 9999.99" : line);
    expect(repairEarningLines(hopeless)).toEqual({ lines: hopeless, repaired: [] });
  });
});
