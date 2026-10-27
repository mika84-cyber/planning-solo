import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeaveTypeTabs } from "./LeaveTypeTabs";

describe("pastilles des types de congé", () => {
  it("dit le type choisi, compte les dates de chacun et prend des libellés courts", () => {
    const html = renderToStaticMarkup(
      <LeaveTypeTabs
        types={["annual", "rtt", "fraction"]}
        activeType="rtt"
        selectedCounts={{ annual: 1, half: 1, rtt: 2 }}
        labels={{ annual: "CA", fraction: "Fractionnement" }}
        ariaLabel="Congé des dates touchées"
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain('role="group" aria-label="Congé des dates touchées"');
    // Les demi-journées comptent avec les congés annuels.
    expect(html).toMatch(/aria-pressed="false"[^>]*><i><\/i>CA<b>2<\/b><\/button>/);
    expect(html).toMatch(/class="active" aria-pressed="true"[^>]*><i><\/i>RTT<b>2<\/b><\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*><i><\/i>Fractionnement<\/button>/);
    expect(html).not.toContain("Jour de fractionnement");
  });

  it("garde les libellés complets par défaut", () => {
    const html = renderToStaticMarkup(
      <LeaveTypeTabs types={["annual", "fraction"]} activeType="annual" selectedCounts={{}} ariaLabel="Choix courants" onSelect={vi.fn()} />,
    );
    expect(html).toContain("Congés annuels");
    expect(html).toContain("Jour de fractionnement");
  });
});
