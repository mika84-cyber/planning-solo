import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MecenatRegularisationNote } from "./MecenatRegularisationNote";

describe("MecenatRegularisationNote", () => {
  const pending = { count: 2, minutes: 180, cents: 3630, firstDate: "2026-10-12" };

  it("dit la majoration de nuit en attente et ce qu'en a dit la DRH", () => {
    const html = renderToStaticMarkup(<MecenatRegularisationNote pending={pending} todayKey="2026-11-13" />);
    expect(html).toContain('<section class="mecenat-regularisation" aria-labelledby="mecenat-regularisation-title">');
    expect(html).toContain('<span class="mecenat-regularisation-kicker">À régulariser · début 2027</span>');
    expect(html).toMatch(/<h4 id="mecenat-regularisation-title"><strong>36,30\s€<\/strong> de majoration de nuit<\/h4>/);
    expect(html).toContain("3 h de 22 h à minuit sur 2 mécénats, payées au tarif jour.");
    expect(html).toContain("pour toutes les heures depuis le 1er janvier 2024 ; la paie de décembre ne la régularisera pas.");
  });

  it("ne parle plus de la paie de décembre en 2027, et ne montre rien sans majoration en attente", () => {
    const html = renderToStaticMarkup(<MecenatRegularisationNote pending={{ ...pending, count: 1, minutes: 60, cents: 1210 }} todayKey="2027-01-10" />);
    expect(html).toContain("1 h de 22 h à minuit sur 1 mécénat, payée au tarif jour.");
    expect(html).not.toContain("paie de décembre");
    expect(renderToStaticMarkup(<MecenatRegularisationNote pending={{ count: 0, minutes: 0, cents: 0, firstDate: null }} todayKey="2026-11-13" />)).toBe("");
  });
});
