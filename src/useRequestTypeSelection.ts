import type { FormProfile, SelectedDay } from "./appModel";
import { DEFAULT_WORK_SCHEDULE, usableWorkSchedule, workScheduleHalfTimes } from "./overtime";
import { DURATION_LEAVE_TYPES, halfBalanceOf, type LeaveHours, type LeaveMoment, type SelectionType } from "./planningLogic";
import type { usePlanningUiState } from "./usePlanningUiState";

type RequestTypeSelectionOptions = {
  planningUi: Pick<
    ReturnType<typeof usePlanningUiState>,
    "activeType" | "setActiveType" | "leaveMoment" | "setLeaveMoment" | "leaveHours" | "setLeaveHours" | "requestSeedDate" | "setSelections" | "setTimeStart" | "setTimeEnd" | "setTimeDate" | "setTimeHalfBalance"
  >;
  formProfile: FormProfile | null;
};

/** Des heures utilisables : les deux, la fin après le début. */
export function validLeaveHours(hours: LeaveHours) {
  return Boolean(hours.start && hours.end && hours.start < hours.end);
}

/** Une date de congé annuel : journée entière, ou demi-journée aux heures
 *  choisies (le moment seul tant qu'elles ne sont pas saisies). RTT et
 *  fractionnement se posent en journée entière. */
export function durationLeaveDay(date: string, type: SelectionType, moment: LeaveMoment, hours: LeaveHours): SelectedDay {
  if (!(DURATION_LEAVE_TYPES as readonly string[]).includes(type) || moment === "full") return { date, type };
  return validLeaveHours(hours)
    ? { date, type: "half", start: hours.start, end: hours.end }
    : { date, type: "half", halfMoment: moment };
}

/** Le type choisi au départ d'une demande depuis une case : il remplit la
 *  date de départ avec les horaires habituels. Les congés annuels se posent
 *  aussi le matin ou l'après-midi, aux heures choisies. */
export function useRequestTypeSelection({ planningUi, formProfile }: RequestTypeSelectionOptions) {
  const { activeType, setActiveType, leaveMoment, setLeaveMoment, leaveHours, setLeaveHours, requestSeedDate, setSelections, setTimeStart, setTimeEnd, setTimeDate, setTimeHalfBalance } = planningUi;
  const isDurationLeave = (type: SelectionType) => (DURATION_LEAVE_TYPES as readonly string[]).includes(type);
  /** Les heures habituelles d'une moitié de journée ; sans horaires
   *  enregistrés, rien : mieux vaut une saisie à faire qu'une heure inventée. */
  function usualHours(moment: LeaveMoment): LeaveHours {
    const schedule = usableWorkSchedule(formProfile?.workSchedule);
    if (moment === "full" || !schedule) return { start: "", end: "" };
    return workScheduleHalfTimes(schedule, moment);
  }
  const leaveDay = (date: string, type: SelectionType, moment: LeaveMoment = leaveMoment, hours: LeaveHours = leaveHours) =>
    durationLeaveDay(date, type, moment, hours);
  /** Les dates déjà choisies de ce congé suivent la durée et les heures. */
  function applyToSelections(moment: LeaveMoment, hours: LeaveHours) {
    if (!isDurationLeave(activeType)) return;
    setSelections((current) => Object.fromEntries(Object.entries(current).map(([key, item]) => {
      const same = item.type === activeType || (item.type === "half" && halfBalanceOf(item) === activeType);
      return [key, same ? leaveDay(key, activeType, moment, hours) : item];
    })));
  }
  /** Changer la durée reprend les heures habituelles de ce moment. */
  function selectLeaveMoment(moment: LeaveMoment) {
    const hours = usualHours(moment);
    setLeaveMoment(moment);
    setLeaveHours(hours);
    applyToSelections(moment, hours);
  }
  /** Les heures posées le matin ou l'après-midi ; les dates déjà choisies
   *  les prennent dès qu'elles se suivent. */
  function selectLeaveHours(hours: LeaveHours) {
    setLeaveHours(hours);
    if (validLeaveHours(hours)) applyToSelections(leaveMoment, hours);
  }
  function selectRecoveryType(type: SelectionType) {
    setActiveType(type);
    if (!requestSeedDate) return;
    // Sans horaires enregistrés, les champs restent vides : mieux vaut une
    // saisie à faire qu'une heure inventée qu'on oublierait de corriger.
    const schedule = usableWorkSchedule(formProfile?.workSchedule);
    const start = schedule?.start ?? "";
    const end = schedule?.end ?? "";
    setSelections((current) => {
      return {
        ...current,
        [requestSeedDate]: { date: requestSeedDate, type, start, end },
      };
    });
    setTimeStart(start);
    setTimeEnd(end);
    setTimeDate(requestSeedDate);
  }
  function selectLeaveType(type: SelectionType) {
    setActiveType(type);
    if (!requestSeedDate) return;
    // Mêmes horaires que ceux de la fenêtre « Matin ou après-midi ? » : sans
    // horaires enregistrés, la journée type, pour que « Le matin » soit vrai.
    const halfTimes = workScheduleHalfTimes(
      usableWorkSchedule(formProfile?.workSchedule) ?? DEFAULT_WORK_SCHEDULE,
      "morning",
    );
    const hasSchedule = Boolean(usableWorkSchedule(formProfile?.workSchedule));
    setSelections((current) => {
      if (!current[requestSeedDate]) return current;
      return {
        ...current,
        [requestSeedDate]: type === "half"
          ? hasSchedule
            ? { date: requestSeedDate, type, start: halfTimes.start, end: halfTimes.end }
            : { date: requestSeedDate, type, halfMoment: "morning" }
          : leaveDay(requestSeedDate, type),
      };
    });
    if (type !== "half") return;
    setTimeStart(halfTimes.start);
    setTimeEnd(halfTimes.end);
    // Une demi-journée est prise sur les congés annuels.
    setTimeHalfBalance("annual");
    setTimeDate(requestSeedDate);
  }

  return { selectRecoveryType, selectLeaveType, selectLeaveMoment, selectLeaveHours, leaveDay };
}
