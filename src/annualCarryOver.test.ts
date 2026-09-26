import { describe, expect, it } from "vitest";
import { annualCharges } from "./annualCarryOver";
import { computeLeaveStats } from "./leaveStats";
import { EMPTY_MANUAL_ADJUSTMENTS } from "./payAllowances";
import { addDays, dateKey, fromKey, getDayInfo } from "./planningLogic";

function workDays(from: string, count: number) {
  const days: string[] = [];
  for (let date = fromKey(from); days.length < count; date = addDays(date, 1)) {
    const info = getDayInfo(date, 2);
    if (!info.holiday && info.kind !== "off") days.push(dateKey(date));
  }
  return days;
}
const annual = (date: string, id = date) => ({ id, from: date, to: date, leaveType: "annual" as const, group: 2 });
const manual = (year: string, annualUsed: number) => ({ [year]: { ...EMPTY_MANUAL_ADJUSTMENTS, annualUsed } });

describe("report des congés annuels jusqu'au 30 avril", () => {
  it("prend d'abord le reste de l'année précédente, jusqu'au 30 avril seulement", () => {
    const [january, february] = workDays("2027-01-11", 2);
    const [may] = workDays("2027-05-10", 1);
    // 2026 : il ne reste que 1,5 jour.
    const available = (year: number) => (year === 2026 ? 1.5 : 29);
    const { charges } = annualCharges([annual(january), annual(february), annual(may)], available);
    expect(charges.map(({ date, units, year }) => [date, units, year])).toEqual([
      [january, 1, 2026],
      [february, 0.5, 2026],
      [february, 0.5, 2027],
      [may, 1, 2027],
    ]);
  });

  it("ne reporte rien avant 2026 et rien après le 30 avril", () => {
    const [january2026] = workDays("2026-01-12", 1);
    expect(annualCharges([annual(january2026)], () => 29).charges[0].year).toBe(2026);
  });

  it("montre le report dans les soldes des deux années", () => {
    const winter = workDays("2027-01-11", 3);
    const periods = winter.map((date) => annual(date));
    const stats2026 = computeLeaveStats({ year: 2026, today: new Date(2026, 8, 27), periods: periods as never, group: 2, manualAdjustments: manual("2026", 27) });
    const cp2026 = stats2026.balances.find((balance) => balance.type === "annual");
    // 2 jours restaient en 2026 : ils partent en janvier 2027.
    expect(cp2026).toMatchObject({ used: 29, remaining: 0, upcoming: 2 });
    expect(stats2026.annualCarry).toMatchObject({ intoNext: 2, deadline: "2027-04-30" });

    const stats2027 = computeLeaveStats({ year: 2027, today: new Date(2026, 8, 27), periods: periods as never, group: 2, manualAdjustments: manual("2026", 27) });
    expect(stats2027.balances.find((balance) => balance.type === "annual")).toMatchObject({ used: 1, remaining: 28 });
    expect(stats2027.annualCarry.fromPrevious).toEqual({ year: 2026, used: 2, remaining: 0, deadline: "2027-04-30" });
  });

  it("laisse les RTT sur leur année", () => {
    const [january] = workDays("2027-01-11", 1);
    const stats = computeLeaveStats({ year: 2026, today: new Date(2026, 8, 27), periods: [{ id: "rtt", from: january, to: january, leaveType: "rtt", group: 2 }] as never, group: 2, manualAdjustments: undefined });
    expect(stats.balances.find((balance) => balance.type === "rtt")?.used).toBe(0);
  });
});
