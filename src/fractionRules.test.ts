import { describe, expect, it } from "vitest";
import { computeLeaveStats } from "./leaveStats";
import { dateKey, fromKey, getDayInfo, addDays } from "./planningLogic";
import { fractionAllowance, isOffSeasonDate, nextFractionStep } from "./fractionRules";

/** Les premiers jours travaillés du groupe 2 à partir d'une date. */
function workDays(from: string, count: number) {
  const days: string[] = [];
  for (let date = fromKey(from); days.length < count; date = addDays(date, 1)) {
    const info = getDayInfo(date, 2);
    if (!info.holiday && info.kind !== "off") days.push(dateKey(date));
  }
  return days;
}

describe("jours de fractionnement", () => {
  it("garde les 2 jours d'office avant 2027", () => {
    expect(fractionAllowance(2026, "visitor_service", 0)).toBe(2);
    expect(nextFractionStep(2026, "visitor_service", 0)).toBeNull();
  });

  it("applique les seuils de chaque catégorie dès 2027", () => {
    expect([0, 3.5, 4, 6.5, 7, 12].map((days) => fractionAllowance(2027, "visitor_service", days))).toEqual([0, 0, 1, 1, 2, 2]);
    expect([4.5, 5, 7.5, 8].map((days) => fractionAllowance(2027, "general", days))).toEqual([0, 1, 1, 2]);
    expect([1.5, 2, 2.5, 3].map((days) => fractionAllowance(2027, "asi_24h", days))).toEqual([0, 0.5, 0.5, 1]);
    expect(fractionAllowance(2027, undefined, 4)).toBe(1);
  });

  it("annonce ce qu'il manque pour le palier suivant", () => {
    expect(nextFractionStep(2027, "visitor_service", 2.5)).toEqual({ missing: 1.5, grant: 1 });
    expect(nextFractionStep(2027, "visitor_service", 5)).toEqual({ missing: 2, grant: 2 });
    expect(nextFractionStep(2027, "visitor_service", 7)).toBeNull();
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
    const stats = computeLeaveStats({ year: 2027, today: new Date(2027, 0, 1), periods: periods as never, group: 2, manualAdjustments: undefined });
    expect(stats.fractionRule).toEqual({ offSeasonDays: 4, next: { missing: 3, grant: 2 } });
    expect(stats.balances.find((balance) => balance.type === "fraction")?.allowance).toBe(1);

    const general = computeLeaveStats({ year: 2027, today: new Date(2027, 0, 1), periods: periods as never, group: 2, manualAdjustments: undefined, fractionCategory: "general" });
    expect(general.balances.find((balance) => balance.type === "fraction")?.allowance).toBe(0);

    const before = computeLeaveStats({ year: 2026, today: new Date(2026, 0, 1), periods: [], group: 2, manualAdjustments: undefined });
    expect(before.fractionRule).toBeNull();
    expect(before.balances.find((balance) => balance.type === "fraction")?.allowance).toBe(2);
  });
});
