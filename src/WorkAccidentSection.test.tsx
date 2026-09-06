import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkAccidentSection } from "./WorkAccidentSection";

describe("parcours accident de travail", () => {
  it("présente le parcours fonctionnaire, les contacts et les documents transmis", () => {
    const html = renderToStaticMarkup(
      <WorkAccidentSection
        initialStatus="fonctionnaire"
        periods={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(html).toContain("Aucun jour de carence");
    expect(html).toContain("15 jours");
    expect(html).toContain("servicemedical@centrepompidou.fr");
    expect(html).toContain("Prévenir les secouristes sur site ou à défaut les urgences");
    expect(html).not.toContain("PC Sécurité · bâtiment central");
    expect(html).not.toContain("réserves Paris-Nord");
    expect(html).toContain("congé pour invalidité temporaire imputable au service");
    expect(html.indexOf(">Contractuel<")).toBeLessThan(html.indexOf(">Fonctionnaire<"));
    expect(html).toContain("declaration-accident-fonctionnaire.pdf");
    expect(html).toContain("procedure-accident-fonctionnaire.pdf");
    expect(html.indexOf("Documents à utiliser")).toBeLessThan(html.indexOf("À faire immédiatement"));
    expect(html.indexOf("Documents à utiliser")).toBeLessThan(html.indexOf("Parcours fonctionnaire"));
    expect(html).not.toContain("Indiquez uniquement les journées concernées");
    expect(html).toContain("section-back-hit-area");
    expect(html).not.toContain("work-accident-header-symbol");
    expect(html).toContain("work-accident-contact-action phone");
    expect(html).toContain("work-accident-contact-action email");
    expect(html).toContain("Revenir aux formulaires utiles");
    expect(html).not.toContain("page accueil");
  });

  it("affiche les périodes déjà marquées et le parcours contractuel", () => {
    const html = renderToStaticMarkup(
      <WorkAccidentSection
        initialStatus="contractuel"
        periods={[{
          id: "at-1",
          from: "2026-09-09",
          to: "2026-09-11",
          leaveType: "work_accident",
          updatedAt: "v1",
        }]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(html).toContain("24 heures");
    expect(html).toContain("feuille de prise en charge disponible dans l’application");
    expect(html).not.toContain("récupérez au PC Sécurité");
    expect(html).toContain("CPAM");
    expect(html.match(/placeholder="jj\/mm\/aaaa"/g)).toHaveLength(2);
    expect(html).toContain("declaration-accident-contractuel.pdf");
    expect(html.indexOf("Documents à utiliser")).toBeLessThan(html.indexOf("À faire immédiatement"));
    expect(html.indexOf("Documents à utiliser")).toBeLessThan(html.indexOf("Parcours contractuel"));
    expect(html).toContain("mercredi 9 septembre 2026 au vendredi 11 septembre 2026");
  });
});
