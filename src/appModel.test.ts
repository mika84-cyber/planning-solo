import { describe, expect, it } from "vitest";
import { groupNoteItemsByDate, noteDateLabel, personalPresenceForDate, roundCurrency, workedDayCount, type Entries, type NoteListItem } from "./appModel";
import { dateKey, getDayInfo } from "./planningLogic";

describe("groupNoteItemsByDate", () => {
  it("réunit les notes de Mika et d’Agnès sur une seule date", () => {
    const items: NoteListItem[] = [
      {
        key: "mika-1",
        date: "2026-09-10",
        label: "Préparer les documents",
        detail: "Jeudi 10 septembre 2026",
        kind: "note",
        author: "mika",
      },
      {
        key: "agnes-1",
        date: "2026-09-10",
        label: "Réserver la table",
        detail: "Jeudi 10 septembre 2026",
        kind: "note",
        author: "agnes",
      },
    ];

    const grouped = groupNoteItemsByDate(items);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].key).toBe("notes-2026-09-10");
    expect(grouped[0].notes).toEqual([
      expect.objectContaining({ author: "mika", label: "Préparer les documents" }),
      expect.objectContaining({ author: "agnes", label: "Réserver la table" }),
    ]);
  });

  it("affiche une date courte sans zéro ni point", () => {
    expect(noteDateLabel("2026-09-02")).toBe("2 sept 2026");
  });
});

describe("personalPresenceForDate", () => {
  const workDate = Array.from({ length: 31 }, (_, index) => new Date(2026, 8, index + 1, 12)).find((date) => getDayInfo(date, 2).kind === "work")!;
  const offDate = Array.from({ length: 31 }, (_, index) => new Date(2026, 8, index + 1, 12)).find((date) => getDayInfo(date, 2).kind === "off")!;
  const entry = (overrides: Partial<Entries[string]>): Entries[string] => ({ noteText: "", noteColor: "", noteUpdatedAt: "", noteGroupId: "", leave: false, wish: false, holidayPay: "", closureOverride: "", updatedAt: "", ...overrides });

  it("réutilise les mêmes priorités pour échange, absence directe et fermeture", () => {
    expect(personalPresenceForDate(offDate, 2, [], { [dateKey(offDate)]: entry({ exchangeRole: "return" }) }).status).toBe("work");
    expect(personalPresenceForDate(workDate, 2, [], { [dateKey(workDate)]: entry({ exchangeRole: "given" }) }).status).toBe("absence");
    expect(personalPresenceForDate(workDate, 2, [], { [dateKey(workDate)]: entry({ leave: true }) }).status).toBe("absence");
    expect(personalPresenceForDate(workDate, 2, [], {}, [], 480, () => true).status).toBe("absence");
  });

  it("partage précisément une demi-journée et une récupération partielle", () => {
    const key = dateKey(workDate);
    expect(personalPresenceForDate(workDate, 2, [{ id: "half", from: key, to: key, leaveType: "half", halfMoment: "afternoon", updatedAt: "" }], {}).halfMoment).toBe("afternoon");
    expect(personalPresenceForDate(workDate, 2, [], {}, [{ date: key, minutes: 240, start: "08:00", end: "12:00" }], 480)).toMatchObject({ status: "partial", halfMoment: "morning", absentMinutes: 240 });
  });

  it("cumule une demi-journée de congé et les récupérations sans dépasser la journée", () => {
    const key = dateKey(workDate);
    const periods = [{ id: "half", from: key, to: key, leaveType: "half" as const, halfMoment: "morning" as const, updatedAt: "" }];
    expect(personalPresenceForDate(workDate, 2, periods, {}, [{ date: key, minutes: 60, start: "15:00", end: "16:00" }], 480)).toMatchObject({
      status: "partial",
      absentMinutes: 300,
      halfMoment: undefined,
    });
    expect(personalPresenceForDate(workDate, 2, periods, {}, [{ date: key, minutes: 300 }], 480).status).toBe("absence");
  });

  it("ne transforme pas une heure de récupération en une demi-journée entière", () => {
    const key = dateKey(workDate);
    expect(personalPresenceForDate(workDate, 2, [], {}, [{ date: key, minutes: 60, start: "15:00", end: "16:00" }], 480)).toMatchObject({
      status: "partial",
      absentMinutes: 60,
      halfMoment: undefined,
    });
  });

  it("retire une fermeture exceptionnelle sur un jour de formation", () => {
    const trainingDate = Array.from({ length: 366 }, (_, index) => new Date(2026, 0, index + 1, 12)).find((date) => getDayInfo(date, 2).kind === "training")!;
    const result = workedDayCount(trainingDate.getFullYear(), trainingDate.getMonth(), trainingDate.getMonth(), 2, [], {}, [], 480, (key) => key === dateKey(trainingDate));
    expect(result.worked).toBeGreaterThanOrEqual(0);
    expect(result.exceptionallyClosed).toBe(1);
  });
});

describe("roundCurrency", () => {
  it("conserve une égalité exacte entre les montants affichés au centime", () => {
    const beforeTax = roundCurrency(2_001.005);
    const tax = roundCurrency(137.336);
    expect(roundCurrency(beforeTax - tax)).toBe(1_863.67);
  });
});
