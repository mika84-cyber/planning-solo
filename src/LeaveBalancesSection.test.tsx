import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeaveBalancesSection } from "./LeaveBalancesSection";

const countedOnly = {
  sick: { used: 2, details: [] },
  strike: { used: 0, details: [] },
  childcare: { used: 0, details: [] },
  exceptional: { used: 0, details: [] },
  other: { used: 0, details: [] },
  cet: { used: 0, details: [] },
  work_accident: { used: 0, details: [] },
};

describe("LeaveBalancesSection", () => {
  it("laisse les quatre soldes utiles visibles et replie les autres congés", () => {
    const html = renderToStaticMarkup(
      <LeaveBalancesSection
        year={2026}
        totalRemaining={32}
        balances={[
          { type: "annual", allowance: 30, manualUsed: 0, used: 2, taken: 1, upcoming: 1, remaining: 28, details: [] },
          { type: "rtt", allowance: 3, manualUsed: 0, used: 0, taken: 0, upcoming: 0, remaining: 3, details: [] },
          { type: "fraction", allowance: 1, manualUsed: 0, used: 0, taken: 0, upcoming: 0, remaining: 1, details: [] },
        ]}
        countedOnly={countedOnly}
        manualSundayLeaveTotal={0}
        onYearChange={vi.fn()}
        onSelectBalance={vi.fn()}
        onOpenManualAdjustments={vi.fn()}
      />,
    );

    const primaryBalances = html.slice(0, html.indexOf('<details class="other-leave-balances">'));
    expect(primaryBalances).toContain("Congés annuels");
    expect(primaryBalances).toContain("RTT");
    expect(primaryBalances).toContain("Jour de fractionnement");
    expect(primaryBalances).toContain("Maladie");
    expect(primaryBalances).not.toContain("Garde d’enfant");
    expect(html).toContain('<details class="other-leave-balances">');
    expect(html).toContain("Autres congés");
    expect(html).toContain("CET, garde d’enfant et absences particulières");
    expect(html).toContain("6 catégories");
    expect(html).toContain("Reprendre mes absences précédentes");
    expect(html).toContain("Ajouter un historique sans renseigner chaque date");
    expect(html).toContain("Configurer");
  });
});
