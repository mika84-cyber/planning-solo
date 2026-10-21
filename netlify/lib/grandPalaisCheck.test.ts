import { describe, expect, it } from "vitest";
import { grandPalaisCheckFailureMessage } from "./grandPalaisCheck.mts";

describe("échec d'un contrôle manuel du site", () => {
  it("dit en clair que le site est indisponible, maintenance comprise", () => {
    expect(grandPalaisCheckFailureMessage(new Error("Programme Grand Palais indisponible (503)")))
      .toBe("Le site du Grand Palais est indisponible pour le moment (erreur 503, souvent une maintenance) : réessayez plus tard.");
    expect(grandPalaisCheckFailureMessage(new Error("Programme Grand Palais indisponible (403)")))
      .toBe("Le site du Grand Palais a refusé la lecture (erreur 403) : réessayez plus tard.");
  });

  it("distingue un site trop lent d'une lecture impossible", () => {
    const aborted = new Error("This operation was aborted");
    aborted.name = "AbortError";
    expect(grandPalaisCheckFailureMessage(aborted)).toContain("met trop de temps à répondre");
    expect(grandPalaisCheckFailureMessage(new Error("Programme Grand Palais indisponible")))
      .toContain("n’a pas pu être lu");
    expect(grandPalaisCheckFailureMessage("inattendu")).toContain("n’a pas pu être lu");
  });
});
