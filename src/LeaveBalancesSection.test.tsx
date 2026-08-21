import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeaveBalancesSection } from "./LeaveBalancesSection";

describe("soldes de congés", () => {
  it("affiche les quotas et les catégories suivies sans quota", () => {
    const html = renderToStaticMarkup(
      <LeaveBalancesSection
        year={2026}
        totalRemaining={31}
        balances={[
          {
            type: "annual",
            allowance: 29,
            manualUsed: 1,
            used: 4,
            remaining: 25,
            details: [],
          },
          {
            type: "rtt",
            allowance: 5,
            manualUsed: 0,
            used: 0,
            remaining: 5,
            details: [],
          },
          {
            type: "fraction",
            allowance: 1,
            manualUsed: 0,
            used: 0,
            remaining: 1,
            details: [],
          },
        ]}
        countedOnly={{
          sick: { used: 2, details: [] },
          childcare: { used: 0, details: [] },
          exceptional: { used: 0, details: [] },
        }}
        manualSundayLeaveTotal={2}
        onYearChange={vi.fn()}
        onSelectBalance={vi.fn()}
        onOpenManualAdjustments={vi.fn()}
      />,
    );

    expect(html).toContain("Mes soldes de congés");
    expect(html).toContain("31 jours restants");
    expect(html).toContain("dont 1 saisi sans date");
    expect(html).toContain("2 dimanches");
    expect(html).toContain("Maladie");
  });
});
