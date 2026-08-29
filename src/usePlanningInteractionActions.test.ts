import { describe, expect, it } from "vitest";
import {
  buildPlanningRequestStart,
  toggleSortedDate,
} from "./usePlanningInteractionActions";

describe("interactions du planning", () => {
  it("ajoute et retire une date en conservant un ordre stable", () => {
    const source = ["2026-09-10", "2026-09-12"];
    expect(toggleSortedDate(source, "2026-09-09")).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-12",
    ]);
    expect(toggleSortedDate(source, "2026-09-10")).toEqual(["2026-09-12"]);
    expect(source).toEqual(["2026-09-10", "2026-09-12"]);
  });

  it("préremplit une récupération de formation avec la quotité choisie", () => {
    const start = buildPlanningRequestStart({
      kind: "recovery",
      initialDate: "2026-09-09",
      requestedType: "recovery_training",
      group: 2,
      workQuota: "half",
      isSelectable: () => true,
    });

    expect(start).toEqual({
      initialType: "recovery_training",
      sickRequest: false,
      selections: {
        "2026-09-09": {
          date: "2026-09-09",
          type: "recovery_training",
          start: "09:00",
          end: "12:00",
        },
      },
      warningDate: null,
    });
  });

  it("signale une date non sélectionnable sans l'ajouter", () => {
    const start = buildPlanningRequestStart({
      kind: "leave",
      initialDate: "2026-09-13",
      requestedType: "sick",
      group: 1,
      workQuota: "full",
      isSelectable: () => false,
    });

    expect(start.initialType).toBe("sick");
    expect(start.sickRequest).toBe(true);
    expect(start.selections).toEqual({});
    expect(start.warningDate).toBe("2026-09-13");
  });
});
