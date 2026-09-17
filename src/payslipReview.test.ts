import { describe, expect, it } from "vitest";
import {
  describePayslipGap,
  explainPayslipGap,
  isUnplannedPayslipCarence,
  shouldReportMissingPayslipField,
  summarizePayslipReview,
} from "./payslipReview";

// Les montants gardent leurs espaces insécables : on les ramène à des espaces simples pour comparer.
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");

describe("écart expliqué en une phrase", () => {
  it("compte les dimanches manquants ou en trop", () => {
    expect(plain(describePayslipGap({ key: "sundays", label: "Dimanches payés", found: 1, expected: 3 }))).toBe("2 dimanches non payés");
    expect(plain(describePayslipGap({ key: "sundays", label: "Dimanches payés", found: 2, expected: 1 }))).toBe("1 dimanche payé en plus");
  });

  it("dit le sens et le montant de l’écart pour une ligne en euros", () => {
    expect(plain(describePayslipGap({ key: "ifse", label: "IFSE", found: 470, expected: 500 }))).toBe("IFSE : 30,00 € de moins que prévu");
    expect(plain(describePayslipGap({ key: "navigo", label: "Remboursement Navigo", found: 50.5, expected: 43.2 }))).toBe("Remboursement Navigo : 7,30 € de plus que prévu");
  });

  it("reformule le taux d’imposition, les titres repas et la carence", () => {
    expect(plain(describePayslipGap({ key: "pas-rate", label: "Taux", found: 6.1, expected: 5.2 }))).toBe("Taux d’imposition de 6,1 % au lieu de 5,2 %");
    expect(plain(describePayslipGap({ key: "meal-vouchers", label: "Titres repas", found: 72.4, expected: 60 }))).toBe("Titres repas : 12,40 € de retenue en plus");
    expect(plain(describePayslipGap({ key: "carence", label: "Jour de carence", found: 45.5, expected: 0 }))).toBe("Jour de carence retenu (45,50 €) sans arrêt maladie enregistré");
  });

  it("ne dit rien d’une ligne absente du bulletin", () => {
    expect(describePayslipGap({ key: "ifse", label: "IFSE", found: undefined, expected: 500 })).toBe("");
  });
});

describe("résumé de vérification d'un bulletin", () => {
  it("annonce un résultat rassurant quand les lignes lisibles concordent", () => {
    const result = summarizePayslipReview([
      { key: "gross", label: "Cumul brut", found: 2600, expected: 2600 },
      { key: "sundays", label: "Dimanches", found: 3, expected: 3, tolerance: 1 },
    ]);
    expect(result.verdict).toBe("Comparaison complète — aucun écart");
    expect(result.tone).toBe("ok");
  });

  it("reste explicite avec une seule ligne correcte et le brut/net non vérifiables", () => {
    const result = summarizePayslipReview([
      { key: "base", label: "Traitement de base", found: 1800, expected: 1800 },
      { key: "gross", label: "Brut", found: undefined, expected: 2500 },
      { key: "net-before-tax", label: "Net avant impôt", found: undefined, expected: 2050 },
    ]);
    expect(result.verdict).toBe("Vérification partielle — aucun écart sur les lignes vérifiées");
    expect(result.tone).toBe("partial");
    expect(result.verified).toHaveLength(1);
    expect(result.unavailable).toHaveLength(2);
  });

  it("compte seulement les écarts réellement vérifiables", () => {
    const result = summarizePayslipReview([
      { key: "gross", label: "Cumul brut", found: 2500, expected: 2600 },
      { key: "ifse", label: "IFSE", found: undefined, expected: 300 },
      { key: "sundays", label: "Dimanches", found: 2, expected: 4, tolerance: 1 },
    ]);
    expect(result.verdict).toBe("2 points à vérifier");
    expect(result.issues.map((item) => item.key)).toEqual(["gross", "sundays"]);
    expect(result.unavailable.map((item) => item.key)).toEqual(["ifse"]);
  });

  it("ne transforme pas un bulletin illisible en faux problème", () => {
    const result = summarizePayslipReview([
      { key: "gross", label: "Cumul brut", found: undefined, expected: 2600 },
    ]);
    expect(result.verdict).toBe("Comparaison impossible");
    expect(result.tone).toBe("unknown");
    expect(result.issues).toHaveLength(0);
  });

  it("ne réclame ni CIA ni carence absents pendant une simple vérification", () => {
    expect(shouldReportMissingPayslipField("cia", "verify")).toBe(false);
    expect(shouldReportMissingPayslipField("carenceDay", "verify")).toBe(false);
    expect(shouldReportMissingPayslipField("baseSalary", "verify")).toBe(true);
    expect(shouldReportMissingPayslipField("cia", "calibrate")).toBe(true);
  });

  it("signale une carence lue seulement quand aucun arrêt n’était prévu", () => {
    expect(isUnplannedPayslipCarence(77.5, 0)).toBe(true);
    expect(isUnplannedPayslipCarence(77.5, 1)).toBe(false);
    expect(isUnplannedPayslipCarence(undefined, 0)).toBe(false);
  });

  it("explique concrètement la cause probable de chaque écart", () => {
    expect(explainPayslipGap({ key: "ifse", label: "IFSE", found: 300, expected: 350 }))
      .toContain("profil de paie");
    expect(explainPayslipGap({ key: "inconnu", label: "Autre", found: 1, expected: 2 }))
      .toContain("Vérifiez");
  });
});
