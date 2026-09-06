import { describe, expect, it } from "vitest";
import type { FormProfile } from "./appModel";
import {
  annualPayProfilePayload,
  effectivePayProfile,
  hasPayProfileHistory,
  nextSundayPayoutSlot,
  parsedPayDraft,
  payAmountPayload,
  payProfileBase,
  payslipImportFields,
} from "./usePayActions";

describe("usePayActions — conversions et payloads sûrs", () => {
  it("applique un changement de paie à partir de son mois sans modifier les mois précédents", () => {
    const profiles = {
      "2026": { baseSalary: 2_000, ifse: 300, pasRate: 5 },
      "2026-09": { baseSalary: 2_100, ifse: 325, pasRate: 6 },
    };
    expect(effectivePayProfile(profiles, 2026, 7)).toMatchObject({ baseSalary: 2_000, ifse: 300, pasRate: 5 });
    expect(effectivePayProfile(profiles, 2026, 8)).toMatchObject({ baseSalary: 2_100, ifse: 325, pasRate: 6 });
    expect(effectivePayProfile(profiles, 2026, 10)).toMatchObject({ baseSalary: 2_100, ifse: 325, pasRate: 6 });
  });

  it("ne reprend pas un taux actuel du profil général avant son premier mois d’effet", () => {
    const profiles = {
      "2026": { baseSalary: 2_000 },
      "2026-09": { pasRate: 2.2 },
    };
    expect(hasPayProfileHistory(profiles, 2026)).toBe(true);
    expect(effectivePayProfile(profiles, 2026, 7).pasRate).toBeUndefined();
    expect(effectivePayProfile(profiles, 2026, 8).pasRate).toBe(2.2);
  });

  it("accepte les formats français usuels sans perdre les centimes", () => {
    expect(parsedPayDraft("1 234,56")).toBe(1234.56);
    expect(parsedPayDraft("79.65")).toBe(79.65);
  });

  it("envoie les taux en points de base et les montants en centimes", () => {
    const profile: FormProfile = {
      fullName: "Agent Test",
      group: "2",
      signature: "signature",
    };
    expect(payAmountPayload("netRatioFixed", 79.65, 2026, 8, profile)).toEqual({
      action: "save-form-profile",
      payYear: 2026,
      payMonth: 8,
      fullName: "Agent Test",
      group: "2",
      signature: "signature",
      netRatioFixedBp: 7965,
    });
    expect(payAmountPayload("baseSalary", 2345.67, 2026, 8, profile)).toEqual({
      action: "save-form-profile",
      payYear: 2026,
      payMonth: 8,
      fullName: "Agent Test",
      group: "2",
      signature: "signature",
      baseSalaryCents: 234567,
    });
  });

  it("crée un profil annuel avec les valeurs actuellement utilisées", () => {
    const profile: FormProfile = { fullName: "Agent Test", group: "2", signature: "signature" };
    expect(annualPayProfilePayload(2027, profile, {
      baseSalary: 2345.67,
      netRatioFixed: 79.65,
      pasRate: 4.2,
    })).toMatchObject({
      action: "save-form-profile",
      payYear: 2027,
      baseSalaryCents: 234567,
      netRatioFixedBp: 7965,
      pasRateBp: 420,
    });
  });

  it("conserve le cycle quadrimestriel des reports de dimanches", () => {
    expect(nextSundayPayoutSlot(2026, 6)).toEqual({ year: 2026, month: 9 });
    expect(nextSundayPayoutSlot(2026, 9)).toEqual({ year: 2026, month: 11 });
    expect(nextSundayPayoutSlot(2026, 11)).toEqual({ year: 2027, month: 0 });
    expect(nextSundayPayoutSlot(2027, 0)).toEqual({ year: 2027, month: 6 });
    expect(nextSundayPayoutSlot(2026, 4)).toBeNull();
  });

  it("n’attend pas IFSE et CIA sur le bulletin d’une contractuelle", () => {
    const fonctionnaire = payslipImportFields(false).map((field) => field.key);
    const contractuelle = payslipImportFields(true).map((field) => field.key);
    expect(fonctionnaire).toContain("ifse");
    expect(fonctionnaire).toContain("cia");
    expect(contractuelle).not.toContain("ifse");
    expect(contractuelle).not.toContain("cia");
  });

  it("conserve une IFSE réellement détectée même si le profil était contractuel", () => {
    const detected = payslipImportFields(true, true).map((field) => field.key);
    expect(detected).toContain("ifse");
    expect(detected).toContain("cia");
  });

  it("reconstruit le socle du profil sans réintroduire un ancien report", () => {
    const profile: FormProfile = {
      fullName: "Agent Test",
      group: "3",
      signature: "signature",
      baseSalary: 2500,
      netRatioRegime: "culture-psc",
      sundayCarryover: 2,
      sundayCarryoverYear: 2026,
      sundayCarryoverMonth: 9,
    };
    const base = payProfileBase(profile, 1);
    expect(base).toMatchObject({
      fullName: "Agent Test",
      group: "3",
      signature: "signature",
      baseSalary: 2500,
    });
    expect(base).not.toHaveProperty("netRatioRegime");
    expect(base).not.toHaveProperty("sundayCarryover");
    expect(base).not.toHaveProperty("sundayCarryoverYear");
  });
});
