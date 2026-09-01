import { describe, expect, it } from "vitest";
import type { LeavePeriod } from "./appModel";
import { prepareAbsenceReplacement, visibleAbsencePeriod } from "./absenceReplacement";

describe("remplacement des congés par une absence prioritaire", () => {
  it("découpe le congé, recrédite les dates remplacées et enregistre la maladie atomiquement", () => {
    let sequence = 0;
    const annual: LeavePeriod = {
      id: "annual-1",
      from: "2026-09-07",
      to: "2026-09-11",
      leaveType: "annual",
      group: 2,
      updatedAt: "version-1",
    };
    const result = prepareAbsenceReplacement({
      periods: [annual],
      replacements: [{
        id: "sick-1",
        from: "2026-09-09",
        to: "2026-09-10",
        leaveType: "sick",
        group: 2,
      }],
      nowIso: "2026-09-01T10:00:00.000Z",
      createId: () => `split-${++sequence}`,
    });

    expect(result.refunded).toBe(true);
    expect(result.conflict).toBeUndefined();
    expect(result.operations).toEqual([
      { action: "delete-period", id: "annual-1", expectedUpdatedAt: "version-1" },
      { action: "save-period", id: "split-1", from: "2026-09-07", to: "2026-09-08", leaveType: "annual", halfMoment: "", group: 2 },
      { action: "save-period", id: "split-2", from: "2026-09-11", to: "2026-09-11", leaveType: "annual", halfMoment: "", group: 2 },
      { action: "save-period", id: "sick-1", from: "2026-09-09", to: "2026-09-10", leaveType: "sick", group: 2 },
    ]);
    expect(result.nextPeriods.map(({ from, to, leaveType }) => ({ from, to, leaveType }))).toEqual([
      { from: "2026-09-07", to: "2026-09-08", leaveType: "annual" },
      { from: "2026-09-09", to: "2026-09-10", leaveType: "sick" },
      { from: "2026-09-11", to: "2026-09-11", leaveType: "annual" },
    ]);
  });

  it.each(["rtt", "fraction", "half", "cet", "childcare", "exceptional"] as const)(
    "conserve le congé %s et ajoute quand même l’accident du travail",
    (leaveType) => {
      const result = prepareAbsenceReplacement({
        periods: [{
          id: `leave-${leaveType}`,
          from: "2026-09-09",
          to: "2026-09-09",
          leaveType,
          halfMoment: leaveType === "half" ? "morning" : "",
          group: 2,
          updatedAt: "version-1",
        }],
        replacements: [{
          id: "accident-1",
          from: "2026-09-09",
          to: "2026-09-09",
          leaveType: "work_accident",
          group: 2,
        }],
      });
      expect(result.refunded).toBe(false);
      expect(result.conflict).toBeUndefined();
      expect(result.nextPeriods.map((period) => period.leaveType)).toEqual([
        leaveType,
        "work_accident",
      ]);
    },
  );

  it("refuse d’écraser une autre absence sans solde", () => {
    const strike: LeavePeriod = {
      id: "strike-1",
      from: "2026-09-09",
      to: "2026-09-09",
      leaveType: "strike",
      updatedAt: "version-1",
    };
    const result = prepareAbsenceReplacement({
      periods: [strike],
      replacements: [{
        id: "sick-1",
        from: "2026-09-09",
        to: "2026-09-09",
        leaveType: "sick",
        group: 2,
      }],
    });
    expect(result.conflict).toBe(strike);
    expect(result.operations).toEqual([]);
    expect(result.nextPeriods).toEqual([strike]);
  });

  it("affiche la maladie en priorité tout en conservant le RTT annulable", () => {
    const periods: LeavePeriod[] = [
      { id: "rtt-1", from: "2026-09-09", to: "2026-09-09", leaveType: "rtt", updatedAt: "v1" },
      { id: "sick-1", from: "2026-09-09", to: "2026-09-09", leaveType: "sick", updatedAt: "v2" },
    ];
    expect(visibleAbsencePeriod(periods, "2026-09-09")?.leaveType).toBe("sick");
    expect(periods).toHaveLength(2);
  });
});
