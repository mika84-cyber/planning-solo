import { describe, expect, it } from "vitest";
import { sickLeaveSummaryForYear } from "./sickLeaveSummary";

describe("sickLeaveSummaryForYear", () => {
  it("retient un arrêt fini au plus tard le 10 sur la paie du mois même", () => {
    const summary = sickLeaveSummaryForYear([
      { id: "sick", from: "2026-03-02", to: "2026-03-04", leaveType: "sick", updatedAt: "" },
    ], 2026, 3_000, 0, 100);
    expect(summary.byMonth[2].days).toBe(3);
    expect(summary.byMonth[2].total).toBeCloseTo(120);
    expect(summary.byMonth[3].days).toBe(0);
  });

  it("retient sur la paie suivante un arrêt qui déborde après le 10, en entier", () => {
    const summary = sickLeaveSummaryForYear([
      { id: "sick", from: "2026-09-08", to: "2026-09-14", leaveType: "sick", updatedAt: "" },
    ], 2026, 3_000, 0, 100);
    expect(summary.byMonth[8]).toMatchObject({ days: 0, total: 0 });
    expect(summary.byMonth[9].days).toBe(7);
    expect(summary.byMonth[9].total).toBeCloseTo(160);
    expect(summary.byMonth[9].sources[0].slice).toMatchObject({
      key: "sick:2026-09-08",
      ruleMonth: "2026-10",
      overridden: false,
    });
    // L'arrêt lui-même reste compté à ses dates dans le bilan de l'année.
    expect(summary.arrets[0]).toMatchObject({ from: "2026-09-08", days: 7 });
  });

  it("réunit sur une même paie les deux mois d’un arrêt qui finit avant le 10", () => {
    const summary = sickLeaveSummaryForYear([
      { id: "sick", from: "2026-01-31", to: "2026-02-02", leaveType: "sick", updatedAt: "" },
    ], 2026, 3_000, 0, 100);
    expect(summary.byMonth[0]).toMatchObject({ days: 0, total: 0 });
    expect(summary.byMonth[1].days).toBe(3);
    expect(summary.byMonth[1].total).toBeCloseTo(120);
    expect(summary.byMonth[1].sources).toHaveLength(2);
  });

  it("porte sur la paie de janvier la fin d’un arrêt de décembre, carence comprise", () => {
    const summary = sickLeaveSummaryForYear([
      { id: "sick", from: "2026-12-31", to: "2027-01-02", leaveType: "sick", updatedAt: "" },
    ], 2027, 3_000, 0, 100);
    // Le bilan de 2027 ne compte que les jours de 2027, sans nouvelle carence…
    expect(summary.days).toBe(2);
    expect(summary.arrets[0].carence).toBe(0);
    // … mais la paie de janvier 2027 retient aussi le 31 décembre et sa carence.
    expect(summary.byMonth[0].days).toBe(3);
    expect(summary.byMonth[0].total).toBeCloseTo(120);
  });

  it("déplace une tranche sur le mois que le bulletin a réellement retenu", () => {
    const periods = [
      { id: "sick", from: "2024-03-20", to: "2024-03-20", leaveType: "sick" as const, updatedAt: "" },
    ];
    const byRule = sickLeaveSummaryForYear(periods, 2024, 3_000, 0, 77.5);
    expect(byRule.byMonth[2].total).toBe(0);
    expect(byRule.byMonth[3].total).toBe(77.5);
    const corrected = sickLeaveSummaryForYear(periods, 2024, 3_000, 0, 77.5, { "sick:2024-03-20": "2024-03" });
    expect(corrected.byMonth[2].total).toBe(77.5);
    expect(corrected.byMonth[2].sources[0].slice.overridden).toBe(true);
    expect(corrected.byMonth[3].total).toBe(0);
  });
});
