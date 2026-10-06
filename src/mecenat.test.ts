import { describe, expect, it } from "vitest";
import {
  MECENAT_REGULATORY_RATES,
  calculateMecenatVacation,
  mecenatForPayMonth,
  mecenatsPaidEarly,
  type MecenatEntry,
} from "./mecenat";
import type { WorkQuota } from "./overtime";

const quotas: WorkQuota[] = ["full", "three_quarters", "half"];

describe("calcul réglementaire des mécénats", () => {
  it.each([
    ["10:00", "12:00", 120, 0, 4580],
    ["19:00", "21:00", 120, 0, 4580],
    ["19:00", "00:00", 180, 120, 13870],
    ["21:00", "23:00", 60, 60, 5790],
    ["23:00", "02:00", 0, 180, 10500],
    ["06:00", "08:00", 60, 60, 5790],
  ])(
    "%s → %s est découpé entre jour et nuit",
    (start, end, dayMinutes, nightMinutes, grossAmountCents) => {
      const result = calculateMecenatVacation(start, end, "full");
      expect(result).toMatchObject({ dayMinutes, nightMinutes, grossAmountCents });
    },
  );

  it("applique exactement les mêmes tarifs aux trois quotités", () => {
    const results = quotas.map((quota) =>
      calculateMecenatVacation("19:00", "00:00", quota),
    );
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(MECENAT_REGULATORY_RATES.dayRateCents).toBe(2290);
    expect(MECENAT_REGULATORY_RATES.nightRateCents).toBe(3500);
  });

  it("refuse une durée nulle", () => {
    expect(calculateMecenatVacation("19:00", "19:00", "full")).toBeNull();
  });
});

describe("rattachement à la paie", () => {
  it("ne regroupe que les mécénats automatiquement rattachés au mois suivant", () => {
    const base: MecenatEntry = {
      id: "mecenat-1",
      date: "2026-09-12",
      start: "19:00",
      end: "00:00",
      dayMinutes: 180,
      nightMinutes: 120,
      grossAmountCents: 13870,
      payYear: 2026,
      payMonth: 9,
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    const result = mecenatForPayMonth(
      [base, { ...base, id: "mecenat-2", payMonth: 10 }],
      2026,
      9,
    );
    expect(result.lines).toHaveLength(1);
    expect(result.grossAmountCents).toBe(13870);
  });
});

describe("mécénat payé en avance", () => {
  const entry = (id: string, date: string, grossAmountCents: number, payMonth: number) => ({
    id, date, start: "19:00", end: "23:00", dayMinutes: 180, nightMinutes: 60,
    grossAmountCents, payYear: 2026, payMonth, updatedAt: "",
  });

  it("retrouve le mécénat d'octobre prévu en novembre qu'un bulletin d'octobre a déjà payé", () => {
    const entries = [entry("sept", "2026-09-20", 8_000, 9), entry("oct-1", "2026-10-05", 10_370, 10), entry("oct-2", "2026-10-25", 5_000, 10)];
    // Bulletin d'octobre : 80 € attendus (septembre) + 103,70 € payés en avance.
    const early = mecenatsPaidEarly(entries, 2026, 9, 18_370);
    expect(early.surplusCents).toBe(10_370);
    expect(early.candidates.map((item) => item.id)).toEqual(["oct-1", "oct-2"]);
    expect(early.matched.map((item) => item.id)).toEqual(["oct-1"]);
  });

  it("ne propose rien quand le bulletin paie exactement ce qui était prévu", () => {
    const entries = [entry("sept", "2026-09-20", 8_000, 9), entry("oct-1", "2026-10-05", 10_370, 10)];
    expect(mecenatsPaidEarly(entries, 2026, 9, 8_010).candidates).toEqual([]);
  });

  it("laisse choisir mécénat par mécénat quand le surplus ne s'explique pas entièrement", () => {
    const entries = [entry("oct-1", "2026-10-05", 10_370, 10), entry("oct-2", "2026-10-25", 5_000, 10)];
    const early = mecenatsPaidEarly(entries, 2026, 9, 7_000);
    expect(early.candidates).toHaveLength(2);
    expect(early.matched).toEqual([]);
  });

  it("passe à janvier pour un bulletin de décembre", () => {
    const entries = [{ ...entry("dec", "2026-12-12", 6_000, 0), payYear: 2027 }];
    expect(mecenatsPaidEarly(entries, 2026, 11, 6_000).matched.map((item) => item.id)).toEqual(["dec"]);
  });
});

