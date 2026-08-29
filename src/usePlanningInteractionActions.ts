import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  TouchEvent,
} from "react";
import type { Entries, RequestKind, SelectedDay, ViewMode } from "./appModel";
import { trainingRecoveryTimes, type WorkQuota } from "./overtime";
import {
  dateKey,
  fromKey,
  getDayInfo,
  localDate,
  type LeaveType,
  type MultiDatePerson,
  type SelectionType,
} from "./planningLogic";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { usePlanningUiState } from "./usePlanningUiState";
import type { useWorkTimeUiState } from "./useWorkTimeUiState";

type PlanningUiState = ReturnType<typeof usePlanningUiState>;
type AppShellUiState = ReturnType<typeof useAppShellUiState>;
type WorkTimeUiState = ReturnType<typeof useWorkTimeUiState>;

/** Bascule une date sans modifier la collection reçue. Le tri garantit que
 * les lots et leur récapitulatif restent stables quel que soit l'ordre des
 * clics dans le calendrier. */
export function toggleSortedDate(dates: readonly string[], key: string) {
  return dates.includes(key)
    ? dates.filter((date) => date !== key)
    : [...dates, key].sort();
}

type RequestStartOptions = {
  kind: RequestKind;
  initialDate?: string;
  requestedType?: SelectionType;
  group: number;
  workQuota: WorkQuota;
  isSelectable?: (date: string, group: number) => boolean;
};

export function buildPlanningRequestStart({
  kind,
  initialDate,
  requestedType,
  group,
  workQuota,
  isSelectable = (date, selectedGroup) =>
    getDayInfo(fromKey(date), selectedGroup).selectable,
}: RequestStartOptions) {
  const initialType: SelectionType =
    requestedType ||
    (kind === "leave"
      ? "annual"
      : kind === "strike"
        ? "strike"
        : kind === "other"
          ? "other"
          : "recovery_day");
  const initialDateIsSelectable = Boolean(
    initialDate && isSelectable(initialDate, group),
  );
  const initialTimes =
    initialType === "recovery_training"
      ? trainingRecoveryTimes(workQuota)
      : {};
  const selections: Record<string, SelectedDay> =
    initialDate && initialDateIsSelectable
      ? { [initialDate]: { date: initialDate, type: initialType, ...initialTimes } }
      : {};
  return {
    initialType,
    sickRequest: kind === "leave" && initialType === "sick",
    selections,
    warningDate: initialDate && !initialDateIsSelectable ? initialDate : null,
  };
}

type PlanningInteractionActionsOptions = {
  planningUi: PlanningUiState;
  appShellUi: AppShellUiState;
  workTimeUi: WorkTimeUiState;
  entries: Entries;
  group: number;
  view: Date;
  setView: Dispatch<SetStateAction<Date>>;
  mode: ViewMode;
  workQuota: WorkQuota;
  calendarDeleteMode: boolean;
  setCalendarDeleteMode: Dispatch<SetStateAction<boolean>>;
  setCalendarDeleteDates: Dispatch<SetStateAction<string[]>>;
  ignoreNextDayClick: MutableRefObject<boolean>;
  cancelRequest: () => void;
  saveStrikeDateDirect: (date: string) => Promise<void>;
  notify: (message: string) => void;
};

export function usePlanningInteractionActions({
  planningUi,
  appShellUi,
  workTimeUi,
  entries,
  group,
  view,
  setView,
  mode,
  workQuota,
  calendarDeleteMode,
  setCalendarDeleteMode,
  setCalendarDeleteDates,
  ignoreNextDayClick,
  cancelRequest,
  saveStrikeDateDirect,
  notify,
}: PlanningInteractionActionsOptions) {
  const {
    dayDate,
    setDayDate,
    setNoteText,
    setNoteColor,
    setNoteGroupId,
    setNoteSelecting,
    setNoteDates,
    dayLeave,
    setDayLeave,
    dayPersonalLeave,
    setDayPersonalLeave,
    dayWish,
    setDayWish,
    dayLeaveType,
    setDayLeaveType,
    dayHalfMoment,
    setDayHolidayPay,
    setLeaveRangeEnabled,
    setLeaveRangeFrom,
    setLeaveRangeTo,
    setRangeOpen,
    rangePrefillDate,
    setRangePrefillDate,
    setRangeLeaveType,
    setRangeHalfMoment,
    setRangeSelecting,
    setSeparateDates,
    setSeparatePeople,
    setEditingPeriodId,
    setEditingLegacyPeriod,
    setRequestChooser,
    requestKind,
    setRequestKind,
    setSickRequest,
    activeType,
    setActiveType,
    selections,
    setSelections,
    timeDate,
    setTimeDate,
    timeStart,
    setTimeStart,
    timeEnd,
    setTimeEnd,
    warningDate,
    setWarningDate,
    recoveryRangeSelecting,
    setRecoveryRangeDates,
    noteSelecting,
    rangeSelecting,
  } = planningUi;
  const {
    setQuickNoteMode,
    setHomeSection,
    calendarSlide,
    setCalendarSlide,
    monthRefs,
    monthSwipeStart,
  } = appShellUi;
  const {
    recoveryDatePicking,
    setRecoveryDatePicking,
    setRecoveryDraft,
    setRecoveryCalendarVisible,
    setRecoveryDialogOpen,
  } = workTimeUi;

  function openDay(date: Date) {
    const key = dateKey(date);
    const entry = entries[key];
    setDayDate(key);
    setQuickNoteMode(false);
    // Le champ s'ouvre sur le texte existant tel quel : c'est le bouton
    // « Ajouter une note » qui ouvre une ligne en dessous, à la demande.
    setNoteText(entry?.noteText || "");
    setNoteColor(entry?.noteColor || "#D3943D");
    setNoteGroupId(entry?.noteGroupId || "");
    setDayLeave(false);
    setDayPersonalLeave(Boolean(entry?.leave));
    setDayWish(Boolean(entry?.wish));
    setDayHolidayPay(entry?.holidayPay || "");
    setDayLeaveType("annual");
    setLeaveRangeEnabled(false);
    setLeaveRangeFrom(key);
    setLeaveRangeTo(key);
    setEditingPeriodId(null);
  }
  function beginQuickNote() {
    const today = new Date();
    const date =
      today.getFullYear() === view.getFullYear() &&
      today.getMonth() === view.getMonth()
        ? localDate(today.getFullYear(), today.getMonth(), today.getDate())
        : localDate(view.getFullYear(), view.getMonth(), 1);
    const key = dateKey(date);
    setQuickNoteMode(true);
    setDayDate(key);
    setNoteText("");
    setNoteColor("#D3943D");
    setNoteGroupId("");
    setDayLeave(false);
    setDayPersonalLeave(false);
    setDayWish(false);
    setLeaveRangeEnabled(false);
    setLeaveRangeFrom(key);
    setLeaveRangeTo(key);
    setEditingPeriodId(null);
    setHomeSection("home");
    setRequestChooser(false);
  }

  function beginNoteDateSelection() {
    if (!dayDate) return;
    setNoteDates((current) => (current.includes(dayDate) ? current : [dayDate]));
    setDayDate(null);
    setNoteSelecting(true);
    setTimeout(
      () =>
        document
          .getElementById("note-selection-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  function cancelNoteSelection() {
    setNoteSelecting(false);
    setNoteDates([]);
  }
  function openRange(initialType: LeaveType = "annual", initialDate?: string) {
    if (requestKind) {
      notify(
        "Terminez ou annulez d’abord la demande professionnelle en cours.",
      );
      return;
    }
    setRangeLeaveType(initialType);
    setRangePrefillDate(initialDate || null);
    setEditingPeriodId(null);
    setEditingLegacyPeriod(null);
    setSeparateDates([]);
    setSeparatePeople([]);
    setRangeOpen(true);
  }
  function beginRangeSelection() {
    setSeparatePeople(["leave"]);
    setSeparateDates(rangePrefillDate ? [rangePrefillDate] : []);
    setRangePrefillDate(null);
    setRangeOpen(false);
    setRangeSelecting(true);
    setTimeout(
      () =>
        document
          .getElementById("range-selection-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  function cancelRangeSelection() {
    setRangeSelecting(false);
    setSeparateDates([]);
    setSeparatePeople([]);
    setEditingPeriodId(null);
    setEditingLegacyPeriod(null);
    setRangePrefillDate(null);
  }
  function beginMultipleDateSelectionFromDay() {
    if (!dayDate) return;
    const people: MultiDatePerson[] = dayLeave ? ["leave"] : [];
    if (dayPersonalLeave) people.push("personal");
    if (dayWish) people.push("wish");
    if (!people.length) return;
    setRangeLeaveType(dayLeaveType);
    setRangeHalfMoment(dayHalfMoment);
    setSeparatePeople(people);
    setSeparateDates([dayDate]);
    setDayDate(null);
    setRangeSelecting(true);
    setTimeout(
      () =>
        document
          .getElementById("range-selection-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  function beginRequest(
    kind: RequestKind,
    initialDate?: string,
    requestedType?: SelectionType,
  ) {
    setRequestKind(kind);
    const start = buildPlanningRequestStart({
      kind,
      initialDate,
      requestedType,
      group,
      workQuota,
    });
    setActiveType(start.initialType);
    setSickRequest(start.sickRequest);
    setSelections(start.selections);
    setWarningDate(start.warningDate);
    setHomeSection("home");
    setRequestChooser(false);
    window.setTimeout(
      () =>
        document
          .getElementById("request-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }

  function recordSelection(key: string) {
    if (
      activeType === "strike" &&
      getDayInfo(fromKey(key), group).kind !== "work"
    ) {
      notify("Une grève ne peut être posée que sur une journée prévue travaillée.");
      return;
    }
    if (activeType === "recovery_training") {
      const times = trainingRecoveryTimes(workQuota);
      setSelections((current) => ({
        ...current,
        [key]: { date: key, type: activeType, ...times },
      }));
      return;
    }
    if (
      activeType === "half" ||
      activeType === "recovery_half" ||
      activeType === "recovery_hours" ||
      activeType === "recovery_holiday"
    ) {
      const existing = selections[key];
      setTimeStart(existing?.start || "09:15");
      setTimeEnd(existing?.end || "13:00");
      setTimeDate(key);
      return;
    }
    setSelections((current) => ({
      ...current,
      [key]: { date: key, type: activeType },
    }));
  }
  function handleDay(date: Date) {
    if (ignoreNextDayClick.current) {
      ignoreNextDayClick.current = false;
      return;
    }
    const key = dateKey(date);
    if (recoveryRangeSelecting) {
      setRecoveryRangeDates((current) => toggleSortedDate(current, key));
      return;
    }
    if (recoveryDatePicking) {
      setRecoveryDraft((current) => ({ ...current, date: key }));
      setRecoveryDatePicking(false);
      setRecoveryCalendarVisible(false);
      setRecoveryDialogOpen(true);
      return;
    }
    if (calendarDeleteMode) {
      setCalendarDeleteDates((current) => toggleSortedDate(current, key));
      return;
    }
    if (rangeSelecting) {
      setSeparateDates((current) => toggleSortedDate(current, key));
      return;
    }
    if (noteSelecting) {
      setNoteDates((current) => toggleSortedDate(current, key));
      return;
    }
    if (!requestKind) {
      openDay(date);
      return;
    }
    if (requestKind === "strike") {
      void saveStrikeDateDirect(key);
      return;
    }
    if (selections[key]) {
      setSelections((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    const info = getDayInfo(date, group);
    if (!info.selectable) {
      setWarningDate(key);
      return;
    }
    recordSelection(key);
  }
  function confirmWarning() {
    if (!warningDate) return;
    const key = warningDate;
    setWarningDate(null);
    recordSelection(key);
  }
  function commitTime() {
    if (!timeDate) return;
    const start =
      (document.getElementById("request-time-start") as HTMLInputElement | null)
        ?.value || timeStart;
    const end =
      (document.getElementById("request-time-end") as HTMLInputElement | null)
        ?.value || timeEnd;
    if (!start || !end || end <= start) {
      notify("L’heure de fin doit être postérieure à l’heure de début.");
      return;
    }
    setSelections((current) => ({
      ...current,
      [timeDate]: { date: timeDate, type: activeType, start, end },
    }));
    setTimeDate(null);
  }
  function goToday() {
    const today = new Date();
    setView(localDate(today.getFullYear(), today.getMonth(), 1));
    if (mode === "year")
      setTimeout(
        () =>
          monthRefs.current[today.getMonth()]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        80,
      );
  }
  function changePeriod(delta: number) {
    if (mode === "month") {
      if (calendarSlide) return;
      const outgoing = delta > 0 ? "out-left" : "out-right";
      const incoming = delta > 0 ? "in-right" : "in-left";
      setCalendarSlide(outgoing);
      window.setTimeout(() => {
        setView((current) =>
          localDate(current.getFullYear(), current.getMonth() + delta, 1),
        );
        setCalendarSlide(incoming);
        window.setTimeout(() => setCalendarSlide(""), 230);
      }, 125);
      return;
    }
    setView((current) =>
      mode === "year"
        ? localDate(current.getFullYear() + delta, current.getMonth(), 1)
        : localDate(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }
  function startMonthSwipe(event: TouchEvent<HTMLElement>) {
    if (mode !== "month") return;
    const touch = event.changedTouches[0];
    monthSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function endMonthSwipe(event: TouchEvent<HTMLElement>) {
    if (!monthSwipeStart.current || mode !== "month") return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - monthSwipeStart.current.x;
    const deltaY = touch.clientY - monthSwipeStart.current.y;
    monthSwipeStart.current = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25)
      return;
    ignoreNextDayClick.current = true;
    window.setTimeout(() => {
      ignoreNextDayClick.current = false;
    }, 450);
    changePeriod(deltaX < 0 ? 1 : -1);
  }
  /** Change le mois affiché dans « Infos primes », par glissement ou par
   *  flèche — indépendant du mode (mois ou année), puisque ce panneau reste
   *  consultable dans les deux. */
  function changeAllowancesMonth(delta: 1 | -1) {
    setView((current) =>
      localDate(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }

  function startCalendarCleanup() {
    cancelRequest();
    cancelRangeSelection();
    cancelNoteSelection();
    setCalendarDeleteDates([]);
    setCalendarDeleteMode(true);
  }

  function cancelCalendarCleanup() {
    setCalendarDeleteMode(false);
    setCalendarDeleteDates([]);
  }

  return {
    openDay,
    beginQuickNote,
    beginNoteDateSelection,
    cancelNoteSelection,
    openRange,
    beginRangeSelection,
    cancelRangeSelection,
    beginMultipleDateSelectionFromDay,
    beginRequest,
    handleDay,
    confirmWarning,
    commitTime,
    goToday,
    changePeriod,
    startMonthSwipe,
    endMonthSwipe,
    changeAllowancesMonth,
    startCalendarCleanup,
    cancelCalendarCleanup,
  };
}
