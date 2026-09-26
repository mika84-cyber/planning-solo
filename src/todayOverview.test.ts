import { describe, expect, it } from "vitest";
import type { Entries } from "./appModel";
import { dateKey, getDayInfo, holidayName } from "./planningLogic";
import { computeTodayOverview } from "./todayOverview";

const GROUP = 2;

/** Le premier jour, à partir du 1er octobre 2026, qui remplit la condition. */
function firstDay(matches: (date: Date) => boolean) {
  for (let offset = 0; offset < 120; offset++) {
    const date = new Date(2026, 9, 1 + offset, 12);
    if (!holidayName(date) && matches(date)) return date;
  }
  throw new Error("Aucun jour ne convient");
}

function overview(today: Date, entries: Entries = {}) {
  return computeTodayOverview({
    today,
    group: GROUP,
    periods: [],
    entries,
    recoveryUses: [],
    selections: {},
    workDayMinutes: 7 * 60,
    isExceptionallyClosed: () => false,
  });
}

function exchange(role: "given" | "return", partnerGroup: number): Entries[string] {
  return {
    exchangeId: "echange-test",
    exchangeRole: role,
    exchangePartner: "Agnès",
    exchangePartnerGroup: partnerGroup,
    exchangeOtherDate: "2026-12-01",
  } as Entries[string];
}

const workingOthers = (date: Date) =>
  [1, 2, 3].filter((group) => group !== GROUP && getDayInfo(date, group).kind === "work");

describe("la ligne « Aujourd’hui » de l’accueil", () => {
  it("précise avec quel groupe on travaille un jour ordinaire", () => {
    const day = firstDay((date) => getDayInfo(date, GROUP).kind === "work" && workingOthers(date).length > 0);
    const others = workingOthers(day);
    const result = overview(day);
    expect(result.status).toBe("Travail");
    expect(result.todayGroupLabel).toBe(
      others.length === 1 ? `Avec le groupe ${others[0]}` : `Avec les groupes ${others.join(" et ")}`,
    );
  });

  it("précise aussi le groupe un jour travaillé en remplacement d’un collègue", () => {
    const day = firstDay((date) => getDayInfo(date, GROUP).kind === "off" && workingOthers(date).length > 0);
    const others = workingOthers(day);
    const result = overview(day, { [dateKey(day)]: exchange("return", others[0]) });
    expect(result.status).toBe("Travail · remplacement de Agnès");
    expect(result.todayGroupLabel).toBe(
      others.length === 1 ? `Avec le groupe ${others[0]}` : `Avec les groupes ${others.join(" et ")}`,
    );
  });

  it("ne cite aucun groupe un jour cédé à un collègue", () => {
    const day = firstDay((date) => getDayInfo(date, GROUP).kind === "work");
    const result = overview(day, { [dateKey(day)]: exchange("given", 1) });
    expect(result.status).toBe("Repos · remplacé par Agnès");
    expect(result.todayGroupLabel).toBe("");
  });
});
