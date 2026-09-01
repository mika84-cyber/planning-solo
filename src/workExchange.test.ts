import { describe, expect, it } from "vitest";
import { workedDayCount, type Entries } from "./appModel";
import {
  emptyWorkExchangeDraft,
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
});
