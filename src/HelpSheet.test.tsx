import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AudioguideRow, expoSheetFor, galleryExpoFor, HelpSheet, matchesHelpQuery } from "./HelpSheet";
import { GRAND_PALAIS_PROGRAM } from "./grandPalaisProgramData";

describe("fenêtre d'aide", () => {
  it("range les questions en cinq thèmes sur deux colonnes, sous un champ de recherche", () => {
    const html = renderToStaticMarkup(<HelpSheet today="2026-10-26" section="leave" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(html).toMatch(/^<dialog class="help-sheet" data-section="leave" aria-label="Que cherchez-vous \?">/);
    expect(html).toContain('<h2 id="help-sheet-title">Que cherchez-vous ?</h2>');
    expect(html).toContain('<input type="search" class="help-sheet-search" placeholder="Un mot : congé, bulletin, radio…" aria-label="Chercher une question" value=""/>');
    // Une couleur par thème.
    expect(html).toContain('<h3 class="help-sheet-group-title group-docs">Documents</h3><ul class="help-sheet-group group-docs" aria-label="Documents">');
    expect(html).toContain('<ul class="help-sheet-group group-expo" aria-label="Expositions">');
    expect(html).toContain('<ul class="help-sheet-group group-planning" aria-label="Mon planning">');
    expect(html).toContain('<ul class="help-sheet-group group-pay" aria-label="Ma paie">');
    expect(html).toContain('<ul class="help-sheet-group group-declare" aria-label="Déclarer">');
    // Documents et Expositions en première colonne, le reste en seconde.
    const columns = html.split('<div class="help-sheet-column">').slice(1);
    const headings = (part: string) => [...part.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1]);
    expect(columns.map(headings)).toEqual([["Documents", "Expositions"], ["Mon planning", "Ma paie", "Déclarer"]]);
    const group = (label: string) => {
      const start = html.indexOf(`aria-label="${label}"`);
      return [...html.slice(start, html.indexOf("</ul>", start)).matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1]);
    };
    expect(group("Documents")).toEqual(["Un numéro de téléphone", "Un formulaire administratif", "Un formulaire de congé", "Les 3 groupes de collègues", "Un code radio d’urgence"]);
    expect(group("Expositions")).toEqual(["Fiche d’expo · Cezanne et nous", "Les dates d’une exposition", "Audioguide · Cezanne et nous", "Les dates d’inter-expos"]);
    expect(group("Mon planning")).toEqual(["Télécharger un planning", "Partager mon planning avec un(e) collègue"]);
    expect(group("Ma paie")).toEqual(["Vérifier un bulletin", "Le détail de mes primes", "Comprendre ma paie"]);
    expect(group("Déclarer")).toEqual(["Poser un congé", "Échanger un jour avec un collègue", "Un mécénat ou des heures supp", "Ouvrir ou alimenter mon CET", "Un accident de travail"]);
    expect(html).not.toContain("help-sheet-empty");
  });

  it("trouve une question sans tenir compte des accents ni des majuscules", () => {
    expect(matchesHelpQuery("Poser un congé Accueil · Choix des dates", "CONGE")).toBe(true);
    expect(matchesHelpQuery("Un code radio d’urgence", "radio d'urg")).toBe(true);
    expect(matchesHelpQuery("Un code radio d’urgence", "radio congé")).toBe(false);
    expect(matchesHelpQuery("Un formulaire", "  ")).toBe(true);
  });

  it("donne à l'exposition des Galeries 3 et 4 deux lignes : sa fiche et son audioguide", () => {
    const html = renderToStaticMarkup(<HelpSheet today="2026-10-26" onChoose={vi.fn()} onClose={vi.fn()} />);
    // Pas de fiche PDF connue avant la lecture du dossier Expo : la ligne
    // ouvre le dossier.
    expect(html).toContain("<strong>Fiche d’expo · Cezanne et nous</strong><small>Docs · Formulaire Expo</small>");
    // L'audioguide se déplie sur place, sans renvoyer vers le site.
    expect(html).not.toContain("audioguide.grandpalais.fr");
    expect(html).toContain('aria-expanded="false" aria-controls="help-sheet-audioguide-qr"');
    expect(html).toContain("<strong>Audioguide · Cezanne et nous</strong><small>QR code et code d’accès</small>");
  });

  it("déplie le QR code de l'audioguide à scanner, avec son code d'accès", () => {
    const html = renderToStaticMarkup(
      <AudioguideRow title="Cezanne et nous" audioguide={{ code: "1622", languages: "Français et anglais", qr: "/useful-forms/audioguide-cezanne-qr.png" }} initiallyOpen />,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('<img src="/useful-forms/audioguide-cezanne-qr.png" alt="QR code de l’audioguide Cezanne et nous" width="168" height="168"/>');
    expect(html).toContain("Code d’accès <b>1622</b>");
    expect(html).toContain("<small>Français et anglais</small>");
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
