import { describe, expect, it } from "vitest";
import type { FormProfile } from "./appModel";
import {
  nextSundayPayoutSlot,
  parsedPayDraft,
  payAmountPayload,
  payProfileBase,
  payslipImportFields,
} from "./usePayActions";

describe("usePayActions — conversions et payloads sûrs", () => {
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
    expect(payAmountPayload("netRatioFixed", 79.65, 2026, profile)).toEqual({
      action: "save-form-profile",
      payYear: 2026,
      fullName: "Agent Test",
      group: "2",
      signature: "signature",
      netRatioFixedBp: 7965,
    });
    expect(payAmountPayload("baseSalary", 2345.67, 2026, profile)).toEqual({
      action: "save-form-profile",
      payYear: 2026,
      fullName: "Agent Test",
      group: "2",
      signature: "signature",
      baseSalaryCents: 234567,
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
