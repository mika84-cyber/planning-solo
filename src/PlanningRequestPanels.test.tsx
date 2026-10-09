import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WishConversionDialog, wishChoiceType, wishConversionSummary } from "./PlanningRequestPanels";

describe("transformation des congés souhaités", () => {
  it("résume les natures choisies et compte les lignes laissées vides comme gardées", () => {
    expect(wishConversionSummary({ a: "annual", b: "rtt", c: "annual", d: "fraction", e: "cet" })).toBe("2 CA · 1 RTT · 1 FRA · 1 CET");
    expect(wishConversionSummary({ a: "annual", b: undefined, c: undefined })).toBe("1 CA · 2 gardés en souhait");
    expect(wishConversionSummary({ a: "half:morning", b: "half:afternoon", c: "cet" })).toBe("2 demi-journée · 1 CET");
  });

  it("donne à chaque nature la couleur de son type", () => {
    expect(wishChoiceType("half:afternoon")).toBe("half");
    expect(wishChoiceType("exceptional")).toBe("exceptional");
    expect(wishChoiceType("childcare")).toBe("childcare");
  });

  it("part de lignes vides ; « Autre » propose les demi-journées, le CET et l’annulation", () => {
    const html = renderToStaticMarkup(
      <WishConversionDialog dates={["2026-10-22", "2026-10-23"]} onClose={() => {}} onContinue={() => {}} />,
    );
    expect(html).toContain("Transformer 2 souhaits");
    expect(html.match(/<li class="kept">/g)).toHaveLength(2);
    expect(html).toContain("Une ligne laissée vide reste un souhait");
    expect(html).toContain("Choisissez au moins une nature");
    expect(html).not.toContain("Garder");
    for (const label of ["Demi-journée · matin", "Demi-journée · après-midi", "CET", "Annuler le souhait"])
      expect(html).toContain(label);
    expect(html).not.toContain("Jour exceptionnel");
    expect(html).not.toContain("Garde d’enfant");
  });

  it("n’offre que l’annulation à un souhait déjà d’un matin ou d’un après-midi", () => {
    const html = renderToStaticMarkup(
      <WishConversionDialog dates={["2026-10-22"]} moments={{ "2026-10-22": "morning" }} onClose={() => {}} onContinue={() => {}} />,
    );
    expect(html).toContain("Annuler le souhait");
    expect(html).not.toContain("Demi-journée · matin");
  });
});
