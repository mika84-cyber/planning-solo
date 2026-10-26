import { describe, expect, it } from "vitest";
import type { MecenatEntry } from "./mecenat";
import { payslipGapChoices, unpaidMecenats, type PayslipGapContext } from "./payslipGapChoices";

const entry = (id: string, date: string, grossAmountCents: number): MecenatEntry => ({
  id, date, start: "19:00", end: "23:00", dayMinutes: 180, nightMinutes: 60,
  grossAmountCents, payYear: 2026, payMonth: 9, updatedAt: "",
});

const context: PayslipGapContext = {
  year: 2026,
  month: 9,
  mecenatLines: [],
  bulletinMecenatCents: 0,
  nextSundayPayout: { year: 2026, month: 11 },
  holidayPending: 0,
};

describe("choix proposés devant un écart du bulletin", () => {
  it("applique le taux d’imposition du bulletin", () => {
    const [choice] = payslipGapChoices({ key: "pas-rate", label: "Taux d’imposition (PAS)", found: 2.2, expected: 1.7 }, context);
    expect(choice.label).toBe("Appliquer le taux du bulletin : 2,2 %");
    expect(choice.detail).toContain("à partir de octobre 2026");
    expect(choice.action).toEqual({ kind: "save-amount", field: "pasRate", value: 2.2 });
  });

  it("enregistre dans le profil le montant que le bulletin porte", () => {
    const [ifse] = payslipGapChoices({ key: "ifse", label: "IFSE", found: 416.66, expected: 415 }, context);
    expect(ifse.action).toEqual({ kind: "save-amount", field: "ifse", value: 416.66 });
    expect(ifse.detail).toContain("l’IFSE");
    const [meal] = payslipGapChoices({ key: "meal-vouchers", label: "Titres repas", found: 82.4, expected: 99 }, context);
    expect(meal.action).toEqual({ kind: "save-amount", field: "mealVoucherDeduction", value: 82.4 });
    // L'indemnité de résidence suit le traitement : rien à enregistrer à part.
    expect(payslipGapChoices({ key: "residence", label: "Indemnité de résidence", found: 55.68, expected: 54.05 }, context)).toEqual([]);
    // Une ligne absente du bulletin ne donne aucun geste.
    expect(payslipGapChoices({ key: "ifse", label: "IFSE", found: undefined, expected: 415 }, context)).toEqual([]);
  });

  it("propose de passer en fonctionnaire quand le bulletin porte une IFSE", () => {
    const [choice] = payslipGapChoices({ key: "status", label: "IFSE ou CIA", found: 416.66, expected: 0 }, context);
    expect(choice.label).toBe("Passer mon statut en Fonctionnaire");
    expect(choice.action).toEqual({ kind: "set-status", status: "fonctionnaire" });
  });

  it("reporte les dimanches non payés sur la paie primée suivante", () => {
    const [choice] = payslipGapChoices({ key: "sundays", label: "Dimanches payés", found: 2, expected: 4, tolerance: 1 }, context);
    expect(choice.label).toBe("Reporter 2 dimanches sur décembre 2026");
    expect(choice.action).toEqual({ kind: "report-sundays", count: 2 });
    // Un demi-dimanche se reporte aussi, par moitié.
    const [half] = payslipGapChoices({ key: "sundays", label: "Dimanches payés", found: 6.5, expected: 7, tolerance: 0.25 }, context);
    expect(half.label).toBe("Reporter le demi-dimanche sur décembre 2026");
    expect(half.action).toEqual({ kind: "report-sundays", count: 0.5 });
    // Plus de dimanches payés que prévu, ou pas de paie primée connue : rien.
    expect(payslipGapChoices({ key: "sundays", label: "Dimanches payés", found: 5, expected: 4 }, context)).toEqual([]);
    expect(payslipGapChoices({ key: "sundays", label: "Dimanches payés", found: 2, expected: 4 }, { ...context, nextSundayPayout: null })).toEqual([]);
  });

  it("renvoie aux choix de compensation quand un férié attendu n’est pas payé", () => {
    const [choice] = payslipGapChoices({ key: "holidays", label: "Jours fériés travaillés", found: 0, expected: 262.05 }, { ...context, holidayPending: 1 });
    expect(choice.action).toEqual({ kind: "open-holiday-choices" });
    expect(choice.detail).toContain("1 férié à décider");
    const [decided] = payslipGapChoices({ key: "holidays", label: "Jours fériés travaillés", found: 0, expected: 262.05 }, context);
    expect(decided.detail).toContain("rappel « R »");
  });

  it("reporte sur la paie suivante le mécénat attendu que le bulletin ne paie pas", () => {
    const lines = [entry("m1", "2026-09-05", 10_370), entry("m2", "2026-09-19", 5_000)];
    // Aucun mécénat sur le bulletin : les deux sont reportés.
    const [both] = payslipGapChoices({ key: "gross", label: "Cumul brut", found: 2546.3, expected: 2700.02 }, { ...context, mecenatLines: lines });
    expect(both.label).toBe("Reporter les 2 mécénats sur novembre 2026");
    expect(both.detail).toContain("153,70");
    expect(both.action).toMatchObject({ kind: "defer-mecenats", year: 2026, month: 10 });
    expect((both.action as { entries: MecenatEntry[] }).entries.map((item) => item.id)).toEqual(["m1", "m2"]);
    // Le premier est payé (103,70 €) : seul le second est reporté.
    expect(unpaidMecenats(lines, 10_370).map((item) => item.id)).toEqual(["m2"]);
    // Un montant qui n'explique aucun mécénat : on ne devine pas.
    expect(unpaidMecenats(lines, 7_000)).toEqual([]);
    // Décembre reporte sur janvier de l'année suivante.
    const [january] = payslipGapChoices({ key: "gross", label: "Cumul brut", found: 2500, expected: 2600 }, { ...context, month: 11, mecenatLines: [lines[0]] });
    expect(january.label).toBe("Reporter le mécénat sur janvier 2027");
    // Un brut plus élevé que prévu n'est pas un mécénat manquant.
    expect(payslipGapChoices({ key: "gross", label: "Cumul brut", found: 2800, expected: 2700 }, { ...context, mecenatLines: lines })).toEqual([]);
  });

  it("ne propose rien pour un écart qu’aucun geste simple n’explique", () => {
    expect(payslipGapChoices({ key: "net-before-tax", label: "Net avant impôt", found: 2100, expected: 2167.3 }, context)).toEqual([]);
    expect(payslipGapChoices({ key: "carence", label: "Jour de carence non prévu", found: 77.5, expected: 0 }, context)).toEqual([]);
  });
});
