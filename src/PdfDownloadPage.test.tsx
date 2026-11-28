import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PdfDownloadPage, pdfYears } from "./PdfDownloadPage";

describe("plannings PDF", () => {
  it("propose trois années en pastilles à partir de l'année en cours, les suivantes dans « Plus »", () => {
    const years = pdfYears(new Date("2026-10-26"));
    expect(years.pills).toEqual([2026, 2027, 2028]);
    expect(years.more[0].value).toBe(2029);
    expect(pdfYears(new Date("2027-03-01")).pills).toEqual([2027, 2028, 2029]);
  });

  it("montre les années en pastilles, l’interrupteur vacances et les deux groupes de documents", () => {
    const html = renderToStaticMarkup(
      <PdfDownloadPage
        narrowScreen
        year={2027}
        group={2}
        showSchoolVacations={false}
        exporting={null}
        onYearChange={vi.fn()}
        onShowSchoolVacationsChange={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(html).toContain('<div class="pdf-year-pills" role="group" aria-label="Année du PDF">');
    expect(html).toContain('<button type="button" class="active" aria-pressed="true">2027</button>');
    // « Plus » pour les années suivantes, en attente tant qu'aucune n'est choisie.
    expect(html).toContain('class="choice-picker pdf-year-more"');
    expect(html).toContain("Plus");
    // Vacances : interrupteur neutre quand désactivé.
    expect(html).toContain('role="switch" class="pdf-vac-switch" aria-checked="false" aria-label="Vacances scolaires sur le PDF"');
    // Deux groupes de documents distincts.
    expect(html).toContain("<h3>Mon planning</h3>");
    expect(html).toContain("<h3>Tous les groupes</h3>");
  });
});
