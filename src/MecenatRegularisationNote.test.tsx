import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MecenatRegularisationNote } from "./MecenatRegularisationNote";

describe("MecenatRegularisationNote", () => {
  const pending = { count: 2, minutes: 180, cents: 3630, firstDate: "2026-09-12" as string | null, lastDate: "2026-09-26" as string | null };
  const render = (extra: Partial<typeof pending>) => renderToStaticMarkup(<MecenatRegularisationNote pending={{ ...pending, ...extra }} />);

  it("dit la majoration de nuit en attente, ce qu'en a dit la DRH, et que la paie la verse depuis novembre", () => {
    const html = render({});
    expect(html).toContain('<section class="mecenat-regularisation" aria-labelledby="mecenat-regularisation-title">');
    expect(html).toContain('<span class="mecenat-regularisation-kicker">À régulariser · début 2027</span>');
    expect(html).toMatch(/<h4 id="mecenat-regularisation-title"><strong>36,30\s€<\/strong> de majoration de nuit<\/h4>/);
    expect(html).toContain("3 h de 22 h à minuit sur 2 mécénats, payées au tarif jour. La DRH reprendra les états début 2027, pour les heures faites depuis le 1er\u00a0janvier 2024.</p>");
    // Nouvelle de novembre 2026 : la paie de décembre verse la majoration des mécénats de novembre.
    expect(html).toContain("<p>Les mécénats faits depuis le 1er\u00a0novembre 2026 sont payés au barème, majoration comprise, à partir de la paie de décembre.</p>");
    expect(html).not.toContain("paie de décembre ne la régularisera pas");
  });

  it("dit que la date n'est pas connue pour les mécénats d'octobre 2026", () => {
    // Septembre et octobre : la reprise de début 2027, sauf pour octobre.
    expect(render({ lastDate: "2026-10-14" })).toContain("pour les heures faites depuis le 1er\u00a0janvier 2024 ; pour celles d’octobre 2026, la date n’est pas encore connue.</p>");
    // Octobre seul : pas de date annoncée du tout.
    const october = render({ count: 1, minutes: 60, cents: 1210, firstDate: "2026-10-14", lastDate: "2026-10-14" });
    expect(october).toContain('<span class="mecenat-regularisation-kicker">À régulariser</span>');
    expect(october).toContain("1 h de 22 h à minuit sur 1 mécénat, payée au tarif jour. Pour octobre 2026, la date de la régularisation n’est pas encore connue.</p>");
    expect(october).not.toContain("DRH");
  });

  it("ne montre rien sans majoration en attente", () => {
    expect(render({ count: 0, minutes: 0, cents: 0, firstDate: null, lastDate: null })).toBe("");
  });
});
