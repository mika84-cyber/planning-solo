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
            taken: 2,
            upcoming: 2,
            remaining: 25,
            details: [],
          },
          {
            type: "rtt",
            allowance: 5,
            manualUsed: 0,
            used: 0,
            taken: 0,
            upcoming: 0,
            remaining: 5,
            details: [],
          },
          {
            type: "fraction",
            allowance: 1,
            manualUsed: 0,
            used: 0,
            taken: 0,
            upcoming: 0,
            remaining: 1,
            details: [],
          },
        ]}
        countedOnly={{
          sick: { used: 2, details: [] },
          strike: { used: 1, details: [] },
          childcare: { used: 0, details: [] },
          exceptional: { used: 0, details: [] },
          other: { used: 1, details: [] },
          cet: { used: 2, details: [] },
          work_accident: { used: 3, details: [] },
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
    expect(html).toContain("2 déjà pris · 2 posés à venir");
    expect(html).toContain("2 dimanches");
    expect(html).toContain("Ajouter des jours et dimanches déjà posés, sans préciser les dates");
    expect(html).toContain("Maladie");
    expect(html).toContain("Grève");
    expect(html).toContain("retenue estimée dans Ma paie");
    expect(html).toContain("Divers");
    expect(html).toContain("Congé CET");
    expect(html).toContain("Accident de travail");
    expect(html).toContain("sans carence · CA superposés recrédités");
    expect(html).toContain("compté dans les jours non travaillés");
    expect(html).toContain("déduit du solde CET");
    expect(html.indexOf('class="strike"')).toBeGreaterThan(html.indexOf('class="cet"'));
  });
});
