import { describe, expect, it } from "vitest";
import {
  GRAND_PALAIS_EXCEPTIONAL_CLOSURES,
  grandPalaisExceptionalClosure,
} from "./grandPalaisClosures";

describe("fermetures exceptionnelles du Grand Palais", () => {
  it("repère les trois fermetures complètes de septembre 2026", () => {
    expect(GRAND_PALAIS_EXCEPTIONAL_CLOSURES.map((item) => item.date)).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-26",
    ]);
    expect(grandPalaisExceptionalClosure("2026-09-10")?.label).toBe(
      "Fermeture exceptionnelle du Grand Palais",
    );
  });

  it("ne crée aucun état métier pour les autres journées", () => {
    expect(grandPalaisExceptionalClosure("2026-09-11")).toBeUndefined();
    expect(Object.keys(GRAND_PALAIS_EXCEPTIONAL_CLOSURES[0])).toEqual(["date", "label"]);
  });

  it("reprend une fermeture complète acceptée depuis la surveillance", () => {
    expect(grandPalaisExceptionalClosure("2027-02-18", [{
      id: "closure-2027-02-18",
      title: "Fermeture exceptionnelle du Grand Palais",
      startDate: "2027-02-18",
      endDate: "2027-02-18",
      url: "https://www.grandpalais.fr/fr/informations-pratiques",
      venueKey: "exceptional-closure",
      venueLabel: "Grand Palais",
    }])?.label).toBe("Fermeture exceptionnelle du Grand Palais");
  });
});
