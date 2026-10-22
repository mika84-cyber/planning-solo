import { describe, expect, it } from "vitest";
import { sundayReportAfterReading } from "./sundayReport";

describe("report automatique de dimanches à la lecture d’un bulletin", () => {
  it("reporte les dimanches que le bulletin ne paie pas", () => {
    expect(sundayReportAfterReading({ expected: 4, reported: 0, paid: 0 })).toEqual({ kind: "report", count: 4 });
    expect(sundayReportAfterReading({ expected: 4, reported: 0, paid: 3 })).toEqual({ kind: "report", count: 1 });
    expect(sundayReportAfterReading({ expected: 4, reported: 0, paid: 4 })).toEqual({ kind: "keep" });
    expect(sundayReportAfterReading({ expected: 0, reported: 0, paid: 0 })).toEqual({ kind: "keep" });
  });

  it("relu, le même mois repart du compte entier : le report d’avant s’ajuste ou disparaît", () => {
    // Première lecture ratée : 4 dimanches reportés, le mois n'en affiche plus.
    // Relu, le bulletin les paie tous : le report est retiré.
    expect(sundayReportAfterReading({ expected: 0, reported: 4, paid: 4 })).toEqual({ kind: "clear" });
    // Il n'en paie que 3 : un seul reste reporté, au lieu de 4.
    expect(sundayReportAfterReading({ expected: 0, reported: 4, paid: 3 })).toEqual({ kind: "report", count: 1 });
    // Toujours aucun : le report reste de 4.
    expect(sundayReportAfterReading({ expected: 0, reported: 4, paid: 0 })).toEqual({ kind: "report", count: 4 });
    // Plus de dimanches payés qu'attendu (un rappel) : rien à reporter.
    expect(sundayReportAfterReading({ expected: 0, reported: 2, paid: 5 })).toEqual({ kind: "clear" });
  });
});
