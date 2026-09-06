import { describe, expect, it } from "vitest";
import { sickLeaveSummaryForYear } from "./sickLeaveSummary";

describe("sickLeaveSummaryForYear", () => {
  it("répartit un arrêt sur ses mois calendaires", () => {
    const summary = sickLeaveSummaryForYear([
      { id: "sick", from: "2026-01-31", to: "2026-02-02", leaveType: "sick", updatedAt: "" },
    ], 2026, 3_000, 0, 100);
    expect(summary.byMonth[0]).toMatchObject({ days: 1, total: 100 });
    expect(summary.byMonth[1].days).toBe(2);
    expect(summary.byMonth[1].total).toBeCloseTo(20);
  });

  it("préserve la continuité d’un arrêt entre décembre et janvier sans recréer de carence", () => {
    const summary = sickLeaveSummaryForYear([
      { id: "sick", from: "2026-12-31", to: "2027-01-02", leaveType: "sick", updatedAt: "" },
    ], 2027, 3_000, 0, 100);
    expect(summary.days).toBe(2);
    expect(summary.byMonth[0].days).toBe(2);
    expect(summary.byMonth[0].total).toBeCloseTo(20);
    expect(summary.arrets[0].carence).toBe(0);
  });
});
