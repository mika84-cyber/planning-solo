import { describe, expect, it } from "vitest";
import { proposalChanges } from "./grandPalaisProposalChanges";

const glace = {
  id: "event-glace",
  title: "Grand Palais de Glace",
  startDate: "2026-12-06",
  endDate: "2027-01-04",
  url: "https://www.grandpalais.fr/fr/programme/glace",
  venueKey: "nef",
  venueLabel: "Nef",
  prices: [
    { group: "Session du matin", label: "Plein tarif", amount: 15 },
    { group: "Session de l’après-midi", label: "Plein tarif", amount: 21 },
    { label: "Moins de 3 ans", amount: 0 },
  ],
};

describe("ce qui a changé dans une proposition de la veille", () => {
  it("donne chaque tarif modifié, ajouté ou retiré, ancien → nouveau", () => {
    const next = {
      ...glace,
      prices: [
        { group: "Session du matin", label: "Plein tarif", amount: 17 },
        { group: "Session de l’après-midi", label: "Plein tarif", amount: 21 },
        { group: "Session du soir", label: "Plein tarif", amount: 25 },
      ],
    };
    expect(proposalChanges(glace, next)).toEqual([
      { label: "Session du matin · Plein tarif", before: "15 €", after: "17 €" },
      { label: "Session du soir · Plein tarif", before: null, after: "25 €" },
      { label: "Moins de 3 ans", before: "gratuit", after: null },
    ]);
  });

  it("donne les dates, l'espace et le titre quand ils changent", () => {
    const next = { ...glace, title: "Grand Palais de Glace 2026", endDate: "2027-01-11", venueLabel: "Nef et Galerie sud-est" };
    expect(proposalChanges(glace, next)).toEqual([
      { label: "Titre", before: "Grand Palais de Glace", after: "Grand Palais de Glace 2026" },
      { label: "Fin", before: "4 janvier 2027", after: "11 janvier 2027" },
      { label: "Espace", before: "Nef", after: "Nef et Galerie sud-est" },
    ]);
  });

  it("ne dit rien quand rien n'a changé", () => {
    expect(proposalChanges(glace, { ...glace })).toEqual([]);
  });
});
