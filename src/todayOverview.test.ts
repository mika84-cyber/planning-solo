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
    // Un nom complet ne garde que le prénom, pour tenir sur une ligne.
    const full = overview(day, { [dateKey(day)]: { ...exchange("given", 1), exchangePartner: "Auricio Lemos Bomfim" } });
    expect(full.status).toBe("Repos · remplacé par Auricio");
    expect(result.todayGroupLabel).toBe("");
  });

  it("affiche Accueil ou Billetterie au lieu de Travail, Travail en salles", () => {
    const day = firstDay((date) => getDayInfo(date, GROUP).kind === "work");
    const key = dateKey(day);
    expect(overview(day, { [key]: { workPost: "counter" } as Entries[string] }).status).toBe("Accueil");
    expect(overview(day, { [key]: { workPost: "ticketing" } as Entries[string] }).status).toBe("Billetterie");
    expect(overview(day, { [key]: { workPost: "" } as Entries[string] }).status).toBe("Travail");
  });
});

describe("le prochain jour travaillé de l’accueil", () => {
  it("précise le poste choisi, rien en salles", () => {
    const today = firstDay((date) => getDayInfo(date, GROUP).kind === "work");
    const next = overview(today).nextWork!;
    expect(overview(today).nextWorkPostLabel).toBe("");
    expect(overview(today, { [dateKey(next)]: { workPost: "ticketing" } as Entries[string] }).nextWorkPostLabel).toBe("Billetterie");
  });

  it("donne le prochain férié travaillé, même l’année suivante, et saute un férié en congé", () => {
    const today = new Date(2026, 11, 26, 12);
    const holiday = overview(today).nextWorkedHoliday!;
    expect(holiday.date.getFullYear()).toBe(2027);
    expect(holiday.name).toBe(getDayInfo(holiday.date, GROUP).holiday);
    expect(getDayInfo(holiday.date, GROUP).kind).toBe("work");
    // Aucun férié travaillé entre aujourd'hui et lui.
    for (let date = new Date(2026, 11, 27, 12); date < holiday.date; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12)) {
      const info = getDayInfo(date, GROUP);
      expect(Boolean(info.holiday) && info.kind === "work").toBe(false);
    }
    // Posé en congé, il laisse la place au suivant.
    const key = dateKey(holiday.date);
    const onLeave = computeTodayOverview({
      today, group: GROUP, entries: {}, recoveryUses: [], selections: {}, workDayMinutes: 7 * 60, isExceptionallyClosed: () => false,
      periods: [{ id: "conge", from: key, to: key, leaveType: "annual" } as Parameters<typeof computeTodayOverview>[0]["periods"][number]],
    }).nextWorkedHoliday!;
    expect(onLeave.date.getTime()).toBeGreaterThan(holiday.date.getTime());
  });
});
