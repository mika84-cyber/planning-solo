import { describe, expect, it } from "vitest";
import type { LeavePeriod } from "./appModel";
import { parseCalendarSnapshot } from "./calendarPayload";
import { parseDemoCompletedRequestJson } from "./demoCompletedRequest";
import { normalizeLeaveRequest } from "./leaveRequest";
import { computeLeaveStats } from "./leaveStats";
import {
  automaticHalfBalance,
  dateKey,
  getDayInfo,
  halfBalanceFromApi,
  halfBalanceOf,
  localDate,
  localHalfBalance,
  periodTypeLabel,
} from "./planningLogic";
import { requestLeaveBalanceUsage } from "./RequestValidationSummary";
import { buildAnnualPdfAbsences } from "./useAnnualPdfExport";

// Trois jours travaillés du groupe 2 en septembre 2026 : une demi-journée
// posée un jour de repos ne serait décomptée de rien.
const workDays = Array.from({ length: 30 }, (_, index) => localDate(2026, 8, index + 1))
  .filter((date) => getDayInfo(date, 2).kind === "work")
  .map(dateKey);

function half(id: string, date: string, halfBalance?: LeavePeriod["halfBalance"]): LeavePeriod {
  return { id, from: date, to: date, leaveType: "half", halfMoment: "morning", group: 2, updatedAt: "", ...(halfBalance ? { halfBalance } : {}) };
}

function balances(periods: LeavePeriod[]) {
  const stats = computeLeaveStats({
    year: 2026,
    today: new Date(2026, 0, 1),
    periods,
    group: 2,
    manualAdjustments: undefined,
  });
  return Object.fromEntries(stats.balances.map((balance) => [balance.type, balance.used]));
}

describe("demi-journées de RTT et de fractionnement", () => {
  it("prend une demi-journée sur les congés annuels tant que rien d’autre n’est choisi", () => {
    expect(halfBalanceOf({})).toBe("annual");
    expect(halfBalanceOf({ halfBalance: "rtt" })).toBe("rtt");
    expect(balances([half("a", workDays[0])])).toEqual({ annual: 0.5, rtt: 0, fraction: 0 });
  });

  it("propose les CA, puis les RTT quand il n'y a plus de CA, puis le fractionnement", () => {
    expect(automaticHalfBalance({ annual: 3, rtt: 15, fraction: 2 })).toBe("annual");
    expect(automaticHalfBalance({ annual: 0.5, rtt: 15, fraction: 2 })).toBe("annual");
    expect(automaticHalfBalance({ annual: 0, rtt: 15, fraction: 2 })).toBe("rtt");
    expect(automaticHalfBalance({ annual: 0, rtt: 0, fraction: 2 })).toBe("fraction");
    // Tout est épuisé : les CA, et le contrôle des soldes signalera le manque.
    expect(automaticHalfBalance({ annual: 0, rtt: 0, fraction: 0 })).toBe("annual");
  });

  it("tient compte des demi-journées déjà choisies dans la même demande", () => {
    // Il reste une demi-journée de CA, déjà prise par une autre date de la demande.
    expect(automaticHalfBalance({ annual: 0.5, rtt: 15, fraction: 2 }, { annual: 0.5 })).toBe("rtt");
    expect(automaticHalfBalance({ annual: 0, rtt: 0.5, fraction: 2 }, { rtt: 0.5 })).toBe("fraction");
  });

  it("décompte une demi-journée du solde choisi, et de lui seul", () => {
    expect(balances([
      half("a", workDays[0], "rtt"),
      half("b", workDays[1], "fraction"),
      half("c", workDays[2]),
    ])).toEqual({ annual: 0.5, rtt: 0.5, fraction: 0.5 });
  });

  it("nomme la demi-journée d’après son solde", () => {
    expect(periodTypeLabel(half("a", workDays[0]))).toBe("Congés en demi-journée");
    expect(periodTypeLabel(half("a", workDays[0], "rtt"))).toBe("RTT en demi-journée");
    expect(periodTypeLabel(half("a", workDays[0], "fraction"))).toBe("Fractionnement en demi-journée");
    expect(periodTypeLabel({ leaveType: "rtt", halfBalance: "fraction" })).toBe("RTT");
  });

  it("ne range le solde que sur une demi-journée, et jamais celui des CA", () => {
    expect(localHalfBalance("half", "rtt")).toEqual({ halfBalance: "rtt" });
    expect(localHalfBalance("half", "annual")).toEqual({});
    expect(localHalfBalance("annual", "rtt")).toEqual({});
    expect(halfBalanceFromApi({ leave_type: "half", half_balance: "fraction" })).toEqual({ halfBalance: "fraction" });
    expect(halfBalanceFromApi({ leave_type: "annual", half_balance: "rtt" })).toEqual({});
    expect(halfBalanceFromApi({ leave_type: "half", half_balance: "cet" })).toEqual({});
  });

  it("retrouve le solde d’une demi-journée au retour du formulaire", () => {
    const request = normalizeLeaveRequest({
      requestId: "request-half-rtt",
      requestKind: "leave",
      group: 2,
      periods: [],
      timed: [
        { type: "half", date: workDays[0], start: "09:15", halfBalance: "rtt" },
        { type: "half", date: workDays[1], start: "13:30", halfBalance: "fraction" },
        { type: "half", date: workDays[2], start: "09:15", halfBalance: "cet" },
      ],
    });
    expect(request.periods.map((period) => period.halfBalance)).toEqual(["rtt", "fraction", undefined]);
  });

  it("vérifie le bon solde avant d’envoyer la demande", () => {
    expect(requestLeaveBalanceUsage([
      { date: workDays[0], type: "half", halfBalance: "rtt" },
      { date: workDays[1], type: "half" },
      { date: workDays[2], type: "rtt" },
    ], 2)).toEqual({ annual: 0.5, rtt: 1.5, fraction: 0 });
  });

  it("garde le solde en lisant la réponse du serveur et une demande de démonstration", () => {
    const snapshot = parseCalendarSnapshot({
      periods: [
        { id: "p1", from: workDays[0], to: workDays[0], leave_type: "half", half_moment: "morning", half_balance: "rtt", updated_at: "u" },
        { id: "p2", from: workDays[1], to: workDays[1], leave_type: "half", half_moment: "morning", updated_at: "u" },
      ],
    });
    expect(snapshot.periods.map((period) => period.halfBalance)).toEqual(["rtt", undefined]);

    const demo = parseDemoCompletedRequestJson(JSON.stringify({
      requestId: "demo-half",
      requestKind: "leave",
      group: 2,
      periods: [],
      timed: [{ type: "half", date: workDays[0], start: "09:15", end: "13:30", halfBalance: "fraction" }],
    }));
    if (!demo || demo.requestKind !== "leave") throw new Error("Demande attendue");
    expect(demo.timed[0].halfBalance).toBe("fraction");
  });

  it("colore et nomme la demi-journée de RTT dans le PDF annuel", () => {
    const { halfBalances, halfMoments } = buildAnnualPdfAbsences(2026, [
      { ...half("a", workDays[0], "rtt") },
      { ...half("b", workDays[1]) },
    ], []);
    expect(halfBalances.get(workDays[0])).toBe("rtt");
    expect(halfBalances.has(workDays[1])).toBe(false);
    expect(halfMoments.get(workDays[1])).toBe("morning");
  });
});
