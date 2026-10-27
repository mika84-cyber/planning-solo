import type { FormProfile, SelectedDay } from "./appModel";
import { DEFAULT_WORK_SCHEDULE, usableWorkSchedule, workScheduleHalfTimes, type WorkSchedule } from "./overtime";
import {
  DURATION_LEAVE_TYPES,
  halfMomentFromStart,
  type HalfMoment,
  type LeaveHours,
  type LeaveHoursByMoment,
  type LeaveMoment,
  type SelectionType,
} from "./planningLogic";
import type { usePlanningUiState } from "./usePlanningUiState";

type RequestTypeSelectionOptions = {
  planningUi: Pick<
    ReturnType<typeof usePlanningUiState>,
    "setActiveType" | "leaveMoment" | "setLeaveMoment" | "leaveHours" | "setLeaveHours" | "requestSeedDate" | "setSelections" | "setTimeStart" | "setTimeEnd" | "setTimeDate" | "setTimeHalfBalance"
  >;
  formProfile: FormProfile | null;
};

const NO_HOURS: LeaveHours = { start: "", end: "" };

/** Des heures utilisables : les deux, la fin après le début. */
export function validLeaveHours(hours: LeaveHours) {
  return Boolean(hours.start && hours.end && hours.start < hours.end);
}

/** Les heures habituelles d'une moitié de journée ; sans horaires
 *  enregistrés, rien : mieux vaut une saisie à faire qu'une heure inventée. */
export function usualHalfHours(workSchedule: WorkSchedule | undefined, moment: HalfMoment): LeaveHours {
  const schedule = usableWorkSchedule(workSchedule);
  return schedule ? workScheduleHalfTimes(schedule, moment) : NO_HOURS;
}

/** Les heures posées pour cette durée : aucune en journée entière. */
export function leaveHoursFor(hours: LeaveHoursByMoment, moment: LeaveMoment): LeaveHours {
  return moment === "full" ? NO_HOURS : hours[moment];
}

/** Une date de congé annuel : journée entière, ou demi-journée aux heures
 *  choisies (le moment seul tant qu'elles ne sont pas saisies). RTT et
 *  fractionnement se posent en journée entière. */
/** La date de départ d'une demande suit le type choisi tant qu'elle est la
 *  seule date : dès qu'une autre est touchée, le type ne vaut plus que pour
 *  les dates touchées ensuite, comme la durée — un RTT, un CA et un
 *  fractionnement se posent dans la même demande. */
export function seedAlone(selections: Record<string, unknown>, seedDate: string) {
  return Object.keys(selections).every((key) => key === seedDate);
}

export function durationLeaveDay(date: string, type: SelectionType, moment: LeaveMoment, hours: LeaveHours): SelectedDay {
  if (!(DURATION_LEAVE_TYPES as readonly string[]).includes(type) || moment === "full") return { date, type };
  return validLeaveHours(hours)
    ? { date, type: "half", start: hours.start, end: hours.end }
    : { date, type: "half", halfMoment: moment };
}

/** La moitié de journée d'une date choisie : dite, ou déduite de son heure de début. */
function momentOf(item: SelectedDay): HalfMoment | null {
  if (item.type !== "half") return null;
  return item.halfMoment ?? (item.start ? halfMomentFromStart(item.start) : null);
}

/** Le type choisi au départ d'une demande depuis une case : il remplit la
 *  date de départ avec les horaires habituels. Les congés annuels se posent
 *  aussi le matin ou l'après-midi, aux heures choisies : la durée vaut pour
 *  les dates touchées ensuite, et une journée entière et une demi-journée se
 *  posent dans la même demande. */
export function useRequestTypeSelection({ planningUi, formProfile }: RequestTypeSelectionOptions) {
  const { setActiveType, leaveMoment, setLeaveMoment, leaveHours, setLeaveHours, requestSeedDate, setSelections, setTimeStart, setTimeEnd, setTimeDate, setTimeHalfBalance } = planningUi;
  const leaveDay = (date: string, type: SelectionType, moment: LeaveMoment = leaveMoment, hours: LeaveHours = leaveHoursFor(leaveHours, moment)) =>
    durationLeaveDay(date, type, moment, hours);
  /** Changer la durée ne vaut que pour les dates touchées ensuite ; le matin
   *  et l'après-midi gardent chacun leurs heures, les habituelles tant
   *  qu'elles ne sont pas saisies. */
  function selectLeaveMoment(moment: LeaveMoment) {
    setLeaveMoment(moment);
    if (moment === "full") return;
    const known = leaveHours[moment];
    if (!known.start && !known.end) setLeaveHours({ ...leaveHours, [moment]: usualHalfHours(formProfile?.workSchedule, moment) });
  }
  /** Les heures posées le matin ou l'après-midi ; les demi-journées déjà
   *  choisies de ce moment les prennent dès qu'elles se suivent. */
  function selectLeaveHours(hours: LeaveHours) {
    if (leaveMoment === "full") return;
    setLeaveHours({ ...leaveHours, [leaveMoment]: hours });
    if (!validLeaveHours(hours)) return;
    setSelections((current) => Object.fromEntries(Object.entries(current).map(([key, item]) =>
      [key, momentOf(item) === leaveMoment ? { ...item, halfMoment: undefined, start: hours.start, end: hours.end } : item])));
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
      if (!current[requestSeedDate] || !seedAlone(current, requestSeedDate)) return current;
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
