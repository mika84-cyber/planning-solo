import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { colleagueTomorrowDateLabel, CommonDaysPanel, compareCommonPresence, sharedPlanningDayStatus } from "./ColleaguePlanningPage";
import type { SharedColleaguePlanning } from "./colleagueSharingApi";

const planning: SharedColleaguePlanning = {
  owner: { userId: "agnes", displayName: "Agnès" },
  group: 1,
  days: [{ date: "2026-09-05", status: "absence" }],
};

describe("sharedPlanningDayStatus", () => {
  it("donne la priorité à une absence", () => {
    expect(sharedPlanningDayStatus(planning, new Date(2026, 8, 5, 12))).toBe("Absence");
  });

  it("résume les autres journées en travail ou repos", () => {
    const statuses = Array.from({ length: 14 }, (_, index) =>
      sharedPlanningDayStatus(planning, new Date(2026, 8, index + 6, 12)),
    );
    expect(statuses).toContain("Travail");
    expect(statuses).toContain("Repos");
  });

  it("précise la moitié de journée partagée", () => {
    const partial = { ...planning, days: [{ date: "2026-09-05", status: "partial" as const, halfMoment: "afternoon" as const }] };
    expect(sharedPlanningDayStatus(partial, new Date(2026, 8, 5, 12))).toBe("Demi-journée · après-midi");
  });
});

describe("colleagueTomorrowDateLabel", () => {
  it("affiche en français le jour et le mois du lendemain", () => {
    expect(colleagueTomorrowDateLabel(new Date(2026, 8, 4, 23, 30))).toBe("samedi 5 septembre");
  });

  it("gère le changement de mois et d’année", () => {
    expect(colleagueTomorrowDateLabel(new Date(2026, 11, 31, 12))).toBe("vendredi 1 janvier");
  });
});

describe("compareCommonPresence", () => {
  it("distingue journée, matin et après-midi sans exposer de motif", () => {
    expect(compareCommonPresence({ status: "work" }, { status: "work" })).toBe("full");
    expect(compareCommonPresence({ status: "partial", halfMoment: "afternoon" }, { status: "work" })).toBe("morning");
    expect(compareCommonPresence({ status: "work" }, { status: "partial", halfMoment: "morning" })).toBe("afternoon");
    expect(compareCommonPresence({ status: "absence" }, { status: "work" })).toBeNull();
  });

  it("signale une demi-journée dont la précision manque", () => {
    expect(compareCommonPresence({ status: "partial" }, { status: "work" })).toBe("imprecise");
  });

  it("exclut une demi-journée imprécise si l’autre personne est absente toute la journée", () => {
    expect(compareCommonPresence({ status: "rest" }, { status: "partial" })).toBeNull();
    expect(compareCommonPresence({ status: "absence" }, { status: "partial" })).toBeNull();
    expect(compareCommonPresence({ status: "partial" }, { status: "rest" })).toBeNull();
    expect(compareCommonPresence({ status: "partial" }, { status: "absence" })).toBeNull();
  });

  it("affiche un état vide quand aucune présence commune n’est possible sur la période", () => {
    const impreciseColleaguePlanning = {
      ...planning,
      days: [{ date: "2026-09-07", status: "partial" as const }],
    };
    const html = renderToStaticMarkup(
      <CommonDaysPanel
        planning={impreciseColleaguePlanning}
        view={new Date(2026, 8, 1, 12)}
        referenceDate={new Date(2026, 8, 1, 12)}
        getOwnPresence={() => ({ status: "rest" })}
      />,
    );

    expect(html).toContain("Aucun jour de présence commune sur cette période");
    expect(html).not.toContain("Présence commune possible");
  });
});
