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
import type { RecoveryUse } from "./overtime";
import {
  fromKey,
  getDayInfo,
  groupConsecutive,
  leaveTypeLabel,
  s,
  type HalfMoment,
  type LeaveType,
} from "./planningLogic";

export type CalendarCleanupTarget = "absences" | "notes";
export type CalendarMutationOperation = Record<string, unknown>;

type IdFactory = (prefix: string) => string;

type BuildBulkDeleteOperationsOptions = {
  dates: Iterable<string>;
  target: CalendarCleanupTarget;
  entries: Entries;
  periods: LeavePeriod[];
  recoveryUses: RecoveryUse[];
  group: number;
  nowIso: string;
  createId?: IdFactory;
};

/** Construit le lot serveur sans effet de bord. Le helper est volontairement
 * exporté : les découpes de périodes et les contrôles de concurrence peuvent
 * ainsi être testés sans monter toute l’application. */
export function buildBulkDeleteOperations({
  dates,
  target,
  entries,
  periods,
  recoveryUses,
  group,
  nowIso,
  createId = createClientId,
}: BuildBulkDeleteOperationsOptions): CalendarMutationOperation[] {
  const selected = new Set(dates);
  const operations: CalendarMutationOperation[] = [];
  if (target === "notes") {
    for (const key of selected) {
      const current = entries[key];
      if (!current?.noteText) continue;
      operations.push({
        action: "save-entry",
        date: key,
        ...current,
        noteText: "",
        noteGroupId: "",
        noteUpdatedAt: nowIso,
        expectedUpdatedAt: current.updatedAt || "",
      });
    }
    return operations;
  }

  const legacyCleared = new Set<string>();
  for (const period of periods) {
    const periodDates = rangeKeys(period.from, period.to);
    const removed = periodDates.filter((key) => selected.has(key));
    if (!removed.length) continue;
    if (period.legacy) {
      for (const key of removed) {
        legacyCleared.add(key);
        const current = entries[key];
        operations.push({
          action: "save-leaves",
          date: key,
          leave: false,
          wish: Boolean(current?.wish),
          expectedUpdatedAt: current?.updatedAt || "",
        });
      }
      continue;
    }
    operations.push({
      action: "delete-period",
      id: period.id,
      expectedUpdatedAt: period.updatedAt,
    });
    const remaining = periodDates.filter((key) => !selected.has(key));
    for (const segment of groupConsecutive(remaining)) {
      operations.push({
        action: "save-period",
        id: createId("period"),
        from: segment.from,
        to: segment.to,
        leaveType: period.leaveType || "annual",
        halfMoment: period.leaveType === "half" ? period.halfMoment || "" : "",
        group: period.group || group,
      });
    }
  }
  for (const key of selected) {
    const current = entries[key];
    if (current?.leave && !legacyCleared.has(key)) {
      operations.push({
        action: "save-leaves",
        date: key,
        leave: false,
        wish: Boolean(current.wish),
        expectedUpdatedAt: current.updatedAt || "",
      });
    }
  }
  for (const recovery of recoveryUses) {
    if (selected.has(recovery.date))
      operations.push({ action: "delete-recovery-use", id: recovery.id });
  }
  return operations;
}

type SavedPeriodApi = {
  id: string;
  from: string;
  to: string;
  leave_type?: LeaveType;
  half_moment?: HalfMoment;
  group?: number;
  updated_at: string;
};

type PlanningEntryActionsOptions = {
  entries: Entries;
  periods: LeavePeriod[];
  recoveryUses: RecoveryUse[];
  group: number;
  demoMode: boolean;
  setEntries: Dispatch<SetStateAction<Entries>>;
  setPeriods: Dispatch<SetStateAction<LeavePeriod[]>>;
  setRecoveryUses: Dispatch<SetStateAction<RecoveryUse[]>>;
  setSavingDay: Dispatch<SetStateAction<boolean>>;
  closeDay: () => void;
  reloadCalendar: () => Promise<void>;
  cancelRequest: () => void;
  notify: (message: string) => void;
  showSuccess: (message: string) => void;
  setDeletingMultipleDates: Dispatch<SetStateAction<boolean>>;
  closeCalendarCleanup: () => void;
  clearBalanceDetail: () => void;
};

function savedPeriodFromApi(period: SavedPeriodApi, fallback: LeaveType): LeavePeriod {
  return {
    id: period.id,
    from: period.from,
    to: period.to,
    leaveType: period.leave_type || fallback,
    halfMoment: period.half_moment || "",
    group: period.group,
    updatedAt: period.updated_at,
  };
}

export function usePlanningEntryActions({
  entries,
  periods,
  recoveryUses,
  group,
  demoMode,
  setEntries,
  setPeriods,
  setRecoveryUses,
  setSavingDay,
  closeDay,
  reloadCalendar,
  cancelRequest,
  notify,
  showSuccess,
  setDeletingMultipleDates,
  closeCalendarCleanup,
  clearBalanceDetail,
}: PlanningEntryActionsOptions) {
  async function persistSingleDayPeriod(date: string, leaveType: LeaveType) {
    const input = {
      id: createClientId("period"),
      from: date,
      to: date,
      leaveType,
      group,
    };
    if (demoMode) {
      return {
        ...input,
        halfMoment: "" as const,
        updatedAt: new Date().toISOString(),
      } satisfies LeavePeriod;
    }
    const result = await postCalendarPeriodsVerified<SavedPeriodApi>([input]);
    return savedPeriodFromApi(result.periods[0], leaveType);
  }

  function appendPeriod(saved: LeavePeriod) {
    setPeriods((current) =>
      [...current, saved].sort((left, right) => left.from.localeCompare(right.from)),
    );
  }

  async function saveSickDateDirect(date: string) {
    if (periods.some((period) =>
      period.leaveType === "sick" && date >= period.from && date <= period.to
    )) {
      showSuccess("Cet arrêt maladie est déjà enregistré dans le planning.");
      closeDay();
      return;
    }
    setSavingDay(true);
    closeDay();
    try {
      appendPeriod(await persistSingleDayPeriod(date, "sick"));
      showSuccess("L’arrêt maladie est enregistré et l’estimation de paie est à jour.");
    } catch (error) {
      notify(calendarErrorMessage(error, "L’arrêt maladie n’a pas pu être enregistré."));
    } finally {
      setSavingDay(false);
    }
  }

  async function saveStrikeDateDirect(date: string) {
    if (periods.some((period) =>
      period.leaveType === "strike" && date >= period.from && date <= period.to
    )) {
      showSuccess("Cette journée de grève est déjà enregistrée dans le planning.");
      closeDay();
      cancelRequest();
      return;
    }
    const recordedAbsence = periods.find((period) =>
      period.leaveType !== "strike" && date >= period.from && date <= period.to
    );
    if (recordedAbsence) {
      notify(
        `${leaveTypeLabel(recordedAbsence.leaveType || "annual")} est déjà enregistré ce jour. Cette absence reste inchangée : retirez-la uniquement si elle doit réellement être remplacée par une grève.`,
      );
      return;
    }
    if (recoveryUses.some((item) => item.date === date)) {
      notify("Une récupération est déjà enregistrée ce jour. Elle reste inchangée : retirez-la uniquement si elle doit réellement être remplacée par une grève.");
      return;
    }
    if (entries[date]?.leave) {
      notify("Une autre absence est déjà enregistrée ce jour. Elle reste inchangée : retirez-la uniquement si elle doit réellement être remplacée par une grève.");
      return;
    }
    if (getDayInfo(fromKey(date), group).kind !== "work") {
      notify("Une grève ne peut être posée que sur une journée prévue travaillée.");
      return;
    }
    setSavingDay(true);
    closeDay();
    cancelRequest();
    try {
      appendPeriod(await persistSingleDayPeriod(date, "strike"));
      showSuccess("La grève est ajoutée au planning et l’estimation de paie est à jour.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La grève n’a pas pu être ajoutée."));
    } finally {
      setSavingDay(false);
    }
  }

  async function saveWishDateDirect(date: string, desired?: boolean) {
    const current = entries[date] || emptyEntry();
    const wish = desired ?? !current.wish;
    const nextEntry: SharedEntry = { ...current, wish };
    setSavingDay(true);
    closeDay();
    try {
      if (!demoMode) {
        await postCalendar({
          action: "save-entry",
          date,
          ...nextEntry,
          expectedUpdatedAt: current.updatedAt,
        });
        await reloadCalendar();
      } else {
        setEntries((currentEntries) => {
          const next = { ...currentEntries };
          if (!nextEntry.noteText && !nextEntry.leave && !nextEntry.wish && !nextEntry.holidayPay)
            delete next[date];
          else next[date] = nextEntry;
          return next;
        });
      }
      showSuccess(wish
        ? "Le congé souhaité est ajouté au planning."
        : "Le congé souhaité est retiré du planning.");
    } catch (error) {
      notify(calendarErrorMessage(error, wish
        ? "Le congé souhaité n’a pas pu être ajouté."
        : "Le congé souhaité n’a pas pu être retiré."));
    } finally {
      setSavingDay(false);
    }
  }

  async function saveOtherDateDirect(date: string) {
    if (periods.some((period) =>
      period.leaveType === "other" && date >= period.from && date <= period.to
    )) {
      showSuccess("Ce repère Divers est déjà enregistré dans le planning.");
      closeDay();
      return;
    }
    setSavingDay(true);
    closeDay();
    try {
      appendPeriod(await persistSingleDayPeriod(date, "other"));
      showSuccess("Divers est ajouté directement au planning.");
    } catch (error) {
      notify(calendarErrorMessage(error, "Divers n’a pas pu être enregistré."));
    } finally {
      setSavingDay(false);
    }
  }

  async function deleteMultiplePlanningDates(
    dates: string[],
    target: CalendarCleanupTarget,
  ) {
    const selected = new Set(dates);
    if (!selected.size) return;
    const label = target === "notes" ? "les notes" : "les absences et récupérations";
    if (!window.confirm(
      `Effacer ${label} sur ${selected.size} date${s(selected.size)} sélectionnée${s(selected.size)} ?`,
    )) return;

    setDeletingMultipleDates(true);
    try {
      const nowIso = new Date().toISOString();
      const operations = buildBulkDeleteOperations({
        dates: selected,
        target,
        entries,
        periods,
        recoveryUses,
        group,
        nowIso,
      });
      if (!operations.length) {
        notify("Aucune donnée à effacer sur les dates sélectionnées.");
        return;
      }
      if (!demoMode) {
        await postCalendarBatch(operations);
        await reloadCalendar();
      } else if (target === "notes") {
        setEntries((current) => {
          const next = { ...current };
          for (const key of selected) {
            const entry = next[key];
            if (!entry?.noteText) continue;
            next[key] = {
              ...entry,
              noteText: "",
              noteGroupId: "",
              noteUpdatedAt: nowIso,
            };
          }
          return next;
        });
      } else {
        setPeriods((current) => current.flatMap((period) => {
          const periodDates = rangeKeys(period.from, period.to);
          const remaining = periodDates.filter((key) => !selected.has(key));
          if (remaining.length === periodDates.length) return [period];
          return groupConsecutive(remaining).map((segment) => ({
            ...period,
            id: createClientId("period"),
            from: segment.from,
            to: segment.to,
            updatedAt: nowIso,
          }));
        }));
        setEntries((current) => {
          const next = { ...current };
          for (const key of selected)
            if (next[key]?.leave) next[key] = { ...next[key], leave: false };
          return next;
        });
        setRecoveryUses((current) =>
          current.filter((item) => !selected.has(item.date)),
        );
      }
      closeCalendarCleanup();
      clearBalanceDetail();
      showSuccess(`${selected.size} date${s(selected.size)} mise${s(selected.size)} à jour.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "La suppression multiple n’a pas pu être synchronisée."));
    } finally {
      setDeletingMultipleDates(false);
    }
  }

  return {
    deleteMultiplePlanningDates,
    saveOtherDateDirect,
    saveSickDateDirect,
    saveStrikeDateDirect,
    saveWishDateDirect,
  };
}
