import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExpoHomeNotices } from "./ExpoHomeNotices";

describe("ExpoHomeNotices", () => {
  it("annonce une ouverture dans une fenêtre, avec un seul bouton « Compris »", () => {
    const html = renderToStaticMarkup(<ExpoHomeNotices todayKey="2026-12-01" storageKey="test" />);
    expect(html).toBe(
      '<div class="modal-backdrop" role="presentation">'
      + '<section class="modal-card expo-notices" role="dialog" aria-modal="true" aria-labelledby="expo-notices-title">'
      + '<span class="step-label" id="expo-notices-title">Expositions</span>'
      + '<ul><li class="opening"><strong>Ouverture demain</strong><span>Galerie 7 · Le Musée Imaginaire d’Oli</span><small>Jusqu’au 21 février 2027</small></li></ul>'
      // Échap presse « Compris » : la fenêtre n'a pas d'autre sortie.
      + '<div class="modal-actions"><button type="button" class="primary-action" data-modal-close="true">Compris</button></div>'
      + '</section></div>',
    );
  });

  it("réunit deux fermetures dans un seul message", () => {
    const html = renderToStaticMarkup(<ExpoHomeNotices todayKey="2027-03-14" storageKey="test" />);
    expect((html.match(/<li class="closing">/g) || []).length).toBe(2);
    expect((html.match(/<button/g) || []).length).toBe(1);
    // Le dernier jour, plus de précision sous le titre.
    expect(renderToStaticMarkup(<ExpoHomeNotices todayKey="2027-01-17" storageKey="test" />))
      .toContain('<li class="closing"><strong>Dernier jour aujourd’hui</strong><span>Galeries 3 et 4 · Cezanne et nous</span></li>');
  });

  it("dit combien de jours ouvre un salon de la Nef, la veille", () => {
    expect(renderToStaticMarkup(<ExpoHomeNotices todayKey="2026-11-24" storageKey="test" />))
      .toContain('<li class="opening"><strong>Ouverture demain</strong><span>Nef · Arabian Horse Championship</span><small>Ouvert 3 jours, jusqu’au vendredi 27 novembre</small></li>');
  });

  it("lit le programme validé dans la veille du site : la Galerie 6.1, une date corrigée", () => {
    const approved = [
      { id: "a", title: "Gilles Caron. J’ai voulu voir", startDate: "2027-05-11", endDate: "2027-07-24", url: "https://www.grandpalais.fr/fr/programme/gilles-caron", venueKey: "other:galerie-6-1", venueLabel: "Galerie 6.1" },
      // La Galerie 7 n'ouvre finalement que le 4 décembre.
      { id: "b", title: "Le Musée Imaginaire d’Oli", startDate: "2026-12-04", endDate: "2027-02-21", url: "https://www.grandpalais.fr/fr/programme/oli", venueKey: "gallery7", venueLabel: "Galerie 7" },
    ];
    const html = (todayKey: string) => renderToStaticMarkup(<ExpoHomeNotices todayKey={todayKey} storageKey="test" approved={approved} />);
    expect(html("2027-05-10")).toContain("<strong>Ouverture demain</strong><span>Galerie 6.1 · Gilles Caron. J’ai voulu voir</span><small>Jusqu’au 24 juillet 2027</small>");
    expect(html("2026-12-01")).toBe("");
    expect(html("2026-12-03")).toContain("<strong>Ouverture demain</strong><span>Galerie 7 · Le Musée Imaginaire d’Oli</span>");
  });

  it("se tait quand le compte a déjà lu l’annonce sur un autre appareil", () => {
    expect(renderToStaticMarkup(
      <ExpoHomeNotices todayKey="2026-12-01" storageKey="test" accountSeen={["opening:gallery7:2026-12-02:musee imaginaire oli"]} />,
    )).toBe("");
    expect(renderToStaticMarkup(<ExpoHomeNotices todayKey="2026-12-01" storageKey="test" accountSeen={[]} />)).toContain("Galerie 7");
  });

  it("n’affiche rien un jour sans ouverture ni fermeture", () => {
    expect(renderToStaticMarkup(<ExpoHomeNotices todayKey="2026-11-21" storageKey="test" />)).toBe("");
  });
});
