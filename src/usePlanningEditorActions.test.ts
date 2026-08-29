import { describe, expect, it } from "vitest";
import { emptyEntry, type LeavePeriod } from "./appModel";
import { buildDaySaveOperations } from "./usePlanningEditorActions";

describe("édition d'une fiche du planning", () => {
  it("construit un lot cohérent pour une note, une demi-journée et un souhait étendu", () => {
    const editedPeriod: LeavePeriod = {
      id: "period-1",
      from: "2026-09-09",
      to: "2026-09-10",
      leaveType: "half",
      halfMoment: "morning",
      group: 2,
      updatedAt: "period-version",
    };
    const current = {
      ...emptyEntry(),
      noteText: "Ancienne note",
      updatedAt: "entry-version",
    };
    const { nextEntry, operations } = buildDaySaveOperations({
      date: "2026-09-09",
      current,
      entries: {
        "2026-09-09": current,
        "2026-09-10": { ...emptyEntry(), updatedAt: "second-version" },
      },
      noteText: "  Nouvelle note  ",
      noteColor: "#123456",
      noteGroupId: "note-group",
      personalLeave: false,
      wish: true,
      holidayPay: "prime",
      useLeaveRange: true,
      leaveRangeEnabled: true,
      leaveRangeFrom: "2026-09-09",
      leaveRangeTo: "2026-09-10",
      leaveType: "half",
      halfMoment: "afternoon",
      editingPeriodId: "period-1",
      periods: [editedPeriod],
      group: 2,
      nowIso: "2026-09-01T10:00:00.000Z",
    });

    expect(nextEntry).toMatchObject({
      noteText: "Nouvelle note",
      noteColor: "#123456",
      noteUpdatedAt: "2026-09-01T10:00:00.000Z",
      noteGroupId: "",
      wish: true,
      holidayPay: "prime",
    });
    expect(operations).toEqual([
      { action: "delete-note-period", groupId: "note-group" },
      {
        action: "save-entry",
        date: "2026-09-09",
        ...nextEntry,
        expectedUpdatedAt: "entry-version",
      },
      {
        action: "save-period",
        id: "period-1",
        expectedUpdatedAt: "period-version",
        from: "2026-09-09",
        to: "2026-09-10",
        leaveType: "half",
        halfMoment: "afternoon",
        group: 2,
      },
      {
        action: "save-entry",
        date: "2026-09-10",
        ...emptyEntry(),
        updatedAt: "second-version",
        expectedUpdatedAt: "second-version",
        wish: true,
      },
    ]);
  });

  it("horodate correctement l'effacement d'une note", () => {
    const current = {
      ...emptyEntry(),
      noteText: "À retirer",
      noteUpdatedAt: "old",
      updatedAt: "version",
    };
    const { nextEntry } = buildDaySaveOperations({
      date: "2026-09-09",
      current,
      entries: { "2026-09-09": current },
      noteText: "   ",
      noteColor: "#D3943D",
      noteGroupId: "",
      personalLeave: false,
      wish: false,
      holidayPay: "",
      useLeaveRange: false,
      leaveRangeEnabled: false,
      leaveRangeFrom: "",
      leaveRangeTo: "",
      leaveType: "annual",
      halfMoment: "morning",
      editingPeriodId: null,
      periods: [],
      group: 2,
      nowIso: "2026-09-01T10:00:00.000Z",
    });

    expect(nextEntry.noteText).toBe("");
    expect(nextEntry.noteUpdatedAt).toBe("");
  });
});
