import { describe, expect, it } from "vitest";
import { LeaveRequestValidationError, normalizeLeaveRequest } from "./leaveRequest";

describe("validation atomique d'une demande de congé", () => {
  it("normalise plusieurs jours, une demi-journée et garde des identifiants stables", () => {
    const input = {
      requestId: "request-2026-0001",
      requestKind: "leave",
      group: 2,
      periods: [{ type: "annual", from: "2026-08-24", to: "2026-08-26" }],
      timed: [{ type: "half", date: "2026-08-28", start: "09:00" }],
    };
    const first = normalizeLeaveRequest(input);
    const retry = normalizeLeaveRequest(input);
    expect(first).toEqual(retry);
    expect(first.periods).toMatchObject([
      { id: "request-2026-0001-1", leaveType: "annual", from: "2026-08-24", to: "2026-08-26" },
      { id: "request-2026-0001-2", leaveType: "half", halfMoment: "morning" },
    ]);
  });

  it("convertit une récupération en catégorie séparée", () => {
    const result = normalizeLeaveRequest({
      requestId: "request-2026-0002",
      requestKind: "recovery",
      group: 1,
      periods: [{ type: "recovery_day", from: "2026-09-02", to: "2026-09-02" }],
    });
    expect(result.periods).toHaveLength(0);
    expect(result.recoverySelections).toEqual([
      {
        id: "request-2026-0002-recovery-1",
        date: "2026-09-02",
        type: "recovery_day",
      },
    ]);
  });

  it("conserve toutes les variantes du formulaire complet de récupération", () => {
    const result = normalizeLeaveRequest({
      requestId: "request-2026-0004",
      requestKind: "recovery",
      group: 3,
      periods: [],
      timed: [
        { type: "recovery_half", date: "2026-09-03", start: "09:00", end: "13:00" },
        { type: "recovery_hours", date: "2026-09-04", start: "10:00", end: "12:30" },
        { type: "recovery_holiday", date: "2026-09-05", start: "09:00", end: "17:00" },
        { type: "recovery_training", date: "2026-09-06", start: "09:00", end: "15:00" },
      ],
    });
    expect(result.recoverySelections.map((item) => item.type)).toEqual([
      "recovery_half",
      "recovery_hours",
      "recovery_holiday",
      "recovery_training",
    ]);
  });

  it("refuse toute la demande lorsqu'une période est invalide", () => {
    expect(() => normalizeLeaveRequest({
      requestId: "request-2026-0003",
      requestKind: "leave",
      group: 2,
      periods: [{ type: "rtt", from: "2026-02-30", to: "2026-02-30" }],
    })).toThrow(LeaveRequestValidationError);
  });
});
