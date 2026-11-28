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

const renderSection = () =>
  renderToStaticMarkup(
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

describe("LeaveBalancesSection", () => {
  it("montre toutes les briques de congés à la suite, sans volet à déplier", () => {
    const html = renderSection();

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

  it("garde à chaque carte la couleur de son type et accole sa mention au chiffre", () => {
    const html = renderSection();

    // La classe de la carte est celle du type : c'est elle qui porte sa couleur
    // (--balance-color), sur le filet, le chiffre et sa mention. « restants » ou
    // « pris » suit le chiffre dans le même <strong>, puis la ligne d'explication.
    expect(html).toMatch(/<button type="button" class="annual leave-balance-stock"[^>]*><span class="leave-balance-stock-label"><span class="leave-balance-name-full">Congés annuels<\/span><span class="leave-balance-name-short" aria-hidden="true">CA<\/span><\/span><strong>28<i>j<\/i><\/strong><small class="leave-balance-detail"><span>1 déjà pris<\/span><i> · <\/i><span>1 à venir<\/span><\/small>/);
    expect(html).toMatch(/<button type="button" class="fraction leave-balance-stock"[^>]*><span class="leave-balance-stock-label"><span class="leave-balance-name-full">[^<]*fractionnement<\/span><span class="leave-balance-name-short" aria-hidden="true">Fract\.<\/span><\/span><strong>1<i>j<\/i><\/strong>/);
    expect(html).toMatch(/<button type="button" class="sick leave-balance-tracked"[^>]*><span class="leave-balance-copy"><span>Maladie<\/span><small>sans effet sur les congés<\/small><\/span><strong>2<i>pris<\/i><\/strong>/);
    expect(html).toMatch(/<button type="button" class="cet leave-balance-tracked is-zero"[^>]*><span class="leave-balance-copy"><span>[^<]+<\/span><small>déduit du solde CET<\/small><\/span><strong>0<i>pris<\/i><\/strong>/);
    expect(html).toMatch(/<button type="button" class="strike leave-balance-tracked is-zero"[^>]*>[\s\S]*?<small>retenue estimée dans Ma paie<\/small>/);
  });

  it("affiche les trois soldes à poser en trio épuré sans barre de progression", () => {
    const html = renderSection();
    expect(html).toContain('class="annual leave-balance-stock"');
    expect(html).toContain('class="rtt leave-balance-stock"');
    expect(html).toContain('class="fraction leave-balance-stock"');
    expect(html).not.toContain("--used:");
  });
});
