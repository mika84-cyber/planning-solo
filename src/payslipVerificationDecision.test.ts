import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPayslipVerification,
  payslipAnomalyReportLines,
  removePayslipVerification,
  savePayslipVerification,
  type PayslipVerificationRecord,
} from "./payslipVerificationDecision";

const stores = new Map<string, string>();

beforeEach(() => {
  stores.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stores.get(key) ?? null,
    setItem: (key: string, value: string) => stores.set(key, value),
  });
});

const attentionRecord: PayslipVerificationRecord = {
  status: "attention",
  year: 2026,
  month: 8,
  sourceName: "bulletin-septembre.pdf",
  note: "Le montant du dimanche manque.",
  issues: [{ key: "sundays", label: "Dimanches payés", found: 1, expected: 2, tolerance: 1 }],
  verifiedCount: 4,
  unavailableCount: 2,
  updatedAt: "2026-09-07T10:00:00.000Z",
};

describe("décision de vérification du bulletin", () => {
  it("isole le résultat par compte et par mois", () => {
    savePayslipVerification("mika@example.test", attentionRecord);
    expect(loadPayslipVerification("mika@example.test", 2026, 8)).toEqual(attentionRecord);
    expect(loadPayslipVerification("agnes@example.test", 2026, 8)).toBeNull();
    expect(loadPayslipVerification("mika@example.test", 2026, 7)).toBeNull();
    removePayslipVerification("mika@example.test", 2026, 8);
    expect(loadPayslipVerification("mika@example.test", 2026, 8)).toBeNull();
  });

  it("prépare le PDF avec les anomalies et les compteurs utiles", () => {
    expect(payslipAnomalyReportLines(attentionRecord)).toEqual([
      "Bulletin : bulletin-septembre.pdf",
      "Lignes vérifiées : 4",
      "Lignes non vérifiables : 2",
      "Dimanches payés — bulletin : 1 ; attendu : 2",
      "Observation : Le montant du dimanche manque.",
    ]);
  });

  it("explique un signalement manuel sans inventer d’écart", () => {
    expect(payslipAnomalyReportLines({ ...attentionRecord, note: "", issues: [] })).toContain(
      "Anomalie signalée manuellement — aucun écart n’a été identifié automatiquement.",
    );
  });
});
