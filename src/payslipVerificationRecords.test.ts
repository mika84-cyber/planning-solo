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
});
