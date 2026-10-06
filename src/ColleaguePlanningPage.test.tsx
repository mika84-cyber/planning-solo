import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { colleagueBoardTitle, colleagueWeekDays, colleagueWeekTitle, ColleagueWeekTable, CommonDaysPanel, compareCommonPresence, halfDayBase, sharedPlanningDayStatus, sharedPlanningHalfBase, sharedPlanningTomorrowSummary } from "./ColleaguePlanningPage";
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
      post: "",
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
    // Quatorze cases, puis la légende : E, C, B pour le travail, et F, R, A, ½.
    expect(html.match(/class="colleague-week-cell /g)).toHaveLength(14 + 7);
    // Les jours se lisent sur la ligne de chaque groupe : aujourd'hui y revient deux fois.
    expect(html.match(/<th scope="col" class="colleague-week-day is-today"/g)).toHaveLength(2);
    expect(html).toContain('class="is-self"');
    expect(html).toContain("Demi-journée");
  });

  it("coupe la case d’une demi-journée du côté de l’absence : à gauche le matin, à droite l’après-midi", () => {
    const html = renderToStaticMarkup(<ColleagueWeekTable
      days={colleagueWeekDays(0, reference)}
      referenceDate={reference}
      rows={[
        { id: "matin", name: "Matin", group: 1, isSelf: false, statusFor: () => "1/2 journée · matin" },
        { id: "aprem", name: "Après-midi", group: 2, isSelf: false, statusFor: () => "1/2 journée · après-midi" },
        { id: "flou", name: "Sans moment", group: 3, isSelf: false, statusFor: () => "Absence partielle" },
      ]}
    />);
    expect(html.match(/colleague-week-cell partial half-morning"/g)).toHaveLength(7);
    expect(html.match(/colleague-week-cell partial half-afternoon"/g)).toHaveLength(7);
    // Sans moment connu, la case reste entière.
    expect(html.match(/colleague-week-cell partial"/g)).toHaveLength(7);
    expect(html).toContain('title="1/2 journée · après-midi"');
    // La légende montre une demi-journée du matin, moitié travaillée à l'expo.
    expect(html).toContain('colleague-week-cell partial half-morning base-work"');
  });

  it("colore la moitié travaillée comme sa case habituelle : expo, accueil encadré, formation", () => {
    const html = renderToStaticMarkup(<ColleagueWeekTable
      days={colleagueWeekDays(0, reference)}
      referenceDate={reference}
      rows={[
        { id: "expo", name: "Expo", group: 1, isSelf: false, statusFor: () => "1/2 journée · matin", halfBaseFor: () => ({ tone: "work", post: "" }) },
        { id: "accueil", name: "Accueil", group: 2, isSelf: false, statusFor: () => "1/2 journée · après-midi", halfBaseFor: () => ({ tone: "work", post: "counter" }) },
        { id: "formation", name: "Formation", group: 3, isSelf: false, statusFor: () => "1/2 journée · matin", halfBaseFor: () => ({ tone: "training", post: "" }) },
      ]}
    />);
    expect(html.match(/partial half-morning base-work half-marked"/g)).toHaveLength(7);
    expect(html).toContain('partial half-morning base-work"');
    expect(html.match(/partial half-afternoon base-work on-post half-marked"/g)).toHaveLength(7);
    expect(html.match(/partial half-morning base-training half-marked"/g)).toHaveLength(7);
    // Les initiales, à l'endroit et l'une sous l'autre, occupent la moitié
    // travaillée : à droite le matin, à gauche l'après-midi ; « 1/2 » en
    // fraction dans la moitié posée.
    expect(html.match(/<i class="half-mark"><b>1<\/b><span class="half-bar"><\/span><b>2<\/b><\/i><i class="half-code"><b>E<\/b><b>X<\/b><\/i>/g)).toHaveLength(7);
    expect(html.match(/<i class="half-code"><b>A<\/b><b>C<\/b><\/i><i class="half-mark"><b>1<\/b><span class="half-bar"><\/span><b>2<\/b><\/i>/g)).toHaveLength(7);
    expect(html.match(/<i class="half-mark"><b>1<\/b><span class="half-bar"><\/span><b>2<\/b><\/i><i class="half-code"><b>F<\/b><\/i>/g)).toHaveLength(7);
  });

  it("retrouve la moitié travaillée d'une demi-journée partagée : poste transmis, formation selon le cycle", () => {
    const day = new Date(2026, 8, 14, 12);
    const shared = { ...planning, group: 2, days: [{ date: dateKey(day), status: "partial" as const, halfMoment: "morning" as const, workPost: "ticketing" as const }] };
    expect(sharedPlanningHalfBase(shared, day)).toEqual({ tone: getDayInfo(day, 2).kind === "training" ? "training" : "work", post: "ticketing" });
    // Un jour de formation du cycle donne une moitié jaune.
    let training = new Date(2026, 0, 1, 12);
    while (getDayInfo(training, 1).kind !== "training") training = new Date(training.getFullYear(), training.getMonth(), training.getDate() + 1, 12);
    expect(halfDayBase(1, training)).toEqual({ tone: "training", post: "" });
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
