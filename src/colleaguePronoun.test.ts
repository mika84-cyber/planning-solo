import { describe, expect, it } from "vitest";
import { colleagueObjectPronoun } from "./colleaguePronoun";

describe("accord du collègue", () => {
  it("accorde les prénoms féminins et masculins", () => {
    expect(colleagueObjectPronoun("Adriana Martin")).toBe("la");
    expect(colleagueObjectPronoun("Camille")).toBe("la");
    expect(colleagueObjectPronoun("Vicky Martin")).toBe("la");
    expect(colleagueObjectPronoun("Pierre Dupont")).toBe("le");
    expect(colleagueObjectPronoun("Stéphane")).toBe("le");
  });

  it("reste explicite tant que le prénom n’est pas renseigné", () => {
    expect(colleagueObjectPronoun("  ")).toBe("le/la");
  });
});
