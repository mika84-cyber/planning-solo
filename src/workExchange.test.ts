import { describe, expect, it } from "vitest";
import { workedDayCount, type Entries } from "./appModel";
import {
  emptyWorkExchangeDraft,
  exchangeDraftFromExchange,
  exchangeEntryFields,
  holidaysForExchangeGive,
  holidaysForExchangeReturn,
  validateWorkExchange,
  workExchangeForDate,
} from "./workExchange";
import { addDays, dateKey, getDayInfo, localDate } from "./planningLogic";

const context = {
  group: 2,
  entries: {} as Entries,
  occupiedDates: new Set<string>(),
  isExceptionallyClosed: () => false,
};

describe("échanges de journées", () => {
  it("exige toujours une date d’échange et une date de retour", () => {
    expect(validateWorkExchange({
      ...emptyWorkExchangeDraft(2),
      partnerName: "Camille",
      partnerGroup: 1,
    }, context)).toBe("Les deux dates de l’échange sont obligatoires.");
  });

  it("valide les deux sens compatibles avec les cycles sans imposer leur ordre", () => {
    const dates = Array.from({ length: 120 }, (_, index) => addDays(localDate(2026, 7, 1), index));
    const returned = dates.find((date) =>
      getDayInfo(date, 2).kind === "off" && getDayInfo(date, 1).kind === "work");
    const agreement = dates.find((date) => returned && date > returned &&
      getDayInfo(date, 2).kind === "work" && getDayInfo(date, 1).kind === "off");
    expect(agreement).toBeDefined();
    expect(returned).toBeDefined();
    const valid = {
      ...emptyWorkExchangeDraft(2),
      partnerName: "Camille",
      partnerGroup: 1,
      agreementDate: dateKey(agreement!),
      returnDate: dateKey(returned!),
    };
    expect(validateWorkExchange(valid, context)).toBe("");
    const count = workedDayCount(
      2026, 0, 11, 2, [], {}, [], 480, () => false,
      (date) => date === valid.agreementDate ? "given" : date === valid.returnDate ? "return" : "",
    );
    expect(count).toMatchObject({ exchangedGiven: 1, exchangedReturned: 1 });
    expect(valid.returnDate < valid.agreementDate).toBe(true);
    expect(validateWorkExchange({ ...valid, returnDate: valid.agreementDate }, context))
      .toContain("deux journées différentes");
  });

  it("rend un férié cédé par un autre férié", () => {
    const days = Array.from({ length: 730 }, (_, index) => addDays(localDate(2026, 0, 1), index));
    // Un férié travaillé par le groupe 2 et en repos pour un autre groupe.
    for (const partnerGroup of [1, 3]) {
      const agreement = days.find((date) => getDayInfo(date, 2).holiday && getDayInfo(date, 2).kind === "work" && getDayInfo(date, partnerGroup).kind === "off");
      const holidayReturn = days.find((date) => agreement && date.getFullYear() === agreement.getFullYear() && getDayInfo(date, partnerGroup).holiday && getDayInfo(date, partnerGroup).kind === "work" && getDayInfo(date, 2).kind === "off");
      const plainReturn = days.find((date) => !getDayInfo(date, partnerGroup).holiday && getDayInfo(date, partnerGroup).kind === "work" && getDayInfo(date, 2).kind === "off");
      if (!agreement || !holidayReturn || !plainReturn) continue;
      const draft = { ...emptyWorkExchangeDraft(2), partnerName: "Camille", partnerGroup, agreementDate: dateKey(agreement) };
      expect(validateWorkExchange({ ...draft, returnDate: dateKey(plainReturn) }, context)).toContain("un autre jour férié");
      expect(validateWorkExchange({ ...draft, returnDate: dateKey(holidayReturn) }, context)).toBe("");
      // La liste proposée : les fériés possibles de la même année seulement.
      const list = holidaysForExchangeReturn(draft.agreementDate, 2, partnerGroup);
      expect(list.map((item) => item.key)).toContain(dateKey(holidayReturn));
      expect(list.every((item) => item.key.slice(0, 4) === draft.agreementDate.slice(0, 4))).toBe(true);
      return;
    }
    throw new Error("Aucun férié échangeable trouvé");
  });

  it("reconstitue le même échange depuis chacune de ses deux cases", () => {
    const entries: Entries = {
      "2026-08-03": {
        noteText: "", noteColor: "#D3943D", noteUpdatedAt: "", noteGroupId: "",
        leave: false, wish: false, holidayPay: "", closureOverride: "", updatedAt: "v1",
        exchangeId: "exchange-123", exchangeRole: "given", exchangePartner: "Camille",
        exchangePartnerGroup: 1, exchangeOtherDate: "2026-08-09",
      },
      "2026-08-09": {
        noteText: "", noteColor: "#D3943D", noteUpdatedAt: "", noteGroupId: "",
        leave: false, wish: false, holidayPay: "", closureOverride: "", updatedAt: "v2",
        exchangeId: "exchange-123", exchangeRole: "return", exchangePartner: "Camille",
        exchangePartnerGroup: 1, exchangeOtherDate: "2026-08-03",
      },
    };
    expect(workExchangeForDate(entries, "2026-08-09")).toMatchObject({
      agreementDate: "2026-08-03",
      returnDate: "2026-08-09",
    });
  });

  it("garde les horaires de chaque journée et les rend à la modification", () => {
    const draft = {
      ...emptyWorkExchangeDraft(2),
      id: "exchange-horaires",
      partnerName: "Camille",
      partnerGroup: 1,
      agreementDate: "2026-11-19",
      returnDate: "2026-10-04",
      agreementStart: "09:15",
      agreementEnd: "17:30",
      returnStart: "10:00",
      returnEnd: "18:00",
    };
    const fields = exchangeEntryFields(draft);
    expect(fields["2026-11-19"]).toMatchObject({ exchangeStart: "09:15", exchangeEnd: "17:30" });
    expect(fields["2026-10-04"]).toMatchObject({ exchangeStart: "10:00", exchangeEnd: "18:00" });
    const entries = Object.fromEntries(Object.entries(fields).map(([date, value]) => [date, { ...value, updatedAt: "v" }])) as unknown as Entries;
    const exchange = workExchangeForDate(entries, "2026-10-04")!;
    // Les horaires enregistrés passent avant ceux du profil.
    expect(exchangeDraftFromExchange(exchange, { start: "08:00", end: "16:00" })).toMatchObject({
      agreementStart: "09:15", agreementEnd: "17:30", returnStart: "10:00", returnEnd: "18:00",
    });
    // Un échange plus ancien, sans horaires : ceux du profil.
    const older = { ...exchange, agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "" };
    expect(exchangeDraftFromExchange(older, { start: "08:00", end: "16:00" })).toMatchObject({
      agreementStart: "08:00", agreementEnd: "16:00", returnStart: "08:00", returnEnd: "16:00",
    });
  });

  it("enregistre un remplacement seul de férié sur sa seule date, puis le relit", () => {
    const holiday = holidaysForExchangeGive(2, localDate(2026, 0, 1))[0];
    expect(holiday).toBeDefined();
    const draft = {
      ...emptyWorkExchangeDraft(2),
      id: "remplacement",
      partnerName: "Camille",
      partnerGroup: holiday.partnerGroup,
      agreementDate: holiday.key,
      replacement: true,
    };
    expect(validateWorkExchange(draft, context)).toBe("");
    // Un jour ordinaire ne se remplace pas seul.
    const ordinary = Array.from({ length: 60 }, (_, index) => addDays(localDate(2026, 8, 1), index))
      .find((date) => getDayInfo(date, 2).kind === "work" && !getDayInfo(date, 2).holiday && getDayInfo(date, 1).kind === "off")!;
    expect(validateWorkExchange({ ...draft, partnerGroup: 1, agreementDate: dateKey(ordinary) }, context))
      .toBe("Un remplacement seul ne concerne qu’un jour férié.");
    const fields = exchangeEntryFields(draft);
    expect(Object.keys(fields)).toEqual([holiday.key]);
    const entries = { [holiday.key]: { ...fields[holiday.key], updatedAt: "x" } } as unknown as Entries;
    expect(workExchangeForDate(entries, holiday.key)).toMatchObject({ agreementDate: holiday.key, returnDate: "" });
  });

  it("échange une formation contre une formation, jamais contre une journée ordinaire", () => {
    const dates = Array.from({ length: 120 }, (_, index) => addDays(localDate(2026, 9, 1), index));
    // Votre formation : le groupe 1 travaille ce mercredi-là.
    const mine = dates.find((date) => getDayInfo(date, 2).kind === "training" && getDayInfo(date, 1).kind === "work")!;
    // Sa formation : vous travaillez ce mercredi-là.
    const his = dates.find((date) => getDayInfo(date, 1).kind === "training" && getDayInfo(date, 2).kind === "work")!;
    const ordinary = dates.find((date) => getDayInfo(date, 2).kind === "off" && getDayInfo(date, 1).kind === "work")!;
    const draft = { ...emptyWorkExchangeDraft(2), partnerName: "Camille", partnerGroup: 1, agreementDate: dateKey(mine) };
    expect(validateWorkExchange({ ...draft, returnDate: dateKey(his) }, context)).toBe("");
    expect(validateWorkExchange({ ...draft, returnDate: dateKey(ordinary) }, context)).toMatch(/s’échange contre une formation/);
  });
});
