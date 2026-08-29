import type { Dispatch, SetStateAction } from "react";
import {
  calendarErrorMessage,
  postCalendar,
  postCalendarBatch,
  postCalendarPeriodsVerified,
} from "./calendarApi";
import { createClientId } from "./clientId";
import {
  emptyEntry,
  rangeKeys,
  type Entries,
  type LeavePeriod,
  type SharedEntry,
} from "./appModel";
import {
  addDays,
  dateKey,
  dayNumber,
  fromKey,
  groupConsecutive,
  type HalfMoment,
  type LeaveType,
} from "./planningLogic";
import type { usePlanningUiState } from "./usePlanningUiState";

type PlanningUiState = ReturnType<typeof usePlanningUiState>;

type PlanningEditorActionsOptions = {
  planningUi: PlanningUiState;
  entries: Entries;
  periods: LeavePeriod[];
  group: number;
  demoMode: boolean;
  setEntries: Dispatch<SetStateAction<Entries>>;
  setPeriods: Dispatch<SetStateAction<LeavePeriod[]>>;
  reloadCalendar: () => Promise<void>;
  cancelRangeSelection: () => void;
  notify: (message: string) => void;
  showSuccess: (message: string) => void;
  offerUndo: (message: string, action: () => void | Promise<void>) => void;
};

type BuildDaySaveOperationsOptions = {
  date: string;
  current: SharedEntry;
  entries: Entries;
  noteText: string;
  noteColor: string;
  noteGroupId: string;
  personalLeave: boolean;
  wish: boolean;
  holidayPay: SharedEntry["holidayPay"];
  overrides?: Partial<SharedEntry>;
  useLeaveRange: boolean;
  leaveRangeEnabled: boolean;
  leaveRangeFrom: string;
  leaveRangeTo: string;
  leaveType: LeaveType;
  halfMoment: HalfMoment;
  editingPeriodId: string | null;
  periods: LeavePeriod[];
  group: number;
  nowIso: string;
};

/** Prépare atomiquement la fiche jour et son lot réseau. La fonction pure
 * centralise notamment le contrôle de concurrence et l'extension d'un congé
 * souhaité sur une plage, deux détails faciles à perdre lors d'une évolution. */
export function buildDaySaveOperations({
  date,
  current,
  entries,
  noteText,
  noteColor,
  noteGroupId,
  personalLeave,
  wish,
  holidayPay,
  overrides,
  useLeaveRange,
  leaveRangeEnabled,
  leaveRangeFrom,
  leaveRangeTo,
  leaveType,
  halfMoment,
  editingPeriodId,
  periods,
  group,
  nowIso,
}: BuildDaySaveOperationsOptions) {
  const nextEntry: SharedEntry = {
    ...current,
    noteText: noteText.trim(),
    noteColor,
    noteGroupId: "",
    leave: personalLeave,
    wish,
    holidayPay,
    ...overrides,
  };
  if (nextEntry.noteText !== current.noteText)
    nextEntry.noteUpdatedAt = nextEntry.noteText ? nowIso : "";

  const operations: Array<Record<string, unknown>> = [];
  if (noteGroupId)
    operations.push({ action: "delete-note-period", groupId: noteGroupId });
  operations.push({
    action: "save-entry",
    date,
    ...nextEntry,
    expectedUpdatedAt: current.updatedAt,
  });
  if (useLeaveRange)
    operations.push({
      action: "save-period",
      id: editingPeriodId || undefined,
      expectedUpdatedAt: editingPeriodId
        ? periods.find((period) => period.id === editingPeriodId)?.updatedAt || ""
        : "",
      from: leaveRangeFrom,
      to: leaveRangeTo,
      leaveType,
      halfMoment: leaveType === "half" ? halfMoment : undefined,
      group,
    });
  if (wish && leaveRangeEnabled && leaveRangeFrom && leaveRangeTo)
    for (const key of rangeKeys(leaveRangeFrom, leaveRangeTo))
      if (key !== date)
        operations.push({
          action: "save-entry",
          date: key,
          ...(entries[key] || emptyEntry()),
          expectedUpdatedAt: entries[key]?.updatedAt || "",
          wish: true,
        });
  return { nextEntry, operations };
}

export function usePlanningEditorActions({
  planningUi,
  entries,
  periods,
  group,
  demoMode,
  setEntries,
  setPeriods,
  reloadCalendar: loadCalendar,
  cancelRangeSelection,
  notify,
  showSuccess: confirm,
  offerUndo,
}: PlanningEditorActionsOptions) {
  const {
    dayDate,
    setDayDate,
    noteText,
    setNoteText,
    noteColor,
    setNoteColor,
    noteGroupId,
    setNoteGroupId,
    noteDates,
    setNoteDates,
    setNoteSelecting,
    dayLeave,
    setDayLeave,
    dayPersonalLeave,
    dayWish,
    dayLeaveType,
    setDayLeaveType,
    dayHalfMoment,
    setDayHalfMoment,
    dayHolidayPay,
    leaveRangeEnabled,
    setLeaveRangeEnabled,
    leaveRangeFrom,
    setLeaveRangeFrom,
    leaveRangeTo,
    setLeaveRangeTo,
    setSavingDay,
    rangeLeaveType,
    rangeHalfMoment,
    separateDates,
    separatePeople,
    editingPeriodId,
    setEditingPeriodId,
    editingLegacyPeriod,
    deletingPeriod,
    setDeletingPeriod,
    setSavingRange,
  } = planningUi;

  function editDayLeavePeriod(period: LeavePeriod) {
    setEditingPeriodId(period.id);
    setDayLeave(true);
    setDayLeaveType(period.leaveType || "annual");
    setDayHalfMoment(period.halfMoment || "morning");
    setLeaveRangeEnabled(true);
    setLeaveRangeFrom(period.from);
    setLeaveRangeTo(period.to);
  }
  async function saveDay(overrides?: Partial<SharedEntry>) {
    if (!dayDate) return;
    const useLeaveRange = (leaveRangeEnabled || dayLeave) && dayLeave;
    if (
      useLeaveRange &&
      (!leaveRangeFrom || !leaveRangeTo || leaveRangeTo < leaveRangeFrom)
    ) {
      notify(
        "La date de fin des congés doit être identique ou postérieure à la date de début.",
      );
      return;
    }
    if (
      useLeaveRange &&
      dayNumber(fromKey(leaveRangeTo)) -
        dayNumber(fromKey(leaveRangeFrom)) +
        1 >
        366
    ) {
      notify("Une période de congés ne peut pas dépasser 366 jours.");
      return;
    }
    const current = entries[dayDate] || emptyEntry();
    const { nextEntry, operations } = buildDaySaveOperations({
      date: dayDate,
      current,
      entries,
      noteText,
      noteColor,
      noteGroupId,
      personalLeave: dayPersonalLeave,
      wish: dayWish,
      holidayPay: dayHolidayPay,
      overrides,
      useLeaveRange,
      leaveRangeEnabled,
      leaveRangeFrom,
      leaveRangeTo,
      leaveType: dayLeaveType,
      halfMoment: dayHalfMoment,
      editingPeriodId,
      periods,
      group,
      nowIso: new Date().toISOString(),
    });
    setSavingDay(true);
    try {
      const demo = demoMode;
      if (!demo) {
        await postCalendarBatch(operations);
        await loadCalendar();
      } else
        setEntries((currentEntries) => {
          const next = { ...currentEntries };
          if (noteGroupId) {
            for (const [key, entry] of Object.entries(next))
              if (entry.noteGroupId === noteGroupId) {
                const cleared = {
                  ...entry,
                  noteText: "",
                  noteUpdatedAt: "",
                  noteGroupId: "",
                };
                if (
                  !cleared.leave &&
                  !cleared.wish &&
                  !cleared.holidayPay &&
                  !cleared.closureOverride
                )
                  delete next[key];
                else next[key] = cleared;
              }
          }
          // Même condition que le serveur : un congé souhaité ou un choix de
          // compensation suffit à garder la journée, même sans note ni congé.
          if (
            !nextEntry.noteText &&
            !nextEntry.leave &&
            !nextEntry.wish &&
            !nextEntry.holidayPay &&
            !nextEntry.closureOverride
          )
            delete next[dayDate];
          else next[dayDate] = nextEntry;
          return next;
        });
      if (demo && useLeaveRange) {
        const updatedAt = new Date().toISOString();
        setPeriods((currentPeriods) => [
          ...currentPeriods.filter(
            (period) => !editingPeriodId || period.id !== editingPeriodId,
          ),
          {
            id: editingPeriodId || createClientId("period"),
            from: leaveRangeFrom,
            to: leaveRangeTo,
            leaveType: dayLeaveType,
            halfMoment: dayLeaveType === "half" ? dayHalfMoment : "",
            group,
            updatedAt,
          } satisfies LeavePeriod,
        ]);
      }
      setEditingPeriodId(null);
      setDayDate(null);
    } catch (error) {
      notify(
        calendarErrorMessage(
          error,
          "La modification n’a pas pu être synchronisée. Réessayez.",
        ),
      );
    } finally {
      setSavingDay(false);
    }
  }

  async function saveNoteAcrossDates() {
    const trimmedNote = noteText.trim();
    if (!trimmedNote || !noteDates.length) return;
    setSavingDay(true);
    try {
      const demo = demoMode;
      const groupId = noteGroupId || createClientId("note");
      const updatedAt = new Date().toISOString();
      if (!demo) {
        await postCalendarBatch(
          groupConsecutive(noteDates).map((range) => ({
            action: "save-note-period",
            groupId,
            from: range.from,
            to: range.to,
            noteText: trimmedNote,
            noteColor,
          })),
        );
        await loadCalendar();
      } else {
        setEntries((currentEntries) => {
          const next = { ...currentEntries };
          if (noteGroupId)
            for (const [key, entry] of Object.entries(next))
              if (entry.noteGroupId === noteGroupId) {
                const cleared = {
                  ...entry,
                  noteText: "",
                  noteUpdatedAt: "",
                  noteGroupId: "",
                };
                if (!cleared.leave && !cleared.wish && !cleared.holidayPay)
                  delete next[key];
                else next[key] = cleared;
              }
          for (const date of noteDates) {
            const previous = next[date] || emptyEntry();
            next[date] = {
              ...previous,
              noteText: trimmedNote,
              noteColor,
              noteUpdatedAt: updatedAt,
              noteGroupId: groupId,
            };
          }
          return next;
        });
      }
      setNoteSelecting(false);
      setNoteDates([]);
      setNoteText("");
      setNoteGroupId("");
      setNoteColor("#D3943D");
    } catch (error) {
      notify(
        calendarErrorMessage(
          error,
          "La note n’a pas pu être enregistrée. Réessayez.",
        ),
      );
    } finally {
      setSavingDay(false);
    }
  }

  async function clearLegacyPeriod(period: LeavePeriod) {
    if (
      !demoMode
    ) {
      await postCalendar({
          action: "clear-legacy-period",
          from: period.from,
          to: period.to,
      });
    }
    setEntries((current) => {
      const next = { ...current };
      for (
        let date = fromKey(period.from);
        dateKey(date) <= period.to;
        date = addDays(date, 1)
      ) {
        const key = dateKey(date);
        const entry = next[key];
        if (!entry) continue;
        const nextEntry: SharedEntry = { ...entry, leave: false };
        if (
          !nextEntry.noteText &&
          !nextEntry.leave &&
          !nextEntry.wish &&
          !nextEntry.holidayPay
        )
          delete next[key];
        else next[key] = nextEntry;
      }
      return next;
    });
  }

  async function restoreLeavePeriod(
    period: LeavePeriod,
    periodsToReplace: LeavePeriod[] = [],
  ) {
    const restoredId = createClientId("period");
    try {
      if (!demoMode) {
        const operations: Array<Record<string, unknown>> = periodsToReplace.map(
          (replacement) => ({
            action: "delete-period",
            id: replacement.id,
            expectedUpdatedAt: replacement.updatedAt,
          }),
        );
        operations.push({
          action: "save-period",
          id: restoredId,
          from: period.from,
          to: period.to,
          leaveType: period.leaveType || "annual",
          halfMoment:
            period.leaveType === "half" ? period.halfMoment || "" : "",
          group: period.group || group,
        });
        await postCalendarBatch(operations);
        await loadCalendar();
      } else {
        setPeriods((current) => [
          ...current.filter(
            (candidate) =>
              !periodsToReplace.some(
                (replacement) => replacement.id === candidate.id,
              ),
          ),
          {
            ...period,
            id: restoredId,
            legacy: false,
            updatedAt: new Date().toISOString(),
          },
        ].sort((a, b) => a.from.localeCompare(b.from)));
      }
      confirm("L’absence précédente a été rétablie.");
    } catch (error) {
      notify(
        calendarErrorMessage(
          error,
          "L’absence n’a pas pu être rétablie. Rechargez le planning puis réessayez.",
        ),
      );
    }
  }

  async function saveSeparateLeaveDates() {
    if (!separateDates.length || !separatePeople.length) return;
    const previousPeriod = editingPeriodId
      ? periods.find((period) => period.id === editingPeriodId) || null
      : editingLegacyPeriod;
    setSavingRange(true);
    try {
      const saved: LeavePeriod[] = [];
      const demo = demoMode;
      const operations: Array<Record<string, unknown>> = [];
      const periodResultIndexes: number[] = [];
      const useFastPeriodBatch =
        !editingLegacyPeriod &&
        !editingPeriodId &&
        separatePeople.length === 1 &&
        separatePeople[0] === "leave";
      const bulkPeriods: Array<Record<string, unknown>> = [];
      for (const date of [...separateDates].sort()) {
        for (const person of separatePeople) {
          // « Divers » et « souhaité » sont des marques posées sur la journée,
          // pas des périodes enregistrées : elles s'écrivent jour par jour et
          // doivent préserver ce que porte déjà la case.
          if (person === "personal" || person === "wish") {
            if (!demo) {
              const current = entries[date];
              operations.push({
                action: "save-leaves",
                date,
                leave:
                  person === "personal" ? true : Boolean(current?.leave),
                wish: person === "wish" ? true : Boolean(current?.wish),
                expectedUpdatedAt: current?.updatedAt || "",
              });
            }
            continue;
          }
          if (!demo) {
            const periodInput = {
              action: "save-period",
              id: createClientId("period"),
              from: date,
              to: date,
              leaveType: rangeLeaveType,
              halfMoment:
                rangeLeaveType === "half" ? rangeHalfMoment : undefined,
              group,
            };
            if (useFastPeriodBatch) {
              const { action: _action, ...bulkPeriod } = periodInput;
              bulkPeriods.push(bulkPeriod);
            } else {
              periodResultIndexes.push(operations.length);
              operations.push(periodInput);
            }
          } else {
            saved.push({
              id: createClientId("period"),
              from: date,
              to: date,
              leaveType: rangeLeaveType,
              halfMoment: rangeLeaveType === "half" ? rangeHalfMoment : "",
              group,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      if (!demo) {
        if (editingLegacyPeriod)
          operations.push({
            action: "clear-legacy-period",
            from: editingLegacyPeriod.from,
            to: editingLegacyPeriod.to,
          });
        else if (editingPeriodId)
          operations.push({
            action: "delete-period",
            id: editingPeriodId,
            expectedUpdatedAt:
              periods.find((period) => period.id === editingPeriodId)
                ?.updatedAt || "",
          });
        type SavedPeriodResponse = {
          period?: {
            id: string;
            from: string;
            to: string;
            leave_type?: LeaveType;
            half_moment?: HalfMoment;
            group?: number;
            updated_at: string;
          };
        };
        const periodResults: SavedPeriodResponse[] = [];
        if (useFastPeriodBatch) {
          const bulk = await postCalendarPeriodsVerified<
            NonNullable<SavedPeriodResponse["period"]>
          >(
            bulkPeriods as Array<
              Record<string, unknown> & { id: string; from: string; to: string }
            >,
          );
          periodResults.push(
            ...bulk.periods.map((period) => ({ period })),
          );
        } else {
          const batch = await postCalendarBatch<SavedPeriodResponse>(operations);
          periodResults.push(
            ...periodResultIndexes.map((index) => batch.results[index]),
          );
        }
        for (const result of periodResults) {
          const period = result?.period;
          if (!period) continue;
          saved.push({
            id: period.id,
            from: period.from,
            to: period.to,
            leaveType: period.leave_type || "",
            halfMoment: period.half_moment || "",
            group: period.group,
            updatedAt: period.updated_at,
          });
        }
      } else if (editingLegacyPeriod) {
        await clearLegacyPeriod(editingLegacyPeriod);
      }
      setPeriods((current) =>
        [
          ...current.filter(
            (period) =>
              period.id !== editingPeriodId &&
              (!editingLegacyPeriod || period.id !== editingLegacyPeriod.id),
          ),
          ...saved,
        ].sort((a, b) => a.from.localeCompare(b.from)),
      );
      if (demo && separatePeople.includes("personal")) {
        setEntries((current) => {
          const next = { ...current };
          for (const date of separateDates) {
            const previous = next[date] || emptyEntry();
            next[date] = { ...previous, leave: true };
          }
          return next;
        });
      }
      let refreshDelayed = false;
      if (!demo) {
        try {
          await loadCalendar();
        } catch {
          // Les périodes renvoyées par l'écriture sont déjà appliquées juste
          // au-dessus. Une relecture momentanément indisponible ne transforme
          // donc plus un enregistrement réussi en faux échec.
          refreshDelayed = true;
        }
      }
      cancelRangeSelection();
      if (previousPeriod && saved.length) {
        const replacements = [...saved];
        offerUndo("L’absence a été modifiée.", () =>
          restoreLeavePeriod(previousPeriod, replacements),
        );
      } else {
        confirm(
          refreshDelayed
            ? "Les congés sont enregistrés. La vérification distante se terminera automatiquement à la prochaine ouverture."
            : "Les congés sont enregistrés : le planning et les soldes sont à jour.",
        );
      }
    } catch (error) {
      await loadCalendar().catch(() => undefined);
      notify(
        calendarErrorMessage(
          error,
          "Les dates n’ont pas pu être synchronisées. Réessayez.",
        ),
      );
    } finally {
      setSavingRange(false);
    }
  }
  async function deleteLeavePeriod() {
    if (!deletingPeriod) return;
    const target = deletingPeriod;
    setSavingRange(true);
    try {
      if (target.legacy) {
        await clearLegacyPeriod(target);
      } else if (!demoMode) {
        await postCalendar({ action: "delete-period", id: target.id });
      }
      if (!target.legacy)
        setPeriods((current) =>
          current.filter((period) => period.id !== target.id),
        );
      setDeletingPeriod(null);
      offerUndo("L’absence a été supprimée.", () => restoreLeavePeriod(target));
    } catch {
      notify("La période n’a pas pu être annulée. Réessayez.");
    } finally {
      setSavingRange(false);
    }
  }

  return {
    editDayLeavePeriod,
    saveDay,
    saveNoteAcrossDates,
    saveSeparateLeaveDates,
    deleteLeavePeriod,
  };
}
