import { describe, expect, it } from "vitest";
import type { SelectedDay } from "./appModel";
import { groupPlanningRequestSelections } from "./usePlanningRequestActions";

describe("préparation du formulaire de demande", () => {
  it("regroupe les journées consécutives sans mélanger les rubriques", () => {
    const selections: SelectedDay[] = [
      { date: "2026-09-01", type: "annual" },
      { date: "2026-09-02", type: "annual" },
      { date: "2026-09-04", type: "annual" },
      { date: "2026-09-03", type: "rtt" },
      {
        date: "2026-09-05",
        type: "recovery_training",
        start: "09:00",
        end: "15:00",
      },
    ];

    const groups = groupPlanningRequestSelections(selections);
    expect(groups.annual).toEqual([
      { from: "2026-09-01", to: "2026-09-02" },
      { from: "2026-09-04", to: "2026-09-04" },
    ]);
    expect(groups.rtt).toEqual([{ from: "2026-09-03", to: "2026-09-03" }]);
    expect(groups.recoveryTraining).toEqual([selections[4]]);
    expect(groups.cet).toEqual([]);
  });
});
