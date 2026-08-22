import { describe, expect, it } from "vitest";
import {
  cetAvailableWholeDays,
  cetBalance,
  cetDepositCapacity,
  cetDepositEligibility,
  cetDepositsForYear,
  cetDepositWindow,
  cetOptionCapacity,
  cetSourceDepositCapacity,
  CET_WORK_RULES,
  cetYearEndSummary,
  emptyCetAccount,
} from "./cet";

describe("CET", () => {
  it("calcule le solde à partir de l'historique", () => {
    const account = emptyCetAccount();
    account.initialBalance = 12;
    account.operations = [
      { id: "1", date: "2026-12-01", kind: "deposit", days: 8, source: "rtt" },
      { id: "2", date: "2027-02-01", kind: "leave", days: 3 },
      { id: "3", date: "2027-02-02", kind: "adjustment", days: -1 },
    ];
    expect(cetBalance(account)).toBe(16);
  });

  it("sépare les 15 jours conservés des jours soumis à option", () => {
    const account = emptyCetAccount();
    account.initialBalance = 22;
    account.category = "B";
    expect(cetYearEndSummary(account, "fonctionnaire")).toEqual({
      balance: 22,
      protectedDays: 15,
      optionDays: 7,
      indemnityRate: 100,
      estimatedIndemnity: 700,
      canUseRafp: true,
    });
    expect(cetYearEndSummary(account, "contractuel").canUseRafp).toBe(false);
  });

  it("respecte la progression annuelle de dix jours au-dessus du seuil", () => {
    expect(cetDepositCapacity(10)).toBe(15);
    expect(cetDepositCapacity(15)).toBe(10);
    expect(cetDepositCapacity(58)).toBe(2);
    expect(cetDepositCapacity(65)).toBe(0);
  });

  it("ne propose que des jours entiers et applique le minimum du cycle", () => {
    expect(cetAvailableWholeDays({ annual: 4.5, rtt: 2.9, fraction: -1 })).toEqual({
      annual: 4,
      rtt: 2,
      fraction: 0,
    });
    expect(cetDepositEligibility(19.5)).toEqual({ eligible: false, missingDays: 0.5 });
    expect(cetDepositEligibility(20).eligible).toBe(true);
    expect(cetDepositEligibility(17, CET_WORK_RULES.visitor_service.minimumAnnualDaysTaken)).toEqual({ eligible: false, missingDays: 1 });
    expect(cetDepositEligibility(18, CET_WORK_RULES.visitor_service.minimumAnnualDaysTaken).eligible).toBe(true);
  });

  it("limite l'alimentation à la campagne annuelle et repère la demande existante", () => {
    const account = emptyCetAccount();
    account.operations = [
      { id: "1", date: "2026-11-20", kind: "deposit", days: 4, source: "annual" },
      { id: "2", date: "2025-12-02", kind: "deposit", days: 2, source: "rtt" },
    ];
    expect(cetDepositWindow("2026-11-14").open).toBe(false);
    expect(cetDepositWindow("2026-11-15")).toEqual({ open: true, year: 2026 });
    expect(cetDepositWindow("2026-12-31").open).toBe(true);
    expect(cetDepositWindow("2027-01-01").open).toBe(false);
    expect(cetDepositsForYear(account, 2026)).toHaveLength(1);
  });

  it("protège les quinze premiers jours contre le rachat ou la RAFP", () => {
    const account = emptyCetAccount();
    account.initialBalance = 21;
    expect(cetOptionCapacity(account)).toBe(6);
  });

  it("applique les plafonds CA et RTT du cycle accueil et surveillance", () => {
    const account = emptyCetAccount();
    expect(cetSourceDepositCapacity(account, "annual", 20, "2026-11-20")).toBe(11);
    expect(cetSourceDepositCapacity(account, "rtt", 20, "2026-11-20")).toBe(15);
    account.operations = [
      { id: "1", date: "2026-11-20", kind: "deposit", days: 8, source: "annual" },
    ];
    expect(cetSourceDepositCapacity(account, "annual", 20, "2026-11-20")).toBe(3);
  });
});
