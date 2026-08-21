import { describe, expect, it } from "vitest";
import { payEstimateReadiness, type PayEstimateField } from "./payEstimate";

const fields = (...values: PayEstimateField[]) => new Set(values);

describe("état des estimations brut et net", () => {
  it("indique les informations manquantes sans bulletin", () => {
    const result = payEstimateReadiness({
      isContractuel: true,
      availableFields: fields(),
      sickDays: 0,
    });
    expect(result.grossMissing).toEqual(["traitement de base"]);
    expect(result.netMissing).toEqual([
      "traitement de base",
      "taux d’imposition (PAS)",
    ]);
  });

  it("autorise les deux projections avec un bulletin contractuel complet", () => {
    const result = payEstimateReadiness({
      isContractuel: true,
      availableFields: fields("baseSalary", "pasRate"),
      sickDays: 0,
    });
    expect(result.grossReady).toBe(true);
    expect(result.netReady).toBe(true);
  });

  it("n'exige la carence que pendant un mois avec arrêt maladie", () => {
    const withoutSickLeave = payEstimateReadiness({
      isContractuel: true,
      availableFields: fields("baseSalary", "pasRate"),
      sickDays: 0,
    });
    const withSickLeave = payEstimateReadiness({
      isContractuel: true,
      availableFields: fields("baseSalary", "pasRate"),
      sickDays: 1,
    });
    expect(withoutSickLeave.grossReady).toBe(true);
    expect(withSickLeave.grossMissing).toEqual([
      "montant d’un jour de carence",
    ]);
  });

  it("accepte un taux PAS connu égal à zéro", () => {
    const result = payEstimateReadiness({
      isContractuel: true,
      availableFields: fields("baseSalary", "pasRate"),
      sickDays: 0,
    });
    expect(result.netReady).toBe(true);
  });

  it("liste les éléments propres au fonctionnaire quand le bulletin est partiel", () => {
    const result = payEstimateReadiness({
      isContractuel: false,
      availableFields: fields("baseSalary", "pasRate"),
      sickDays: 0,
    });
    expect(result.grossMissing).toEqual(["IFSE", "autres éléments fixes"]);
  });
});
