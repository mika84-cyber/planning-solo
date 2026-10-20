import { useMemo } from "react";
import { personalPresenceForDate, type Entries, type FormProfile, type LeavePeriod } from "./appModel";
import { calculateMecenatVacation, type MecenatEntry } from "./mecenat";
import { mecenatRuleViolations } from "./mecenatRules";
import { DEFAULT_WORK_SCHEDULE, usableWorkSchedule, type RecoveryUse, type WorkQuota } from "./overtime";
import { fromKey } from "./planningLogic";
import type { MecenatDraft } from "./useWorkTimeUiState";

type MecenatDraftCheckInput = {
  mecenatDraft: MecenatDraft;
  workQuota: WorkQuota;
  workDayMinutes: number;
  group: number;
  periods: LeavePeriod[];
  entries: Entries;
  recoveryUses: RecoveryUse[];
  mecenatEntries: MecenatEntry[];
  formProfile: FormProfile | null;
  exceptionalClosureFor: (key: string) => unknown;
};

/** Le mécénat en cours de saisie : ce qu'il rapporte en repos, et les règles
 *  qu'il ne respecte pas. */
export function useMecenatDraftCheck({
  mecenatDraft,
  workQuota,
  workDayMinutes,
  group,
  periods,
  entries,
  recoveryUses,
  mecenatEntries,
  formProfile,
  exceptionalClosureFor,
}: MecenatDraftCheckInput) {
  const mecenatDraftCalculation = useMemo(
    () =>
      calculateMecenatVacation(
        mecenatDraft.start,
        mecenatDraft.end,
        workQuota,
        mecenatDraft.date,
      ),
    [mecenatDraft.start, mecenatDraft.end, mecenatDraft.date, workQuota],
  );
  // Amplitude de 12 h, repos de 11 h et lundis : ce que ce mécénat ne respecte pas,
  // signalé dans la fenêtre sans empêcher l'inscription.
  // Aucun avertissement tant que la date et la plage horaire ne sont pas saisies.
  const mecenatDraftComplete = Boolean(mecenatDraft.date && mecenatDraft.start && mecenatDraft.end);
  const mecenatWarnings = !mecenatDraftComplete ? [] : mecenatRuleViolations(mecenatDraft, {
    presenceFor: (key) => personalPresenceForDate(fromKey(key), group, periods, entries, recoveryUses, workDayMinutes, (closed) => Boolean(exceptionalClosureFor(closed))),
    schedule: usableWorkSchedule(formProfile?.workSchedule) ?? DEFAULT_WORK_SCHEDULE,
    mecenats: mecenatEntries,
  });

  return { mecenatDraftCalculation, mecenatWarnings };
}
