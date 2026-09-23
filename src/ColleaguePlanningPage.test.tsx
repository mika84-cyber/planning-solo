import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { colleagueBoardTitle, colleagueWeekDays, colleagueWeekTitle, ColleagueWeekTable, CommonDaysPanel, compareCommonPresence, sharedPlanningDayStatus, sharedPlanningTomorrowSummary } from "./ColleaguePlanningPage";
import type { SharedColleaguePlanning } from "./colleagueSharingApi";
import { dateKey, getDayInfo } from "./planningLogic";

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

  it("affiche F sur les jours de formation du cycle", () => {
    const dates = Array.from({ length: 42 }, (_, index) => new Date(2026, 8, index + 1, 12))
      .filter((date) => getDayInfo(date, planning.group).kind === "training" && dateKey(date) !== "2026-09-05");
    expect(dates.length).toBeGreaterThan(0);
    for (const date of dates) expect(sharedPlanningDayStatus(planning, date)).toBe("Formation");
  });

  it("précise la moitié de journée partagée", () => {
    const partial = { ...planning, days: [{ date: "2026-09-05", status: "partial" as const, halfMoment: "afternoon" as const }] };
    expect(sharedPlanningDayStatus(partial, new Date(2026, 8, 5, 12))).toBe("1/2 journée · après-midi");
  });

  it("associe le groupe au statut affiché dans la liste de demain", () => {
    expect(sharedPlanningTomorrowSummary(planning, new Date(2026, 8, 5, 12))).toEqual({
      status: "Absence",
      group: 1,
    });
  });
});

describe("vue semaine des collègues", () => {
  const reference = new Date(2026, 8, 17, 9);

  it("part du lundi de la semaine en cours et avance d’une semaine à la fois", () => {
    expect(colleagueWeekDays(0, reference).map((day) => day.getDate())).toEqual([14, 15, 16, 17, 18, 19, 20]);
    expect(colleagueWeekDays(1, reference)[0].getDate()).toBe(21);
    expect(colleagueWeekTitle(0, reference)).toBe("Semaine du 14 au 20 septembre");
    expect(colleagueWeekTitle(2, reference)).toBe("Semaine du 28 septembre au 4 octobre");
    // Un dimanche appartient encore à la semaine commencée le lundi précédent.
    expect(colleagueWeekDays(0, new Date(2026, 8, 20, 9))[0].getDate()).toBe(14);
  });

  it("range les personnes par groupe, une lettre par jour et aujourd’hui souligné", () => {
    const html = renderToStaticMarkup(<ColleagueWeekTable
      days={colleagueWeekDays(0, reference)}
      referenceDate={reference}
      rows={[
        { id: "self", name: "Mika", group: 2, isSelf: true, statusFor: () => "Repos" },
        { id: "agnes", name: "Agnès", group: 1, isSelf: false, statusFor: (date) => sharedPlanningDayStatus(planning, date), onOpen: () => undefined },
      ]}
    />);
    // Le nom d'un collègue ouvre son planning ; le sien reste un simple nom.
    expect(html).toContain('aria-label="Voir le planning de Agnès"');
    expect(html).not.toContain("Voir le planning de Mika");
    expect(html.indexOf("Groupe 1")).toBeLessThan(html.indexOf("Groupe 2"));
    expect(html.match(/class="colleague-week-cell /g)).toHaveLength(14 + 5);
    expect(html.match(/<th scope="col" class="is-today"/g)).toHaveLength(1);
    expect(html).toContain('class="is-self"');
    expect(html).toContain("Demi-journée");
  });
});

describe("colleagueBoardTitle", () => {
  it("nomme aujourd’hui, demain puis la date des jours suivants", () => {
    const reference = new Date(2026, 8, 17, 9);
    expect(colleagueBoardTitle(0, reference)).toBe("Qui travaille aujourd’hui ? (jeudi 17/09)");
    expect(colleagueBoardTitle(1, reference)).toBe("Qui travaille demain ? (vendredi 18/09)");
    expect(colleagueBoardTitle(4, reference)).toBe("Qui travaille lundi 21/09 ?");
    expect(colleagueBoardTitle(15, reference)).toBe("Qui travaille vendredi 02/10 ?");
  });
});

describe("date du lendemain dans « Qui travaille ? »", () => {
  it("passe au lendemain même tard le soir et franchit le changement d’année", () => {
    expect(colleagueBoardTitle(1, new Date(2026, 8, 13, 23, 30))).toBe("Qui travaille demain ? (lundi 14/09)");
    expect(colleagueBoardTitle(1, new Date(2026, 11, 31, 12))).toBe("Qui travaille demain ? (vendredi 01/01)");
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
