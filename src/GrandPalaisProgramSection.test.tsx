import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GRAND_PALAIS_PROGRAM,
  GrandPalaisProgramSection,
  calculateInterExhibitionPeriods,
  describeInterExhibitionPeriod,
  grandPalaisEntryStatus,
  grandPalaisVenuePalette,
  isGrandPalaisEntryCurrent,
  isGrandPalaisEntryVisible,
  mergeSharedGrandPalaisProgram,
  safeGrandPalaisUrl,
} from "./GrandPalaisProgramSection";

describe("programmation du Grand Palais", () => {
  it("ouvre sur les expositions en cours et propose les quatre vues", () => {
    const html = renderToStaticMarkup(<GrandPalaisProgramSection />);
    expect(html).toContain("En ce moment");
    expect(html).toContain("À venir");
    expect(html).toContain("Par espace");
    expect(html).toContain("Inter-expos");
    expect(html).toContain('aria-selected="true" class="active">En ce moment');
    expect(html).toContain("Rechercher une exposition");
    expect(html).toMatch(/data-venue="(?:galleries34|gallery8|gallery7|nef|gallery910|childrenPalace)"/);
  });

  it("range la Nef et les galeries 9 et 10 dans les autres espaces", () => {
    expect(GRAND_PALAIS_PROGRAM.nef.label).toBe("Nef");
    expect(JSON.stringify(GRAND_PALAIS_PROGRAM.nef.schedule)).not.toContain("Grand Palais d’été");
    expect(GRAND_PALAIS_PROGRAM.gallery910.label).toBe("Galeries 9 et 10");
    expect(GRAND_PALAIS_PROGRAM.childrenPalace.label).toBe("Palais des enfants");
    expect(GRAND_PALAIS_PROGRAM.gallery910.schedule[2026]?.map((entry) => entry.title)).toEqual([
      "Leandro Erlich",
      "Mika Ninagawa with EiM - Alive with Shadows",
    ]);
    expect(GRAND_PALAIS_PROGRAM.childrenPalace.schedule[2026]?.[0].title).toBe("Transparence");
  });

  it("attribue une couleur stable à chaque espace, y compris ceux ajoutés dans Autres", () => {
    const currentVenueKeys = [
      ...Object.keys(GRAND_PALAIS_PROGRAM),
      "other:grand-palais",
      "other:rotonde-salon-seine-palais-enfants",
      "other:galeries-2-2",
    ];
    const currentBackgrounds = currentVenueKeys.map((venueKey) => grandPalaisVenuePalette(venueKey).background);
    expect(new Set(currentBackgrounds).size).toBe(currentVenueKeys.length);
    expect(grandPalaisVenuePalette("galleries34")).toEqual(grandPalaisVenuePalette("galleries34"));
    expect(grandPalaisVenuePalette("other:nouvelle-galerie")).toEqual(grandPalaisVenuePalette("other:nouvelle-galerie"));
  });

  it("conserve Art Basel 2029 sans ajouter de dates de montage", () => {
    const nefProgram = JSON.stringify(GRAND_PALAIS_PROGRAM.nef.schedule);
    expect(nefProgram).not.toMatch(/montage/i);
    expect(GRAND_PALAIS_PROGRAM.nef.schedule[2029]?.[0]).toMatchObject({
      title: "Art Basel Paris",
      period: "Du 17 au 21 octobre 2029",
      startsOn: "2029-10-17",
      endsOn: "2029-10-21",
    });
    expect(GRAND_PALAIS_PROGRAM.nef.schedule[2028]?.[0]).toMatchObject({
      title: "Art Basel Paris",
      period: "Du 18 au 22 octobre 2028",
    });
  });

  it("identifie automatiquement les expositions en cours", () => {
    expect(isGrandPalaisEntryCurrent(GRAND_PALAIS_PROGRAM.gallery8.schedule[2026]![0], "2026-08-28")).toBe(true);
    expect(isGrandPalaisEntryCurrent(GRAND_PALAIS_PROGRAM.gallery8.schedule[2026]![1], "2026-08-28")).toBe(false);
    expect(isGrandPalaisEntryCurrent(GRAND_PALAIS_PROGRAM.gallery910.schedule[2026]![0], "2026-08-28")).toBe(true);
    expect(isGrandPalaisEntryCurrent(GRAND_PALAIS_PROGRAM.childrenPalace.schedule[2026]![0], "2026-08-28")).toBe(true);
    expect(isGrandPalaisEntryCurrent(GRAND_PALAIS_PROGRAM.nef.schedule[2026]![0], "2026-08-28")).toBe(false);
  });

  it("précise le statut et les délais à partir des dates enregistrées", () => {
    expect(grandPalaisEntryStatus({
      title: "En cours", period: "", startsOn: "2026-09-01", endsOn: "2026-09-12",
    }, "2026-09-02")).toEqual({ label: "En cours", detail: "10 jours restants" });
    expect(grandPalaisEntryStatus({
      title: "À venir", period: "", startsOn: "2026-09-05", endsOn: "2026-09-12",
    }, "2026-09-02")).toEqual({ label: "Prochainement", detail: "Commence dans 3 jours" });
    expect(grandPalaisEntryStatus({
      title: "Prévisionnelle", period: "", uncertain: true, startsOn: "2026-09-05", endsOn: "2026-09-12",
    }, "2026-09-02")).toEqual({ label: "À confirmer", detail: "" });
  });

  it("retire automatiquement une exposition dont la date de fin est dépassée", () => {
    const hilma = GRAND_PALAIS_PROGRAM.gallery8.schedule[2026]![0];
    expect(isGrandPalaisEntryVisible(hilma, "2026-08-30")).toBe(true);
    expect(isGrandPalaisEntryVisible(hilma, "2026-08-31")).toBe(false);
  });

  it("calcule les périodes où aucune des trois galeries n’est ouverte", () => {
    const periods = calculateInterExhibitionPeriods("2026-08-28");
    expect(periods).toContainEqual(expect.objectContaining({
      startsOn: "2026-08-31",
      endsOn: "2026-09-22",
    }));
    expect(periods).toContainEqual(expect.objectContaining({
      startsOn: "2027-08-02",
      endsOn: "2027-10-04",
    }));
    expect(periods).not.toContainEqual(expect.objectContaining({
      startsOn: "2027-03-22",
      endsOn: "2027-03-22",
    }));
    expect(periods.every((period) => {
      const duration = (new Date(period.endsOn).getTime() - new Date(period.startsOn).getTime()) / 86_400_000 + 1;
      return duration >= 3;
    })).toBe(true);
  });

  it("détaille la durée et l’échéance d’une période d’inter-expositions", () => {
    expect(describeInterExhibitionPeriod({ startsOn: "2026-08-31", endsOn: "2026-09-22" }, "2026-09-07")).toEqual({
      durationDays: 23,
      status: "En cours",
      timing: "Se termine dans 15 jours",
    });
    expect(describeInterExhibitionPeriod({ startsOn: "2026-09-08", endsOn: "2026-09-12" }, "2026-09-07")).toEqual({
      durationDays: 5,
      status: "À venir",
      timing: "Commence demain",
    });
  });

  it("applique une mise à jour acceptée à tous les utilisateurs", () => {
    const updated = mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, [{
      id: "cezanne",
      title: "Cezanne et nous",
      startDate: "2026-09-24",
      endDate: "2027-01-24",
      url: "https://www.grandpalais.fr/fr/programme/cezanne-et-nous",
      venueKey: "galleries34",
      venueLabel: "Galeries 3 et 4",
    }]);
    expect(updated.galleries34.schedule[2026]).toContainEqual(expect.objectContaining({
      startsOn: "2026-09-24",
      endsOn: "2027-01-24",
    }));
    expect(updated.galleries34.schedule[2027]).toContainEqual(expect.objectContaining({
      startsOn: "2026-09-24",
      endsOn: "2027-01-24",
    }));
    expect(calculateInterExhibitionPeriods("2026-08-28", updated)).toContainEqual({
      startsOn: "2026-08-31",
      endsOn: "2026-09-23",
    });
  });

  it("ajoute un nouvel espace accepté dans Autres et respecte un retrait validé", () => {
    const salon = {
      id: "salon",
      title: "Exposition du Salon",
      startDate: "2027-02-01",
      endDate: "2027-05-01",
      url: "https://www.grandpalais.fr/fr/programme/exposition-salon",
      venueKey: "other:salon-honneur",
      venueLabel: "Salon d’honneur",
    };
    const added = mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, [salon]);
    expect(added["other:salon-honneur"].schedule[2027]?.[0].title).toBe("Exposition du Salon");
    const removed = mergeSharedGrandPalaisProgram(added, [{ ...salon, deleted: true }]);
    expect(removed["other:salon-honneur"].schedule[2027]).toEqual([]);
  });

  it("ajoute une galerie nouvellement détectée dans Autres après validation", () => {
    const added = mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, [{
      id: "gallery-2",
      title: "Exposition Galerie 2",
      startDate: "2026-11-21",
      endDate: "2026-11-21",
      url: "https://www.grandpalais.fr/fr/programme/exposition-galerie-2",
      venueKey: "other:galeries-2-2",
      venueLabel: "Galeries 2.2",
    }]);
    expect(added["other:galeries-2-2"]).toMatchObject({ label: "Galeries 2.2" });
    expect(added["other:galeries-2-2"].schedule[2026]?.[0]).toMatchObject({
      title: "Exposition Galerie 2",
      period: "Date officielle : 21 novembre 2026",
    });
  });

  it("garde les fermetures exceptionnelles hors des rubriques d’exposition", () => {
    const merged = mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, [{
      id: "closure",
      title: "Fermeture exceptionnelle du Grand Palais",
      startDate: "2027-02-18",
      endDate: "2027-02-18",
      url: "https://www.grandpalais.fr/fr/informations-pratiques",
      venueKey: "exceptional-closure",
      venueLabel: "Grand Palais",
    }]);
    expect(merged["exceptional-closure"]).toBeUndefined();
  });

  it("n’affiche jamais un lien extérieur injecté dans la programmation partagée", () => {
    expect(safeGrandPalaisUrl("https://www.grandpalais.fr/fr/programme/test"))
      .toBe("https://www.grandpalais.fr/fr/programme/test");
    expect(safeGrandPalaisUrl("https://example.test/fr/programme/test")).toBe("");
    const merged = mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, [{
      id: "external",
      title: "Lien extérieur",
      startDate: "2027-02-01",
      endDate: "2027-03-01",
      url: "https://example.test/fr/programme/test",
      venueKey: "gallery8",
      venueLabel: "Galerie 8",
    }]);
    expect(JSON.stringify(merged)).not.toContain("Lien extérieur");
  });
});
