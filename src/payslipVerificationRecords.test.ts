import { describe, expect, it } from "vitest";
import {
  mergePayslipVerifications,
  payslipVerificationFor,
  sanitizePayslipVerifications,
  withoutPayslipVerification,
  withPayslipVerification,
  type PayslipVerificationRecord,
} from "./payslipVerificationRecords";

const okSeptember: PayslipVerificationRecord = {
  status: "ok",
  year: 2026,
  month: 8,
  sourceName: "bulletin-septembre.pdf",
  note: "",
  issues: [],
  unavailableCount: 1,
  verifiedCount: 5,
  updatedAt: "2026-10-02T08:00:00.000Z",
};

describe("décisions de vérification gardées dans le compte", () => {
  it("ne garde que des décisions bien formées, rangées sous leur mois", () => {
    const records = sanitizePayslipVerifications({
      "2026-09": { ...okSeptember, year: 1999, month: 3 },
      "2026-13": okSeptember,
      "pas-un-mois": okSeptember,
      "2026-10": { ...okSeptember, status: "peut-être" },
      "2026-08": {
        ...okSeptember,
        status: "attention",
        issues: [{ key: "gross", label: "Cumul brut", found: "2900", expected: 2950 }, { label: "sans attendu" }],
      },
    });
    expect(Object.keys(records).sort()).toEqual(["2026-08", "2026-09"]);
    // L'année et le mois viennent de la clé, pas du contenu envoyé.
    expect(records["2026-09"]).toMatchObject({ year: 2026, month: 8, status: "ok" });
    expect(records["2026-08"].issues).toEqual([{ key: "gross", label: "Cumul brut", found: 2900, expected: 2950 }]);
    expect(sanitizePayslipVerifications(["2026-09"])).toEqual({});
  });

  it("ajoute, retrouve et retire la décision d'un mois", () => {
    const records = withPayslipVerification({}, okSeptember);
    expect(payslipVerificationFor(records, 2026, 8)).toEqual(okSeptember);
    expect(payslipVerificationFor(withoutPayslipVerification(records, 2026, 8), 2026, 8)).toBeNull();
  });

  it("réunit l'appareil et le compte en gardant la décision la plus récente", () => {
    const later = { ...okSeptember, status: "attention" as const, updatedAt: "2026-10-05T08:00:00.000Z" };
    const october = { ...okSeptember, month: 9, updatedAt: "2026-11-02T08:00:00.000Z" };
    const merged = mergePayslipVerifications({ "2026-09": okSeptember }, { "2026-09": later, "2026-10": october });
    expect(merged["2026-09"].status).toBe("attention");
    expect(merged["2026-10"]).toEqual(october);
    expect(mergePayslipVerifications({ "2026-09": later }, { "2026-09": okSeptember })["2026-09"].status).toBe("attention");
  });
  it("garde l’écart expliqué, ligne à ligne, et le destinataire du courrier", () => {
    const gap = {
      level: "net" as const,
      expected: { gross: 2822.48, netBeforeTax: 2277.19, incomeTax: 52.95, net: 2224.24 },
      actual: { gross: 2795.02, netBeforeTax: 2252.55, incomeTax: 52.38, net: 2200.17 },
      gap: -24.07,
      lines: [
        { key: "sundays", title: "Un demi-dimanche non payé", detail: "6,5 payés", amount: -27.46, kind: "cause" as const, found: 6.5, expected: 7 },
        { key: "contributions", title: "Moins de cotisations", detail: "prélevées sur ce demi-dimanche", amount: 2.82, kind: "follow" as const },
      ],
    };
    const records = sanitizePayslipVerifications({
      "2026-10": { ...okSeptember, month: 9, gap, recipient: "Service des ressources humaines" },
      "2026-11": { ...okSeptember, month: 10, gap: { ...gap, lines: [{ ...gap.lines[0], kind: "autre" }], expected: { gross: "beaucoup" } } },
    });
    expect(records["2026-10"].gap).toEqual(gap);
    expect(records["2026-10"].recipient).toBe("Service des ressources humaines");
    expect(records["2026-11"].gap).toEqual({ ...gap, expected: {}, lines: [] });
    expect(sanitizePayslipVerifications({ "2026-09": okSeptember })["2026-09"]).not.toHaveProperty("gap");
  });
});
