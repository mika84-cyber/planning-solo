import { describe, expect, it } from "vitest";
import { emptyEntry, type LeavePeriod, type SharedEntry } from "./appModel";
import { buildBulkDeleteOperations } from "./usePlanningEntryActions";

const entry = (overrides: Partial<SharedEntry>): SharedEntry => ({
  ...emptyEntry(),
  ...overrides,
});

describe("opérations groupées du planning", () => {
  it("efface uniquement le contenu de note et conserve le contrôle de concurrence", () => {
    const operations = buildBulkDeleteOperations({
      dates: ["2026-09-09", "2026-09-10"],
      target: "notes",
      entries: {
        "2026-09-09": entry({
          noteText: "Préparer la salle",
          noteGroupId: "note-1",
          noteUpdatedAt: "2026-09-01T08:00:00.000Z",
          updatedAt: "version-1",
          wish: true,
        }),
        "2026-09-10": entry({ wish: true, updatedAt: "version-2" }),
      },
      periods: [],
      recoveryUses: [],
      group: 2,
      nowIso: "2026-09-02T10:00:00.000Z",
    });

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      action: "save-entry",
      date: "2026-09-09",
      noteText: "",
      noteGroupId: "",
      noteUpdatedAt: "2026-09-02T10:00:00.000Z",
      expectedUpdatedAt: "version-1",
      wish: true,
    });
  });

  it("découpe une période autour des dates retirées et supprime la récupération", () => {
    let sequence = 0;
    const period: LeavePeriod = {
      id: "period-original",
      from: "2026-09-07",
      to: "2026-09-11",
      leaveType: "annual",
      group: 2,
      updatedAt: "period-version",
    };
    const operations = buildBulkDeleteOperations({
      dates: ["2026-09-09"],
      target: "absences",
      entries: {
        "2026-09-09": entry({ leave: true, wish: true, updatedAt: "entry-version" }),
      },
      periods: [period],
      recoveryUses: [{
        id: "recovery-1",
        date: "2026-09-09",
        minutes: 480,
        updatedAt: "recovery-version",
      }],
      group: 1,
      nowIso: "2026-09-02T10:00:00.000Z",
      createId: () => `period-${++sequence}`,
    });

    expect(operations).toEqual([
      {
        action: "delete-period",
        id: "period-original",
        expectedUpdatedAt: "period-version",
      },
      {
        action: "save-period",
        id: "period-1",
        from: "2026-09-07",
        to: "2026-09-08",
        leaveType: "annual",
        halfMoment: "",
        group: 2,
      },
      {
        action: "save-period",
        id: "period-2",
        from: "2026-09-10",
        to: "2026-09-11",
        leaveType: "annual",
        halfMoment: "",
        group: 2,
      },
      {
        action: "save-leaves",
        date: "2026-09-09",
        leave: false,
        wish: true,
        expectedUpdatedAt: "entry-version",
      },
      { action: "delete-recovery-use", id: "recovery-1" },
    ]);
  });

  it("ne double pas l’effacement d’une ancienne période locale", () => {
    const operations = buildBulkDeleteOperations({
      dates: ["2026-09-09"],
      target: "absences",
      entries: {
        "2026-09-09": entry({ leave: true, wish: false, updatedAt: "legacy-version" }),
      },
      periods: [{
        id: "legacy-period",
        from: "2026-09-09",
        to: "2026-09-09",
        leaveType: "annual",
        updatedAt: "legacy-version",
        legacy: true,
      }],
      recoveryUses: [],
      group: 2,
      nowIso: "2026-09-02T10:00:00.000Z",
    });

    expect(operations).toEqual([{
      action: "save-leaves",
      date: "2026-09-09",
      leave: false,
      wish: false,
      expectedUpdatedAt: "legacy-version",
    }]);
  });
});
