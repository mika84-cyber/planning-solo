import { describe, expect, it } from "vitest";
import { computeLeaveStats } from "./leaveStats";
import { dateKey, fromKey, getDayInfo, addDays } from "./planningLogic";
import { fractionAllowance, isOffSeasonDate } from "./fractionRules";
import { EMPTY_MANUAL_ADJUSTMENTS } from "./payAllowances";

// 2026 soldé : les CA de janvier 2027 ne partent pas sur son reste.
const spent2026 = { "2026": { ...EMPTY_MANUAL_ADJUSTMENTS, annualUsed: 29 } };

/** Les premiers jours travaillés du groupe 2 à partir d'une date. */
function workDays(from: string, count: number) {
  const days: string[] = [];
  for (let date = fromKey(from); days.length < count; date = addDays(date, 1)) {
    const info = getDayInfo(date, 2);
    if (!info.holiday && info.kind !== "off") days.push(dateKey(date));
  }
  return days;
}

describe("jours de fractionnement des agents d'accueil", () => {
  it("garde les 2 jours d'office avant 2027", () => {
    expect(fractionAllowance(2026, 0)).toBe(2);
  });

  it("accorde 1 jour dès 4 jours hors période, 2 jours dès 7", () => {
    expect([0, 3.5, 4, 6.5, 7, 12].map((days) => fractionAllowance(2027, days))).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it("ne compte que les jours hors du 1er mai au 31 octobre", () => {
    expect(["2027-04-30", "2027-05-01", "2027-10-31", "2027-11-01"].map(isOffSeasonDate)).toEqual([true, false, false, true]);
  });

  it("compte les CA hors période dans les soldes, sans les RTT ni l'été", () => {
    const period = (id: string, date: string, leaveType: "annual" | "rtt") => ({ id, from: date, to: date, leaveType, group: 2 });
    const winter = workDays("2027-01-11", 5);
    const summer = workDays("2027-07-05", 3);
    const periods = [
      ...winter.slice(0, 4).map((date, index) => period(`ca-${index}`, date, "annual")),
      period("rtt", winter[4], "rtt"),
      ...summer.map((date, index) => period(`ete-${index}`, date, "annual")),
    ];
    const stats = computeLeaveStats({ year: 2027, today: new Date(2027, 0, 1), periods: periods as never, group: 2, manualAdjustments: spent2026 });
    expect(stats.balances.find((balance) => balance.type === "fraction")?.allowance).toBe(1);

    const before = computeLeaveStats({ year: 2026, today: new Date(2026, 0, 1), periods: [], group: 2, manualAdjustments: undefined });
    expect(before.balances.find((balance) => balance.type === "fraction")?.allowance).toBe(2);
  });
});
