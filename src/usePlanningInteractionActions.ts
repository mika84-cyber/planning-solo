import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  TouchEvent,
} from "react";
import type { Entries, RequestKind, SelectedDay, WishMoment } from "./appModel";
import type { WishChoice } from "./PlanningRequestPanels";
import { DEFAULT_WORK_SCHEDULE, splitOvertimeRange, workScheduleHalfTimes, type WorkQuota, type WorkSchedule } from "./overtime";
import { durationLeaveDay, usualHalfHours } from "./useRequestTypeSelection";
import {
  dateKey,
  fromKey,
  getDayInfo,
  halfBalanceOf,
  halfMomentFromStart,
  localDate,
  type LeaveType,
  type MultiDatePerson,
  type SelectionType,
  type LeaveMoment,
  emptyLeaveHours,
  type LeaveHours,
} from "./planningLogic";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { usePlanningUiState } from "./usePlanningUiState";
import type { useWorkTimeUiState } from "./useWorkTimeUiState";

/** Fait défiler jusqu'à l'élément dès qu'il est affiché : le panneau de la
 *  demande se charge à la demande et n'existe pas encore au premier usage. */
function scrollWhenShown(find: () => Element | null | undefined, frames = 90) {
  if (typeof document === "undefined") return;
  const element = find();
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (frames > 0) window.requestAnimationFrame(() => scrollWhenShown(find, frames - 1));
}

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
  const selections: Record<string, SelectedDay> =
    initialDate && initialDateIsSelectable
      ? { [initialDate]: { date: initialDate, type: initialType } }
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
  workQuota: WorkQuota;
  /** Absent tant que la personne n’a pas saisi ses horaires : les champs
   *  d’heure restent alors vides. */
  workSchedule?: WorkSchedule;
  calendarDeleteMode: boolean;
  setCalendarDeleteMode: Dispatch<SetStateAction<boolean>>;
  setCalendarDeleteDates: Dispatch<SetStateAction<string[]>>;
  ignoreNextDayClick: MutableRefObject<boolean>;
  cancelRequest: () => void;
  saveStrikeDateDirect: (date: string) => Promise<void>;
  notify: (message: string) => void;
  isExchangeDate?: (date: string) => boolean;
  /** Congés annuels : la date en journée entière ou en demi-journée, selon
   *  la durée et les heures choisies dans le panneau. */
  leaveDay?: (date: string, type: SelectionType) => SelectedDay;
};

export function usePlanningInteractionActions({
  planningUi,
  appShellUi,
  workTimeUi,
  entries,
  group,
  view,
  setView,
  workQuota,
  workSchedule,
  calendarDeleteMode,
  setCalendarDeleteMode,
  setCalendarDeleteDates,
  ignoreNextDayClick,
  cancelRequest,
  saveStrikeDateDirect,
  notify,
  isExchangeDate = () => false,
  leaveDay = (date, type) => ({ date, type }),
}: PlanningInteractionActionsOptions) {
  const {
    dayDate,
    setDayDate,
    setDayPanelTab,
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
    dayHalfBalance,
    setDayHalfBalance,
    setDayHolidayPay,
    setLeaveRangeEnabled,
    setLeaveRangeFrom,
    setLeaveRangeTo,
    setRangeOpen,
    rangePrefillDate,
    setRangePrefillDate,
    setRangeLeaveType,
    setRangeHalfMoment,
    setRangeHalfBalance,
    setRangeSelecting,
    separateDates,
    setSeparateDates,
    separatePeople,
    wishMoment,
    setWishMoment,
    separateWishMoments,
    setSeparateWishMoments,
    lastWishDate,
    setLastWishDate,
    setSeparatePeople,
    setEditingPeriodId,
    setEditingLegacyPeriod,
    setRequestChooser,
    setRequestSeedDate,
    setDirectDurationSave,
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
    timeHalfBalance,
    setTimeHalfBalance,
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
    setDayPanelTab("leave");
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
    // Une demi-journée est prise sur les congés annuels.
    setDayHalfBalance("annual");
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
    setDayPanelTab("notes");
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
    setRangeHalfBalance("annual");
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
  /** Plusieurs congés souhaités d'un coup : les dates se touchent dans le
   *  calendrier puis s'enregistrent ensemble, sans formulaire ni solde. */
  function beginWishSelection(initialDate?: string) {
    if (requestKind) {
      notify("Terminez ou annulez d’abord la demande en cours.");
      return;
    }
    setRequestChooser(false);
    setDayDate(null);
    setEditingPeriodId(null);
    setEditingLegacyPeriod(null);
    setSeparatePeople(["wish"]);
    // Depuis une case du planning, la date touchée est déjà choisie, en
    // journée entière tant qu'un autre moment n'est pas choisi.
    setSeparateDates(initialDate ? [initialDate] : []);
    setWishMoment("");
    setSeparateWishMoments(initialDate ? { [initialDate]: "" } : {});
    setLastWishDate(initialDate || null);
    setHomeSection("home");
    setRangeSelecting(true);
    setTimeout(
      () =>
        document
          .getElementById("range-selection-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  /** Les souhaits à venir deviennent une demande de congé, en CA par défaut :
   *  chaque date peut ensuite changer de nature avant l'enregistrement. */
  /** La sélection d'une date transformée : une journée de la nature
   *  choisie, ou une demi-journée aux horaires habituels du matin ou de
   *  l'après-midi (solde proposé comme ailleurs : CA, puis RTT, puis FRA). */
  function wishConversionSelection(date: string, choice: WishChoice, wishMoment?: WishMoment): SelectedDay {
    const [type, choiceMoment] = choice.split(":") as [SelectionType, WishMoment | undefined];
    // Un souhait du matin ou de l'après-midi devient une demi-journée de
    // congés annuels, au même moment ; en RTT ou en fractionnement, qui ne se
    // posent pas en demi-journée, une journée entière.
    if (wishMoment && !choiceMoment && type === "annual") {
      const times = workScheduleHalfTimes(workSchedule ?? DEFAULT_WORK_SCHEDULE, wishMoment);
      return { date, type: "half", ...halfTiming(times.start, times.end) };
    }
    const moment = choiceMoment;
    if (!moment) return { date, type };
    const times = workScheduleHalfTimes(workSchedule ?? DEFAULT_WORK_SCHEDULE, moment);
    return { date, type: "half", ...halfTiming(times.start, times.end) };
  }
  function beginWishConversion(
    dates: string[],
    choices: Record<string, WishChoice> = {},
    moments: Record<string, WishMoment | undefined> = {},
  ) {
    setDayDate(null);
    beginRequest("leave", undefined, "annual");
    const convertible = dates.filter(
      (date) => getDayInfo(fromKey(date), group).selectable && !isExchangeDate(date),
    );
    setSelections(
      Object.fromEntries(convertible.map((date) => [date, wishConversionSelection(date, choices[date] || "annual", moments[date])])),
    );
  }
  /** Journée, matin ou après-midi : pour les dates touchées ensuite, et pour
   *  la date déjà choisie tant qu'elle est seule (la case d'où l'on vient).
   *  Avec plusieurs dates, rien ne change en arrière : on peut mélanger. */
  function chooseWishMoment(moment: WishMoment | "") {
    setWishMoment(moment);
    if (lastWishDate && separateDates.length === 1 && separateDates[0] === lastWishDate)
      setSeparateWishMoments((current) => ({ ...current, [lastWishDate]: moment }));
  }
  function cancelRangeSelection() {
    setRangeSelecting(false);
    setSeparateDates([]);
    setSeparateWishMoments({});
    setWishMoment("");
    setLastWishDate(null);
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
    setRangeHalfBalance(dayHalfBalance);
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
  /** `landing` : où la demande s'ouvre — sur son panneau (type, durée,
   *  boutons), ou directement sur les jours du planning, pour qui vient de
   *  choisir son congé depuis « Que cherchez-vous ? ». `moment` et `hours` :
   *  la durée d'un CA choisie avec lui (le matin, l'après-midi) et ses heures,
   *  saisies dans la fenêtre, sinon les habituelles. */
  function beginRequest(
    kind: RequestKind,
    initialDate?: string,
    requestedType?: SelectionType,
    landing: "panel" | "calendar" = "panel",
    moment: LeaveMoment = "full",
    hours?: LeaveHours,
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
    const halfHours = moment === "full" ? { start: "", end: "" } : hours ?? usualHalfHours(workSchedule, moment);
    planningUi.setLeaveMoment(moment);
    planningUi.setLeaveHours({ ...emptyLeaveHours(), ...(moment === "full" ? {} : { [moment]: halfHours }) });
    setSickRequest(start.sickRequest);
    const seedDate = Object.keys(start.selections)[0] || null;
    // Divers : la date touchée ouvre d'abord le choix journée entière, matin
    // ou après-midi, comme dans la demande. Un jour exceptionnel se pose
    // toujours en journée entière.
    const askDuration = Boolean(seedDate) && start.initialType === "other";
    const nextSelections = (kind === "recovery" || askDuration) && seedDate
      ? {}
      : Object.fromEntries(Object.entries(start.selections).map(([key, item]) => [key, durationLeaveDay(key, item.type, moment, halfHours)]));
    setDirectDurationSave(askDuration);
    if (askDuration && seedDate) {
      setTimeStart("");
      setTimeEnd("");
      setTimeDate(seedDate);
    }
    setSelections(nextSelections);
    setRequestSeedDate(seedDate);
    setWarningDate(start.warningDate);
    setHomeSection("home");
    setRequestChooser(false);
    scrollWhenShown(() => {
      // Le panneau de la demande d'abord : les jours se placent sous lui.
      const panel = document.getElementById("request-panel");
      if (!panel || landing === "panel") return panel;
      const leavePanel = document.querySelector(".planning-calendar-section .planning-leave-panel");
      return leavePanel?.nextElementSibling ?? document.querySelector(".planning-calendar-section .month-card");
    });
  }

  function recordSelection(key: string) {
    setRequestSeedDate(null);
    if (
      activeType === "strike" &&
      getDayInfo(fromKey(key), group).kind !== "work"
    ) {
      notify("Une grève ne peut être posée que sur une journée prévue travaillée.");
      return;
    }
    if (activeType.startsWith("recovery_")) {
      setTimeStart(workSchedule?.start ?? "");
      setTimeEnd(workSchedule?.end ?? "");
      setTimeDate(key);
      return;
    }
    if (activeType === "other") {
      setTimeStart("");
      setTimeEnd("");
      setTimeDate(key);
      return;
    }
    if (
      activeType === "half"
    ) {
      const existing = selections[key];
      // Une demi-journée se choisit par « matin » ou « après-midi », sans
      // champ d'heure : sans horaires enregistrés, on prend ceux que la
      // fenêtre affiche déjà, sinon la validation échouerait sans raison visible.
      const usualTimes = workScheduleHalfTimes(workSchedule ?? DEFAULT_WORK_SCHEDULE, "morning");
      setTimeStart(existing?.start || usualTimes.start);
      setTimeEnd(existing?.end || usualTimes.end);
      setTimeHalfBalance(existing ? halfBalanceOf(existing) : "annual");
      setTimeDate(key);
      return;
    }
    setSelections((current) => ({
      ...current,
      [key]: leaveDay(key, activeType),
    }));
  }
  function handleDay(date: Date) {
    if (ignoreNextDayClick.current) {
      ignoreNextDayClick.current = false;
      return;
    }
    const key = dateKey(date);
    if (
      isExchangeDate(key) &&
      (recoveryRangeSelecting || recoveryDatePicking || rangeSelecting || requestKind)
    ) {
      notify("Cette journée appartient à un échange. Modifiez ou supprimez d’abord l’échange complet.");
      return;
    }
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
      const wishOnly = separatePeople.length === 1 && separatePeople[0] === "wish";
      const chosen = separateDates.includes(key);
      // Une date déjà choisie avec un autre moment prend le moment actif ;
      // touchée avec le même moment, elle est retirée.
      if (wishOnly && chosen && (separateWishMoments[key] || "") !== wishMoment) {
        setSeparateWishMoments((current) => ({ ...current, [key]: wishMoment }));
        setLastWishDate(key);
        return;
      }
      if (wishOnly) setLastWishDate(chosen ? null : key);
      if (wishOnly)
        setSeparateWishMoments((current) => {
          const next = { ...current };
          if (chosen) delete next[key];
          else next[key] = wishMoment;
          return next;
        });
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
    // Une date déjà choisie avec un autre type prend le type actif : c'est
    // ainsi qu'on change la nature d'un souhait transformé, date par date.
    if (selections[key] && selections[key].type !== activeType) {
      recordSelection(key);
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
  /** Horaires d'une demi-journée : ceux de l'utilisateur, ou, s'il ne les a
   *  pas renseignés, le seul moment de la journée. */
  function halfTiming(start: string, end: string) {
    return workSchedule ? { start, end } : { halfMoment: halfMomentFromStart(start) };
  }
  function commitTime() {
    if (!timeDate) return;
    const start = timeStart;
    const end = timeEnd;
    if (activeType === "other") {
      const date = timeDate;
      setSelections((current) => ({
        ...current,
        [date]: start && end
          ? { date, type: "half", ...halfTiming(start, end), halfBalance: activeType }
          : { date, type: activeType },
      }));
      setTimeDate(null);
      return;
    }
    if (!start || !end || !splitOvertimeRange(start, end)) {
      notify("Choisissez une heure de début et une heure de fin différentes.");
      return;
    }
    setSelections((current) => ({
      ...current,
      [timeDate]: {
        date: timeDate,
        type: activeType,
        ...(activeType === "half" ? halfTiming(start, end) : { start, end }),
        ...(activeType === "half" && timeHalfBalance !== "annual" ? { halfBalance: timeHalfBalance } : {}),
      },
    }));
    setTimeDate(null);
  }
  function goToday() {
    const today = new Date();
    setView(localDate(today.getFullYear(), today.getMonth(), 1));
  }
  function changePeriod(delta: number) {
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
  }
  function startMonthSwipe(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    monthSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function endMonthSwipe(event: TouchEvent<HTMLElement>) {
    if (!monthSwipeStart.current) return;
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
  function startCalendarCleanup() {
    cancelRequest();
    cancelRangeSelection();
    cancelNoteSelection();
    setCalendarDeleteDates([]);
    setCalendarDeleteMode(true);
    if (window.matchMedia("(min-width: 721px)").matches)
      window.setTimeout(() => {
        const panel = document.getElementById("calendar-delete-panel");
        panel?.focus({ preventScroll: true });
      }, 80);
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
    beginWishSelection,
    beginWishConversion,
    chooseWishMoment,
    beginRequest,
    handleDay,
    confirmWarning,
    commitTime,
    goToday,
    changePeriod,
    startMonthSwipe,
    endMonthSwipe,
    startCalendarCleanup,
    cancelCalendarCleanup,
  };
}
