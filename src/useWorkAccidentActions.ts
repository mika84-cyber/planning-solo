import type { Dispatch, SetStateAction } from "react";
import type { LeavePeriod } from "./appModel";
import { prepareAbsenceReplacement } from "./absenceReplacement";
import { calendarErrorMessage, postCalendar, postCalendarBatch } from "./calendarApi";
import { createClientId } from "./clientId";
import { leaveTypeLabel } from "./planningLogic";

type SaveWorkAccidentInput = { from: string; to: string };

type Options = {
  demoMode: boolean;
  group: number;
  periods: LeavePeriod[];
  setPeriods: Dispatch<SetStateAction<LeavePeriod[]>>;
  reloadCalendar: () => Promise<void>;
  notify: (message: string) => void;
  showSuccess: (message: string) => void;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function useWorkAccidentActions({
  demoMode,
  group,
  periods,
  setPeriods,
  reloadCalendar,
  notify,
  showSuccess,
}: Options) {
  async function saveWorkAccident({ from, to }: SaveWorkAccidentInput) {
    if (!datePattern.test(from) || !datePattern.test(to) || to < from) {
      notify("Vérifiez les dates de l’accident de travail.");
      return false;
    }
    const id = createClientId("work-accident");
    const replacement = prepareAbsenceReplacement({
      periods,
      replacements: [{ id, from, to, leaveType: "work_accident", group }],
    });
    if (replacement.conflict) {
      const label = leaveTypeLabel(replacement.conflict.leaveType || "annual");
      notify(`${label} est déjà enregistré sur cette période. Retirez cette absence avant d’ajouter l’accident de travail.`);
      return false;
    }

    try {
      if (demoMode) {
        setPeriods(replacement.nextPeriods);
      } else {
        await postCalendarBatch(replacement.operations);
        await reloadCalendar();
      }
      showSuccess(
        replacement.refunded
          ? "L’accident de travail est enregistré. Les congés annuels remplacés ont été recrédités dans votre solde de CA."
          : "L’accident de travail est enregistré dans le planning, sans jour de carence.",
      );
      return true;
    } catch (error) {
      notify(calendarErrorMessage(error, "L’accident de travail n’a pas pu être enregistré. Réessayez."));
      return false;
    }
  }

  async function deleteWorkAccident(period: LeavePeriod) {
    if (period.leaveType !== "work_accident") return false;
    try {
      if (!demoMode) {
        await postCalendar({
          action: "delete-period",
          id: period.id,
          expectedUpdatedAt: period.updatedAt,
        });
      }
      setPeriods((current) => current.filter((item) => item.id !== period.id));
      showSuccess("La période d’accident de travail a été retirée du planning.");
      return true;
    } catch (error) {
      notify(calendarErrorMessage(error, "La période n’a pas pu être retirée. Réessayez."));
      return false;
    }
  }

  return { saveWorkAccident, deleteWorkAccident };
}
