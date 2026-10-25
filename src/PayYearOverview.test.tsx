import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayYearOverview } from "./PayYearOverview";
import { yearPayOverview } from "./yearPayOverview";

describe("PayYearOverview", () => {
  it("montre les totaux, les douze mois en barres et en tableau, le mois vérifié coché", () => {
    const ratios = { netRatioFixed: 80, netRatioVariable: 90, navigo: 0, mealVoucherDeduction: 0, pasRate: 2, pasBaseAdjustment: 1 };
    const estimate = { gross: 2500, grossFixed: 2000, grossVariable: 500, premiums: 300, mecenat: 50 };
    const overview = yearPayOverview(2026, [
      { index: 8, estimate, ratios, real: { gross: 2600, netBeforeTax: 2100 } },
      { index: 9, estimate, ratios },
      { index: 10, estimate, ratios },
    ], new Date(2026, 9, 24));
    const html = renderToStaticMarkup(<PayYearOverview overview={overview} onYearChange={vi.fn()} onOpenMonth={vi.fn()} />);
    expect(html).toContain("L’année 2026");
    expect(html).toContain("1 mois vérifié avec le bulletin");
    // Les totaux, dans la langue des lignes de la paie : titre, montant, barre.
    expect(html).toMatch(/<li><span class="pay-year-label">Brut<small>traitement, indemnités et primes<\/small><\/span><b>7.600,00.€<\/b><span class="pay-total-bar"/);
    expect(html).toMatch(/<li class="plus"><span class="pay-year-label">Mécénats/);
    expect(html).toMatch(/<li class="net"><span class="pay-year-label">Net perçu<small>sur 3 mois connus<\/small>/);
    // Douze barres ; douze lignes, septembre coché, novembre à venir.
    expect((html.match(/class="pay-year-bar/g) || []).length).toBe(12);
    expect((html.match(/<tr class="/g) || []).length + (html.match(/<tr><th scope="row"><button/g) || []).length).toBe(12);
    expect(html).toMatch(/<tr class="verified"><th scope="row"><button[^>]*>Septembre<em aria-hidden="true">✓<\/em><\/button><\/th><td>2.600,00.€<\/td>/);
    expect(html).toMatch(/<tr class="future"><th scope="row"><button[^>]*>Novembre<\/button>/);
    expect(html).toMatch(/<tr><th scope="row"><button[^>]*>Janvier<\/button><\/th><td>—<\/td>/);
    expect(html).toContain('aria-label="Octobre 2026 : voir le détail du calcul"');
  });
});
