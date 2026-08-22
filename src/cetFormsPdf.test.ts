import { describe, expect, it, vi } from "vitest";
import { createCetFundingPdf, createCetOpeningPdf } from "./cetFormsPdf";

const png = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
  (character) => character.charCodeAt(0),
);
vi.stubGlobal("fetch", vi.fn(async () => new Response(png, { status: 200 })));

const identity = {
  firstName: "Agnès",
  lastName: "Martin",
  service: "Direction des publics - Service de l'accueil des publics",
  groupCategory: "Groupe 1",
  date: "2026-11-15",
};

describe("formulaires CET en PDF", () => {
  it("prépare le formulaire officiel d'ouverture rempli", async () => {
    const result = await createCetOpeningPdf(identity);
    expect(result.filename).toBe("demande-ouverture-cet-perenne.pdf");
    expect(new Uint8Array(await result.blob.arrayBuffer()).slice(0, 4)).toEqual(
      new Uint8Array([37, 80, 68, 70]),
    );
  });

  it("prépare l'alimentation et l'indemnisation sur le modèle officiel", async () => {
    const result = await createCetFundingPdf({
      ...identity,
      year: 2026,
      annualBalance: 6,
      rttBalance: 4,
      depositDays: 8,
      balanceBefore: 18,
      keepDays: 20,
      indemnifyDays: 6,
    });
    expect(result.filename).toBe("alimentation-et-indemnisation-cet-2026.pdf");
    expect(new Uint8Array(await result.blob.arrayBuffer()).slice(0, 4)).toEqual(
      new Uint8Array([37, 80, 68, 70]),
    );
  });
});
