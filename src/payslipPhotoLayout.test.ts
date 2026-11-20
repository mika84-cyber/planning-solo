import { describe, expect, it } from "vitest";
import { RUBRICS_PAGE_LAYOUT } from "./payslipPhotoFixture";
import { photoRows, photoText, type PhotoFragment, type PhotoLayout } from "./payslipPhotoLayout";

/** Un fragment de texte posé sur une ligne penchée : `slope` en pixels par
 *  pixel, la ligne de base passant par (0, base). */
function fragment(text: string, x: number, base: number, slope = 0, height = 18): PhotoFragment {
  let cursor = x;
  const words = text.split(" ").map((word) => {
    const width = word.length * 10;
    const bottom = base + slope * (cursor + width / 2);
    const box = { text: word, x0: cursor, y0: Math.round(bottom - height), x1: cursor + width, y1: Math.round(bottom) };
    cursor += width + 8;
    return box;
  });
  const end = cursor - 8;
  return { baseline: [x, Math.round(base + slope * x), end, Math.round(base + slope * end)], words };
}

const layoutOf = (fragments: PhotoFragment[]): PhotoLayout => ({ width: 2200, height: 2933, fragments });

describe("lignes d'une photo de bulletin, reconstituées d'après la place des fragments", () => {
  it("remet en lignes une vraie feuille pliée et tenue à la main", () => {
    const rows = photoRows(RUBRICS_PAGE_LAYOUT).map((row) => row.text);
    // Chaque rubrique retrouve sa base, son taux et son montant, dans l'ordre.
    expect(rows).toContain("300.00 [Traitement de Base 2500.00 0.85714 2142.85");
    expect(rows).toContain("308.00 [Indemnité de Résidence 2142.85 3.00 64.29");
    expect(rows).toContain("CUMUL BRUT 2466.52");
    expect(rows).toContain("674.00 [Cotisation vieillesse 2466.52 6.90 170.19");
    expect(rows).toContain("823.22 [Forfait Navigo TZ mensuel 68.10 1.00 68.10");
    expect(rows).toContain("870.02 [Titres repas carte 4.95 20.00 -99.00");
    // Le mois d'origine d'un rappel, lu à part, rejoint sa ligne.
    expect(rows.some((row) => /^9\/2026 R.*Indemnité trav\. dom > 10 dim 54\.93 3\.00 164\.79$/.test(row))).toBe(true);
    // De haut en bas : le traitement, le brut, les cotisations, le net social.
    const at = (start: string) => rows.findIndex((row) => row.startsWith(start));
    expect(at("300.00")).toBeLessThan(at("CUMUL BRUT"));
    expect(at("CUMUL BRUT")).toBeLessThan(at("674.00"));
    expect(at("799.00")).toBeLessThan(at("886.15"));
  });

  it("suit la pente de chaque ligne : le montant va à sa rubrique, pas à la plus proche en hauteur", () => {
    // Feuille penchée de 2° : au bout de 1 500 px, une ligne est descendue
    // de 52 px, plus que l'écart entre deux lignes (35 px).
    const slope = Math.tan((2 * Math.PI) / 180);
    const rows = photoRows(layoutOf([
      fragment("300.00 Traitement de Base", 100, 500, slope),
      fragment("308.00 Indemnité de Résidence", 100, 535, slope),
      fragment("2253.22", 1600, 500, slope),
      fragment("67.60", 1600, 535, slope),
    ])).map((row) => row.text);
    expect(rows).toEqual(["300.00 Traitement de Base 2253.22", "308.00 Indemnité de Résidence 67.60"]);
  });

  it("recolle des montants qu'une tache a séparés de leur rubrique, et ignore la tache", () => {
    const rows = photoRows(layoutOf([
      fragment("794.29 MGEN part individuelle solidaire", 100, 500),
      // Une tache du papier, lue comme deux lettres géantes.
      fragment("sf", 560, 512, 0, 50),
      // Les montants, que le moteur a rendus avec une ligne de base fausse.
      { baseline: [700, 470, 1000, 470], words: [
        { text: "—,", x0: 700, y0: 455, x1: 716, y1: 470 },
        { text: "2415.41", x0: 720, y0: 482, x1: 790, y1: 500 },
        { text: "0.70", x0: 860, y0: 482, x1: 900, y1: 500 },
        { text: "16.91", x0: 950, y0: 482, x1: 1000, y1: 500 },
      ] },
      fragment("794.38 MGEN fonds aide aux retraités", 100, 535),
      fragment("30.31 2.65 0.80", 720, 535),
    ])).map((row) => row.text);
    expect(rows).toEqual([
      "794.29 MGEN part individuelle solidaire 2415.41 0.70 16.91",
      "794.38 MGEN fonds aide aux retraités 30.31 2.65 0.80",
    ]);
  });

  it("rend le texte ligne à ligne", () => {
    expect(photoText(layoutOf([fragment("CUMUL BRUT", 100, 300), fragment("2635.13", 900, 300), fragment("Octobre 2026", 700, 100)])))
      .toBe("Octobre 2026\nCUMUL BRUT 2635.13");
    expect(photoRows(layoutOf([]))).toEqual([]);
  });
});
