import type { FormProfile, LeavePeriod, SelectedDay } from "./appModel";
import { computeLeaveStats } from "./leaveStats";
import { DEFAULT_WORK_SCHEDULE, usableWorkSchedule, workScheduleHalfTimes } from "./overtime";
import { automaticHalfBalance, type SelectionType } from "./planningLogic";
import { requestLeaveBalanceUsage } from "./RequestValidationSummary";
import type { usePlanningUiState } from "./usePlanningUiState";

type RequestTypeSelectionOptions = {
  planningUi: Pick<
    ReturnType<typeof usePlanningUiState>,
    "setActiveType" | "requestSeedDate" | "setSelections" | "setTimeStart" | "setTimeEnd" | "setTimeDate" | "setTimeHalfBalance"
  >;
  formProfile: FormProfile | null;
  now: Date;
  periods: LeavePeriod[];
  group: number;
  /** Les dates déjà choisies dans la demande en cours. */
  selectedList: SelectedDay[];
};

/** Le type choisi au départ d'une demande depuis une case : il remplit la
 *  date de départ avec les horaires habituels, et propose le solde d'une
 *  demi-journée. */
export function useRequestTypeSelection({ planningUi, formProfile, now, periods, group, selectedList }: RequestTypeSelectionOptions) {
  const { setActiveType, requestSeedDate, setSelections, setTimeStart, setTimeEnd, setTimeDate, setTimeHalfBalance } = planningUi;
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
  /** Solde d'une nouvelle demi-journée : CA d'abord, puis RTT, puis
   *  fractionnement, dans l'année de la date et en déduisant ce que la demande
   *  en cours prend déjà (hors la date elle-même). */
  function proposeHalfBalance(key: string, pending: SelectedDay[] = []) {
    const year = Number(key.slice(0, 4));
    const stats = computeLeaveStats({
      year,
      today: now,
      periods,
      group,
      manualAdjustments: formProfile?.manualAdjustments,
    });
    return automaticHalfBalance(
      Object.fromEntries(stats.balances.map((balance) => [balance.type, balance.remaining])),
      requestLeaveBalanceUsage(
        pending.filter((item) => item.date !== key && item.date.startsWith(`${year}-`)),
        group,
      ),
    );
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
          : { date: requestSeedDate, type },
      };
    });
    if (type !== "half") return;
    setTimeStart(halfTimes.start);
    setTimeEnd(halfTimes.end);
    setTimeHalfBalance(proposeHalfBalance(requestSeedDate, selectedList));
    setTimeDate(requestSeedDate);
  }

  return { selectRecoveryType, proposeHalfBalance, selectLeaveType };
}
