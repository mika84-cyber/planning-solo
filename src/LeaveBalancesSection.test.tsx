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
  it("montre toutes les briques de congés à la suite, sans volet à déplier", () => {
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

    // Une seule grille, dans l'ordre : les quatre soldes utiles puis les autres.
    expect(html).not.toContain("other-leave-balances");
    expect(html).not.toContain("Autres congés");
    expect(html).not.toContain("Refermer le volet");
    expect(html.match(/class="leave-balance-grid"/g)).toHaveLength(1);
    const labels = [...html.matchAll(/aria-label="Afficher le détail de ([^"]+)"/g)].map((match) => match[1]);
    expect(labels).toHaveLength(10);
    expect(labels.slice(0, 4)).toEqual(["Congés annuels", "RTT", "Jour de fractionnement", "Maladie"]);
    expect(labels).toEqual(expect.arrayContaining(["Grève", "Accident de travail"]));
    expect(html).toContain("Reprendre mes absences précédentes");
    expect(html).toContain("Ajouter un historique sans renseigner chaque date");
    expect(html).toContain("Configurer");
  });
});
