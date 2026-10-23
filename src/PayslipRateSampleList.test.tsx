import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayslipRateSampleList } from "./PayslipRateSampleList";

describe("PayslipRateSampleList", () => {
  it("liste les bulletins qui calent les taux, et dit celui qui est écarté", () => {
    const html = renderToStaticMarkup(
      <PayslipRateSampleList
        samples={[
          { period: "2026-09", year: 2026, month: 8, gross: 2856.4, netBeforeTax: 2200, rejected: false },
          { period: "2026-08", year: 2026, month: 7, gross: 2950, netBeforeTax: 1500, rejected: true },
        ]}
        onRemove={vi.fn()}
      />,
    );
    expect(html).toContain("Bulletins qui calent vos taux");
    expect(html).toContain("1 bulletin écarté : il ne concorde pas avec les autres.");
    expect(html).toMatch(/<li><span><b>Septembre 2026<\/b><small>brut 2.856,40.€ · net avant impôt 2.200,00.€<\/small>/);
    expect(html).toMatch(/<li class="rejected"><span><b>Août 2026<\/b><small>[^<]* · écarté<\/small>/);
    expect(html).toContain('aria-label="Retirer le bulletin de août 2026"');
  });

  it("ne montre rien sans bulletin vérifié", () => {
    expect(renderToStaticMarkup(<PayslipRateSampleList samples={[]} onRemove={vi.fn()} />)).toBe("");
  });
});
