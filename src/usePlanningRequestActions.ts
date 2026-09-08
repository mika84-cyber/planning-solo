import type { Dispatch, SetStateAction } from "react";
import {
  calendarErrorMessage,
  postCalendarBatch,
  postCalendarIdempotent,
  postCalendarPeriodsVerified,
} from "./calendarApi";
import { prepareAbsenceReplacement } from "./absenceReplacement";
import { createClientId } from "./clientId";
import { normalizeLeaveRequest } from "./leaveRequest";
import { type BalanceType, type FormProfile, type LeavePeriod, type SelectedDay } from "./appModel";
import { cetBalance } from "./cet";
import {
  minutesLabel,
  recoveryRequestMinutes,
  type RecoveryUse,
  type RecoveryRequestType,
  type WorkQuota,
} from "./overtime";
import {
  groupConsecutive,
  fromKey,
  leaveTypeLabel,
  longDate,
  type HalfMoment,
  type LeaveType,
} from "./planningLogic";
import type { usePlanningUiState } from "./usePlanningUiState";
import { leaveBalanceShortageMessage, requestLeaveBalanceUsage, zeroLeaveBalanceType } from "./RequestValidationSummary";

type PlanningUiState = ReturnType<typeof usePlanningUiState>;

export function groupPlanningRequestSelections(selectedList: SelectedDay[]) {
  const groups = {
      annual: groupConsecutive(
        selectedList
          .filter((item) => item.type === "annual")
          .map((item) => item.date),
      ),
      rtt: groupConsecutive(
        selectedList
          .filter((item) => item.type === "rtt")
          .map((item) => item.date),
      ),
      fraction: groupConsecutive(
        selectedList
          .filter((item) => item.type === "fraction")
          .map((item) => item.date),
      ),
      childcare: groupConsecutive(
        selectedList
          .filter((item) => item.type === "childcare")
          .map((item) => item.date),
      ),
      exceptional: groupConsecutive(
        selectedList
          .filter((item) => item.type === "exceptional")
          .map((item) => item.date),
      ),
      cet: groupConsecutive(
        selectedList
          .filter((item) => item.type === "cet")
          .map((item) => item.date),
      ),
      recoveryDay: groupConsecutive(
        selectedList
          .filter((item) => item.type === "recovery_day")
          .map((item) => item.date),
      ),
      // La récupération d'un jour férié conserve sa rubrique du formulaire ;
      // elle sera débitée comme une journée entière du solde d'heures lors de
      // l'enregistrement final.
      recoveryHoliday: groupConsecutive(
        selectedList
          .filter((item) => item.type === "recovery_holiday")
          .map((item) => item.date),
      ),
      recoveryTraining: selectedList.filter(
        (item) => item.type === "recovery_training",
      ),
    };
  return groups;
}


type PlanningRequestActionsOptions = {
  planningUi: PlanningUiState;
  selectedList: SelectedDay[];
  formProfile: FormProfile | null;
  cetPlannedLeaveDays: number;
  group: number;
  demoMode: boolean;
  userEmail: string;
  workQuota: WorkQuota;
  recoveryBalanceRemaining: number;
  leaveRemaining: Partial<Record<BalanceType, number>>;
  periods: LeavePeriod[];
  recoveryUses: RecoveryUse[];
  setPeriods: Dispatch<SetStateAction<LeavePeriod[]>>;
  setRecoveryUses: Dispatch<SetStateAction<RecoveryUse[]>>;
  reloadCalendar: () => Promise<void>;
  cancelRequest: () => void;
  notify: (message: string) => void;
  showSuccess: (message: string) => void;
  handoffKey: string;
};

export function usePlanningRequestActions({
  planningUi,
  selectedList,
  formProfile,
  cetPlannedLeaveDays,
  group,
  demoMode,
  userEmail,
  workQuota,
  recoveryBalanceRemaining,
  leaveRemaining,
  periods,
  recoveryUses,
  setPeriods,
  setRecoveryUses,
  reloadCalendar,
  cancelRequest,
  notify,
  showSuccess: confirm,
  handoffKey: HANDOFF_KEY,
}: PlanningRequestActionsOptions) {
  const { requestKind, sickRequest, setSavingRequest } = planningUi;

  /** Ouvre le formulaire vierge, sans rien pré-remplir depuis le planning. */
  function openBlankForm() {
    try {
      localStorage.removeItem(HANDOFF_KEY);
    } catch {}
    window.location.href = "/formulaire/index.html";
  }
  async function validateAndOpenForm(destination: "form" | "planning" = "form") {
    if (!selectedList.length) {
      notify(
        "Sélectionnez au moins une date avant d’intégrer la demande au formulaire.",
      );
      return;
    }
    if (requestKind === "leave" && !sickRequest) {
      const conflict = selectedList.find((item) => periods.some((period) =>
        item.date >= period.from && item.date <= period.to,
      ));
      if (conflict) {
        notify(`${longDate(fromKey(conflict.date))} comporte déjà une absence. Modifiez ou retirez-la avant de continuer.`);
        return;
      }
    }
    if (requestKind === "recovery") {
      const conflict = selectedList.find((item) => recoveryUses.some((use) => {
        if (use.date !== item.date) return false;
        if (!item.start || !item.end || !use.start || !use.end) return true;
        return item.start < use.end && use.start < item.end;
      }));
      if (conflict) {
        notify(`${longDate(fromKey(conflict.date))} comporte déjà une récupération sur ce créneau.`);
        return;
      }
    }
    if (requestKind === "leave" && !sickRequest) {
      const emptyType = zeroLeaveBalanceType(selectedList, group, leaveRemaining);
      if (emptyType) {
        const usage = requestLeaveBalanceUsage(selectedList, group);
        notify(leaveBalanceShortageMessage(emptyType, 0, usage[emptyType]));
        return;
      }
    }
    const requestedCetDays = selectedList.filter((item) => item.type === "cet").length;
    if (requestedCetDays) {
      const availableCet = formProfile?.cetAccount?.enabled
        ? Math.max(0, cetBalance(formProfile.cetAccount) - cetPlannedLeaveDays)
        : 0;
      if (requestedCetDays > availableCet) {
        notify(`Cette demande utilise ${requestedCetDays} jour${requestedCetDays > 1 ? "s" : ""} CET, mais votre solde disponible est de ${availableCet} jour${availableCet > 1 ? "s" : ""}.`);
        return;
      }
    }
    // Maladie et Divers n'ont pas de rubrique adaptée dans le PDF officiel.
    // Leur « formulaire » reste donc dans l'application : choix des dates,
    // validation explicite, puis enregistrement synchronisé. Divers est un
    // repère de planning uniquement et est exclu plus bas de tous les calculs.
    if (requestKind === "other" || requestKind === "strike" || sickRequest) {
      const leaveType: LeaveType =
        requestKind === "other"
          ? "other"
          : requestKind === "strike"
            ? "strike"
            : "sick";
      const grouped = groupConsecutive(selectedList.map((item) => item.date));
      const inputs = grouped.map((period) => ({
        id: createClientId("period"),
        from: period.from,
        to: period.to,
        leaveType,
        group,
      }));
      const sickReplacement = leaveType === "sick"
        ? prepareAbsenceReplacement({
            periods,
            replacements: inputs.map((period) => ({
              ...period,
              leaveType: "sick" as const,
            })),
          })
        : null;
      if (sickReplacement?.conflict) {
        notify(`${leaveTypeLabel(sickReplacement.conflict.leaveType || "annual")} est déjà enregistré sur une date sélectionnée. Retirez cette absence avant d’ajouter l’arrêt maladie.`);
        return;
      }
      setSavingRequest(true);
      try {
        let saved: LeavePeriod[];
        if (sickReplacement && demoMode) {
          saved = [];
          setPeriods(sickReplacement.nextPeriods);
        } else if (sickReplacement) {
          saved = [];
          await postCalendarBatch(sickReplacement.operations);
          await reloadCalendar();
        } else if (demoMode) {
          saved = inputs.map((period) => ({
            ...period,
            halfMoment: "",
            updatedAt: new Date().toISOString(),
          }));
        } else {
          const result = await postCalendarPeriodsVerified<{
            id: string;
            from: string;
            to: string;
            leave_type?: LeaveType;
            half_moment?: HalfMoment;
            group?: number;
            updated_at: string;
          }>(inputs);
          saved = result.periods.map((period) => ({
            id: period.id,
            from: period.from,
            to: period.to,
            leaveType: period.leave_type || leaveType,
            halfMoment: period.half_moment || "",
            group: period.group,
            updatedAt: period.updated_at,
          }));
        }
        if (!sickReplacement)
          setPeriods((current) =>
            [...current, ...saved].sort((a, b) => a.from.localeCompare(b.from)),
          );
        setSavingRequest(false);
        cancelRequest();
        confirm(
          leaveType === "other"
            ? "Divers est ajouté au planning, sans modifier la paie ni les soldes."
            : leaveType === "strike"
              ? "La grève est enregistrée et l’estimation de paie est à jour."
            : sickReplacement?.refunded
              ? "L’arrêt maladie est enregistré. Les congés annuels remplacés ont été recrédités dans votre solde de CA."
              : "L’arrêt maladie est enregistré et l’estimation de paie est à jour.",
        );
      } catch (error) {
        notify(
          calendarErrorMessage(
            error,
            leaveType === "other"
              ? "Divers n’a pas pu être enregistré."
              : leaveType === "strike"
                ? "La grève n’a pas pu être enregistrée."
              : "L’arrêt maladie n’a pas pu être enregistré.",
          ),
        );
      } finally {
        setSavingRequest(false);
      }
      return;
    }
    if (requestKind === "recovery") {
      const requestedMinutes = selectedList.reduce(
        (total, item) =>
          total +
          recoveryRequestMinutes(
            item.type as RecoveryRequestType,
            workQuota,
            item.start,
            item.end,
          ),
        0,
      );
      if (requestedMinutes <= 0) {
        notify("Vérifiez les horaires de la récupération.");
        return;
      }
      if (requestedMinutes > recoveryBalanceRemaining) {
        notify(
          `Cette demande utilise ${minutesLabel(requestedMinutes)}, mais votre solde disponible est de ${minutesLabel(recoveryBalanceRemaining)}.`,
        );
        return;
      }
    }
    const groups = groupPlanningRequestSelections(selectedList);
    // Le formulaire officiel n'offre que 2 lignes « garde d'enfant » et
    // 1 seule ligne « jour exceptionnel », sans pagination possible.
    if (requestKind === "leave") {
      const overflow = [
        groups.childcare.length > 2
          ? "Le formulaire ne prévoit que deux périodes de congé garde d’enfant."
          : "",
        groups.exceptional.length > 1
          ? "Le formulaire ne prévoit qu’une seule période de jour exceptionnel."
          : "",
      ].filter(Boolean);
      if (overflow.length) {
        notify(`${overflow.join(" ")} Réduisez votre sélection.`);
        return;
      }
    }
    const pageNeeds =
      requestKind === "leave"
        ? [
            Math.ceil(groups.annual.length / 5),
            Math.ceil(groups.cet.length / 4),
            Math.ceil(groups.rtt.length / 4),
            Math.ceil(groups.fraction.length / 2),
            Math.ceil(
              selectedList.filter((item) => item.type === "half").length / 4,
            ),
          ]
        : [
            Math.ceil(groups.recoveryDay.length / 5),
            Math.ceil(
              selectedList.filter((item) => item.type === "recovery_half")
                .length / 5,
            ),
            Math.ceil(
              selectedList.filter(
                (item) =>
                  item.type === "recovery_hours" ||
                  item.type === "recovery_training",
              )
                .length / 5,
            ),
            Math.ceil(
              selectedList.filter((item) => item.type === "recovery_holiday")
                .length / 5,
            ),
          ];
    if (Math.max(...pageNeeds) > 5) {
      notify(
        "La sélection dépasse la capacité maximale de cinq feuilles. Réduisez le nombre de périodes avant de continuer.",
      );
      return;
    }
    const payload = {
      version: 1,
      requestId: createClientId("request"),
      requestKind,
      ownerKey: userEmail.trim().toLowerCase(),
      group,
      createdAt: new Date().toISOString(),
      profile: formProfile,
      periods: [
        ...groups.annual.map((period) => ({ ...period, type: "annual" })),
        ...groups.cet.map((period) => ({ ...period, type: "cet" })),
        ...groups.rtt.map((period) => ({ ...period, type: "rtt" })),
        ...groups.fraction.map((period) => ({ ...period, type: "fraction" })),
        ...groups.childcare.map((period) => ({
          ...period,
          type: "childcare",
        })),
        ...groups.exceptional.map((period) => ({
          ...period,
          type: "exceptional",
        })),
        ...groups.recoveryDay.map((period) => ({
          ...period,
          type: "recovery_day",
        })),
      ],
      timed: selectedList.filter(
        (item) =>
          item.type === "half" ||
          item.type === "recovery_half" ||
          item.type === "recovery_hours" ||
          item.type === "recovery_holiday" ||
          item.type === "recovery_training",
      ),
    };
    setSavingRequest(true);
    try {
      if (destination === "planning") {
        if (demoMode) {
          const normalized = normalizeLeaveRequest(payload);
          const updatedAt = new Date().toISOString();
          setPeriods((current) => [
            ...current,
            ...normalized.periods.map((period) => ({
              ...period,
              updatedAt,
            })),
          ].sort((left, right) => left.from.localeCompare(right.from)));
          setRecoveryUses((current) => [
            ...current,
            ...normalized.recoverySelections.map((selection) => ({
              id: selection.id,
              date: selection.date,
              minutes: recoveryRequestMinutes(
                selection.type,
                workQuota,
                selection.start,
                selection.end,
              ),
              start: selection.start,
              end: selection.end,
              kind: selection.type === "recovery_training" ? "training" as const : undefined,
              updatedAt,
            })),
          ]);
        } else {
          await postCalendarIdempotent({ action: "save-request", ...payload });
          await reloadCalendar();
        }
        setSavingRequest(false);
        cancelRequest();
        confirm("Les absences sont enregistrées dans votre planning. Aucun formulaire n’a été envoyé.");
        return;
      }
      localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
      window.location.href = "/formulaire/index.html?planning=1";
    } catch (error) {
      setSavingRequest(false);
      notify(
        error instanceof DOMException
          ? "Le navigateur n’a pas pu préparer le formulaire. Vérifiez que le stockage du site est autorisé."
          : "Le formulaire n’a pas pu être préparé. Réessayez.",
      );
    }
  }

  function saveRequestToPlanning() {
    return validateAndOpenForm("planning");
  }

  return { openBlankForm, validateAndOpenForm, saveRequestToPlanning };
}
