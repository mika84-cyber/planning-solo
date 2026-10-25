import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { expoSheetFor, galleryExpoFor, HelpSheet } from "./HelpSheet";
import { GRAND_PALAIS_PROGRAM } from "./grandPalaisProgramData";

describe("fenêtre d'aide", () => {
  it("pose les questions en trois groupes, le code radio en fin de « Trouver »", () => {
    const html = renderToStaticMarkup(<HelpSheet today="2026-10-26" section="leave" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(html).toMatch(/^<dialog class="help-sheet" data-section="leave" aria-label="Que cherchez-vous \?">/);
    expect(html).toContain('<h2 id="help-sheet-title">Que cherchez-vous ?</h2>');
    expect(html.indexOf("<h3>Trouver</h3>")).toBeLessThan(html.indexOf("<h3>Ma paie</h3>"));
    expect(html.indexOf("<h3>Ma paie</h3>")).toBeLessThan(html.indexOf("<h3>Déclarer</h3>"));
    const find = html.slice(html.indexOf('aria-label="Trouver"'), html.indexOf("<h3>Ma paie</h3>"));
    const questions = [...find.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1]);
    expect(questions).toEqual([
      "Un numéro de téléphone",
      "Un formulaire",
      "Télécharger un planning",
      "Les dates d’une exposition",
      "Fiche d’expo · Cezanne et nous",
      "Audioguide · Cezanne et nous",
      "Les dates d’inter-expos",
      "Un code radio d’urgence",
    ]);
    for (const question of ["Le détail de mes primes", "Vérifier un bulletin", "Comprendre ma paie", "Un mécénat ou des heures sup", "Un accident de travail", "Une absence ou un échange", "Ouvrir ou alimenter mon CET"])
      expect(html).toContain(`<strong>${question}</strong>`);
  });

  it("donne à l'exposition des Galeries 3 et 4 deux lignes : sa fiche et son audioguide", () => {
    const html = renderToStaticMarkup(<HelpSheet today="2026-10-26" onChoose={vi.fn()} onClose={vi.fn()} />);
    // Pas de fiche PDF connue avant la lecture du dossier Expo : la ligne
    // ouvre le dossier.
    expect(html).toContain("<strong>Fiche d’expo · Cezanne et nous</strong><small>Docs · Formulaire Expo</small>");
    expect(html).toMatch(/<a class="help-sheet-row" href="https:\/\/audioguide\.grandpalais\.fr\/bypass" target="_blank" rel="noopener noreferrer">/);
    expect(html).toContain("<strong>Audioguide · Cezanne et nous</strong><small>Code d’accès 1622, copié en l’ouvrant</small>");
  });

  it("prend l'exposition en cours des Galeries 3 et 4, ou la suivante pendant une inter-expo", () => {
    expect(galleryExpoFor("2026-10-26")).toMatchObject({ current: true, entry: { title: "Cezanne et nous" } });
    const program = {
      ...GRAND_PALAIS_PROGRAM,
      galleries34: {
        ...GRAND_PALAIS_PROGRAM.galleries34,
        schedule: { 2027: [
          { title: "Avant", period: "", startsOn: "2027-01-01", endsOn: "2027-02-01" },
          { title: "Après", period: "", startsOn: "2027-03-01", endsOn: "2027-05-01" },
        ] },
      },
    };
    expect(galleryExpoFor("2027-02-15", program)).toMatchObject({ current: false, entry: { title: "Après" } });
    expect(galleryExpoFor("2027-06-01", program)).toBeNull();
  });

  it("retrouve la fiche PDF de l'exposition dans le dossier Expo", () => {
    const documents = [
      { title: "Hilma Af Klint", file: "hilma.pdf", format: "PDF" as const },
      { title: "Fiche Cézanne", file: "fiche-cezanne", format: "PDF" as const, href: "/api/useful-document-file?id=fiche-cezanne" },
    ];
    expect(expoSheetFor("Cezanne et nous", documents)?.file).toBe("fiche-cezanne");
    expect(expoSheetFor("Transparence", documents)).toBeUndefined();
    expect(expoSheetFor("Hilma af Klint - Les peintures du Temple", [{ title: "Consignes", file: "c.pdf", format: "PDF", programEntryTitle: "Hilma af Klint - Les peintures du Temple" }])?.file).toBe("c.pdf");
  });
});
