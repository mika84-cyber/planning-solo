import { describe, expect, it } from "vitest";
import {
  MECENAT_REGULATORY_RATES,
  calculateMecenatVacation,
  mecenatForPayMonth,
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
