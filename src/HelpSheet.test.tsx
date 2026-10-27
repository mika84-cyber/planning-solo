import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AudioguideRow, expoSheetFor, galleryExpoFor, HelpSheet } from "./HelpSheet";
import { GRAND_PALAIS_PROGRAM } from "./grandPalaisProgramData";

describe("fenêtre d'aide", () => {
  it("pose les questions en trois groupes, le code radio en fin de « Trouver »", () => {
    const html = renderToStaticMarkup(<HelpSheet today="2026-10-26" section="leave" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(html).toMatch(/^<dialog class="help-sheet" data-section="leave" aria-label="Que cherchez-vous \?">/);
    expect(html).toContain('<h2 id="help-sheet-title">Que cherchez-vous ?</h2>');
    // Une couleur par groupe : Trouver, Ma paie, Déclarer.
    expect(html).toContain('<h3 class="help-sheet-group-title group-find">Trouver</h3><ul class="help-sheet-group group-find" aria-label="Trouver">');
    expect(html).toContain('<ul class="help-sheet-group group-pay" aria-label="Ma paie">');
    expect(html).toContain('<ul class="help-sheet-group group-declare" aria-label="Déclarer">');
    expect(html).not.toContain("tone-");
    expect(html.indexOf("Trouver</h3>")).toBeLessThan(html.indexOf("Ma paie</h3>"));
    expect(html.indexOf("Ma paie</h3>")).toBeLessThan(html.indexOf("Déclarer</h3>"));
    const find = html.slice(html.indexOf('aria-label="Trouver"'), html.indexOf("Ma paie</h3>"));
    const questions = [...find.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1]);
    expect(questions).toEqual([
      "Un numéro de téléphone",
      "Un formulaire",
      "Remplir une demande à la main",
      "Fiche d’expo · Cezanne et nous",
      "Les dates d’une exposition",
      "Audioguide · Cezanne et nous",
      "Télécharger un planning",
      "Les dates d’inter-expos",
      "Partager mon planning avec un(e) collègue",
      "Un code radio d’urgence",
    ]);
    // Ma paie et Déclarer, dans l'ordre demandé.
    const group = (label: string, next: string) => html.slice(html.indexOf(`aria-label="${label}"`), next ? html.indexOf(next) : undefined);
    const titles = (part: string) => [...part.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1]);
    expect(titles(group("Ma paie", "Déclarer</h3>"))).toEqual(["Vérifier un bulletin", "Le détail de mes primes", "Comprendre ma paie"]);
    expect(titles(group("Déclarer", ""))).toEqual(["Poser un congé", "Échanger un jour avec un collègue", "Un mécénat ou des heures supp", "Ouvrir ou alimenter mon CET", "Un accident de travail"]);
    expect(html).not.toContain("help-sheet-lead");
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
