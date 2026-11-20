import { describe, expect, it } from "vitest";
import { auditPayslip } from "./payslipAudit";
import { isProvenPayslipReading, mergePayslipPageReadings } from "./payslipOcr";
import { NET_PAGE_LAYOUT, RUBRICS_PAGE_LAYOUT } from "./payslipPhotoFixture";
import { finishPayslipReading, readPayslipPhotoLayout } from "./payslipPhotoReading";

const rubrics = readPayslipPhotoLayout(RUBRICS_PAGE_LAYOUT);
const whole = finishPayslipReading(mergePayslipPageReadings([rubrics, readPayslipPhotoLayout(NET_PAGE_LAYOUT)]));
const find = (reading: Parameters<typeof auditPayslip>[0], key: string) => auditPayslip(reading).find((item) => item.key === key);

describe("contrôle d'un bulletin photographié", () => {
  it("dit la lecture prouvée quand le brut et le net se recoupent au centime", () => {
    expect(isProvenPayslipReading(whole)).toBe(true);
    const proof = find(whole, "proof");
    expect(proof).toMatchObject({ tone: "ok", title: "Lecture vérifiée par le calcul" });
    expect(proof?.detail).toMatch(/Le brut est la somme des 5 lignes de rémunération\./);
    expect(proof?.detail).toMatch(/brut − 519,03\s€ de cotisations \+ 68,10\s€ remboursés − 99,00\s€ de titres repas/);
    // Une page seule ne prouve pas le net ; un PDF n'a pas de preuve à faire.
    expect(isProvenPayslipReading(rubrics)).toBe(false);
    expect(isProvenPayslipReading({ sundaysBeyondTen: 0, gross: 2000 })).toBe(false);
    expect(isProvenPayslipReading(undefined)).toBe(false);
    expect(auditPayslip({ sundaysBeyondTen: 0, gross: 2000 })).toEqual([]);
  });

  it("confirme les taux légaux, l'indemnité de résidence et le temps partiel", () => {
    expect(find(whole, "rates")).toMatchObject({ tone: "ok", title: "Cotisations aux taux légaux" });
    expect(find(whole, "rates")?.detail).toMatch(/^vieillesse 6,90\s% \+ 0,40\s% · IRCANTEC 2,80\s% · CSG 6,80\s% \+ 2,40\s% · CRDS 0,50\s%$/);
    expect(find(whole, "residence")).toEqual({ key: "residence", tone: "ok", title: "Indemnité de résidence : 3 % du traitement" });
    const time = find(whole, "work-time");
    expect(time).toMatchObject({ tone: "info", title: "Temps partiel à 80 %" });
    expect(time?.detail).toMatch(/il est payé à 85,71\s% de 2\s500,00\s€\.$/);
    // Rien d'alarmant sur un bulletin juste.
    expect(auditPayslip(whole).filter((item) => item.tone === "warn")).toEqual([]);
  });

  it("signale un taux de cotisation qui n'est pas celui de la loi, et une résidence inhabituelle", () => {
    const rows = { ...whole.rows!, deductions: whole.rows!.deductions.map((item) => item.code === "751.00" ? { ...item, rate: 3.8 } : item) };
    const odd = { ...whole, rows, residenceAllowance: 90 };
    expect(find(odd, "rate-751.00")).toMatchObject({ tone: "warn" });
    expect(find(odd, "rate-751.00")?.title).toMatch(/Cotisation IRCANTEC Tranche A : 3,80\s% au lieu de 2,80\s%/);
    expect(find(odd, "rates")).toBeUndefined();
    expect(find(odd, "residence")).toMatchObject({ tone: "warn" });
  });

  it("dit ce que le calcul a corrigé, et ce qu'il n'a pas pu prouver", () => {
    const repaired = finishPayslipReading({
      ...whole,
      rows: { ...whole.rows!, deductions: whole.rows!.deductions.map((item) => item.code === "751.00" ? { ...item, amount: 29.06, computed: 69.06 } : item) },
    });
    expect(isProvenPayslipReading(repaired)).toBe(true);
    expect(find(repaired, "repaired")).toMatchObject({ tone: "info", title: "1 montant corrigé par le calcul" });
    expect(find(repaired, "repaired")?.detail).toContain("Cotisation IRCANTEC Tranche A");
    // Un net qui ne se retrouve pas : la lecture reste à confirmer.
    const doubtful = finishPayslipReading({ ...whole, netBeforeTax: 1900, totalEarnings: undefined, totalDeductions: undefined });
    expect(isProvenPayslipReading(doubtful)).toBe(false);
    expect(find(doubtful, "proof")).toMatchObject({ tone: "warn", title: "Lecture à confirmer" });
  });
});
