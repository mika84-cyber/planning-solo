import { describe, expect, it } from "vitest";
import { collectWorkedDays, computePayAllowances } from "./payAllowances";
import { dateKey, getDayInfo } from "./planningLogic";
import { nextSundayPayoutSlot } from "./usePayActions";

describe("report des dimanches manquants", () => {
  it("reporte sur la paie primée suivante, jamais sur le mois d’après", () => {
    expect(nextSundayPayoutSlot(2026, 6)).toEqual({ year: 2026, month: 9 });
    expect(nextSundayPayoutSlot(2026, 9)).toEqual({ year: 2026, month: 11 });
    expect(nextSundayPayoutSlot(2026, 11)).toEqual({ year: 2027, month: 0 });
    expect(nextSundayPayoutSlot(2027, 0)).toEqual({ year: 2027, month: 6 });
    // Un mois sans prime de dimanche n'a rien à reporter.
    expect(nextSundayPayoutSlot(2026, 10)).toBeNull();
  });

  it("dit sur chaque paie d’où vient et où part le report", () => {
    const allowances = computePayAllowances({
      year: 2026,
      today: new Date(2026, 8, 18),
      entries: {},
      periods: [],
      group: 2,
      manualAdjustments: undefined,
      baseSalary: 2000,
      sundayCarryover: 2,
      sundayCarryoverYear: 2026,
      sundayCarryoverMonth: 11,
      sundayCarryoverFromYear: 2026,
      sundayCarryoverFromMonth: 9,
    });
    const october = allowances.monthly.find((slot) => slot.index === 9)!;
    const december = allowances.monthly.find((slot) => slot.index === 11)!;
    expect(october).toMatchObject({ reported: 2, reportedTo: { year: 2026, month: 11 } });
    expect(december).toMatchObject({ carryover: 2, carriedFrom: { year: 2026, month: 9 } });
  });

  it("tient compte des échanges pour les dimanches travaillés", () => {
    const base = { year: 2026, today: new Date(2026, 8, 22), periods: [], group: 2, manualAdjustments: undefined, baseSalary: 2000, sundayCarryover: 0, sundayCarryoverYear: undefined, sundayCarryoverMonth: undefined, sundayCarryoverFromYear: undefined, sundayCarryoverFromMonth: undefined };
    const sundays = (entries = {}) => computePayAllowances({ ...base, entries }).sundays.map((item) => item.key);
    const scheduled = sundays();
    const given = scheduled.find((key) => key > "2026-09-22")!;
    const rest = Array.from({ length: 60 }, (_, index) => new Date(2026, 8, 27 + index * 7, 12))
      .map((date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"))
      .find((key) => key.startsWith("2026") && !scheduled.includes(key))!;
    const exchanged = sundays({ [given]: { exchangeRole: "given" }, [rest]: { exchangeRole: "return" } });
    expect(exchanged).not.toContain(given);
    expect(exchanged).toContain(rest);
    expect(exchanged).toEqual([...exchanged].sort());
  });

  it("tient compte des échanges pour les jours fériés travaillés", () => {
    const base = { year: 2026, today: new Date(2026, 8, 22), periods: [], group: 2, manualAdjustments: undefined, baseSalary: 2000, sundayCarryover: 0, sundayCarryoverYear: undefined, sundayCarryoverMonth: undefined, sundayCarryoverFromYear: undefined, sundayCarryoverFromMonth: undefined };
    const holidays = (entries = {}) => collectWorkedDays({ ...base, entries }).holidays.map((item) => item.key);
    const worked = holidays();
    const days = Array.from({ length: 365 }, (_, index) => new Date(2026, 0, 1 + index, 12));
    const restHoliday = days.find((date) => getDayInfo(date, 2).holiday && getDayInfo(date, 2).kind === "off")!;
    const given = worked[0];
    const returned = dateKey(restHoliday);
    const exchanged = holidays({ [given]: { exchangeRole: "given" }, [returned]: { exchangeRole: "return" } });
    expect(exchanged).not.toContain(given);
    expect(exchanged).toContain(returned);
  });
});
