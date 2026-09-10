import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearchText } from "./searchMatching";

describe("recherche tolérante", () => {
  it("ignore les accents, la casse et la ponctuation", () => {
    expect(normalizeSearchText("  Lou-Célia GERMÎOND  ")).toBe("lou celia germiond");
    expect(matchesSearch("Adélaïde Ragu", "adelaide")).toBe(true);
  });

  it("accepte une petite faute dans un nom ou un titre", () => {
    expect(matchesSearch("Priscilla Fantoli", "priscila")).toBe(true);
    expect(matchesSearch("Palais des enfants", "palai enfan")).toBe(true);
  });

  it("reste stricte pour les requêtes courtes ou très différentes", () => {
    expect(matchesSearch("Congés annuels", "ce")).toBe(false);
    expect(matchesSearch("Demande de congés", "bulletin paie")).toBe(false);
  });
});
