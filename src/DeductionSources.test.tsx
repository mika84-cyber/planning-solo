import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deductionSlices } from "./deductionPayMonth";
import {
  DeductionSources,
  deductionMoveTargets,
  deductionReason,
} from "./DeductionSources";

describe("retenues de la paie", () => {
  const [lateSick] = deductionSlices("sick", ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"]);
  const [earlyStrike] = deductionSlices("strike", ["2026-10-02"]);

  it("dit pourquoi une absence tombe sur la paie affichée", () => {
    expect(deductionReason(lateSick, "2026-10"))
      .toBe("Retenue sur la paie suivante : l’absence déborde après le 10.");
    expect(deductionReason(earlyStrike, "2026-10"))
      .toBe("Retenue le mois même : l’absence finit au plus tard le 10.");
    const [moved] = deductionSlices("sick", ["2026-09-15"], { "sick:2026-09-15": "2026-09" });
    expect(deductionReason(moved, "2026-09"))
      .toBe("Retenue déplacée sur cette paie ; la règle du 10 la plaçait sur celle d’octobre 2026.");
  });

  it("ne propose que l’autre paie possible, jamais celle affichée", () => {
    expect(deductionMoveTargets(lateSick, "2026-10")).toEqual(["2026-09"]);
    expect(deductionMoveTargets(earlyStrike, "2026-10")).toEqual(["2026-11"]);
  });

  it("affiche chaque tranche avec son montant et son bouton", () => {
    const html = renderToStaticMarkup(
      <DeductionSources
        payMonth="2026-10"
        sources={[
          { slice: lateSick, amount: 107.5 },
          { slice: earlyStrike, amount: null },
        ]}
        onMove={() => {}}
      />,
    );
    expect(html).toContain("Arrêt maladie du 8 au 11 septembre");
    expect(html).toContain("Grève du 2 octobre");
    expect(html).toContain("107,50");
    expect(html).toContain("Déplacer sur la paie de septembre 2026");
    expect(html).toContain("Déplacer sur la paie de novembre 2026");
  });

  it("propose de revenir à la règle une tranche déplacée", () => {
    const [moved] = deductionSlices("sick", ["2026-09-15"], { "sick:2026-09-15": "2026-09" });
    const html = renderToStaticMarkup(
      <DeductionSources payMonth="2026-09" sources={[{ slice: moved, amount: 77.5 }]} onMove={() => {}} />,
    );
    expect(html).toContain("Revenir à la règle du 10");
    expect(html).toContain("data-overridden");
  });

  it("ne montre rien sans retenue", () => {
    expect(renderToStaticMarkup(<DeductionSources payMonth="2026-10" sources={[]} onMove={() => {}} />))
      .toBe("");
  });
});
