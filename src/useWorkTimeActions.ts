import type { Dispatch, RefObject, SetStateAction } from "react";
import { calendarErrorMessage } from "./calendarApi";
import { createClientId } from "./clientId";
import { calculateMecenatVacation, type MecenatEntry } from "./mecenat";
import {
  minutesLabel,
  nextPayPeriod,
  splitOvertimeRange,
  type OvertimeEntry,
  type RecoveryUse,
  type WorkQuota,
} from "./overtime";
import { dateKey, fromKey, s } from "./planningLogic";
import { euros, type FormProfile, type ViewMode } from "./appModel";
import type {
  MecenatDraft,
  OvertimeDraft,
  RecoveryDraft,
  SolidarityDraft,
} from "./useWorkTimeUiState";

type SubmissionRef = RefObject<{ key: string; at: number }>;
type BooleanRef = RefObject<boolean>;
type SetState<T> = Dispatch<SetStateAction<T>>;

export type WorkTimePostCalendar = <T = { ok: true }>(
  payload: Record<string, unknown>,
) => Promise<T>;

export type WorkTimePostBatch = <T = unknown>(
  operations: Array<Record<string, unknown>>,
) => Promise<{ ok: true; results: T[] }>;

type WorkTimeActionsOptions = {
  demoMode: boolean;
  userEmail: string;
  group: number;
  formProfile: FormProfile | null;
  workQuota: WorkQuota;
  recoveryBalanceRemaining: number;
  setOvertimeEntries: SetState<OvertimeEntry[]>;
  setRecoveryUses: SetState<RecoveryUse[]>;
  setMecenatEntries: SetState<MecenatEntry[]>;
  overtimeDraft: OvertimeDraft;
  solidarityDraft: SolidarityDraft;
  setSolidarityDraft: SetState<SolidarityDraft>;
  recoveryDraft: RecoveryDraft;
  mecenatDraft: MecenatDraft;
  trainingRecoveryMode: "manual" | "form";
  recoveryRangeDates: string[];
  setRecoveryRangeDates: SetState<string[]>;
  recoveryRangePrefillDate: string | null;
  setRecoveryRangePrefillDate: SetState<string | null>;
  setRecoveryRangeOpen: SetState<boolean>;
  setRecoveryRangeSelecting: SetState<boolean>;
  savingOvertime: boolean;
  setSavingOvertime: SetState<boolean>;
  setSavingMecenat: SetState<boolean>;
  setOvertimeDialogOpen: SetState<boolean>;
  setSolidarityDialogOpen: SetState<boolean>;
  setRecoveryDialogOpen: SetState<boolean>;
  setMecenatDialogOpen: SetState<boolean>;
  setHomeSection: (section: "home") => void;
  setMode: SetState<ViewMode>;
  overtimeSaveInFlightRef: BooleanRef;
  mecenatSaveInFlightRef: BooleanRef;
  lastOvertimeSubmissionRef: SubmissionRef;
  lastRecoverySubmissionRef: SubmissionRef;
  lastMecenatSubmissionRef: SubmissionRef;
  handoffKey: string;
  notify: (message: string) => void;
  confirmMessage: (message: string) => void;
  post: WorkTimePostCalendar;
  postBatch: WorkTimePostBatch;
};

type OvertimeResponse = { overtime_entry?: { updated_at?: string } };
type RecoveryResponse = { recovery_use?: { updated_at?: string } };
type MecenatResponse = { mecenat_entry?: { updated_at?: string } };

export function validCalendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(fromKey(value)) === value;
}

export function solidarityMinutes(draft: SolidarityDraft) {
  return Math.round(
    Number(draft.hours.replace(",", ".")) * 60 + Number(draft.minutes),
  );
}

export function recoveryDraftMinutes(draft: RecoveryDraft) {
  if (draft.kind === "training") return draft.trainingMinutes;
  if (draft.durationMinutes !== null) return draft.durationMinutes;
  return Math.round(
    Number(draft.hours.replace(",", ".")) * 60 + Number(draft.minutes),
  );
}

export function overtimeSavePayload(entry: OvertimeEntry) {
  return {
    action: "save-overtime",
    id: entry.id,
    date: entry.date,
    minutes: entry.minutes,
    dayMinutes: entry.dayMinutes,
    nightMinutes: entry.nightMinutes,
    disposition: entry.disposition,
    inputMode: entry.inputMode,
    start: entry.start,
    end: entry.end,
  } satisfies Record<string, unknown>;
}

export function recoverySavePayload(entry: RecoveryUse) {
  return {
    action: "save-recovery-use",
    id: entry.id,
    date: entry.date,
    minutes: entry.minutes,
    start: entry.start,
    kind: entry.kind,
  } satisfies Record<string, unknown>;
}

export function mecenatSavePayload(entry: MecenatEntry) {
  return {
    action: "save-mecenat",
    id: entry.id,
    date: entry.date,
    start: entry.start,
    end: entry.end,
    payYear: entry.payYear,
    payMonth: entry.payMonth,
  } satisfies Record<string, unknown>;
}

export function useWorkTimeActions(options: WorkTimeActionsOptions) {
  const {
    demoMode, userEmail, group, formProfile, workQuota,
    recoveryBalanceRemaining, setOvertimeEntries, setRecoveryUses, setMecenatEntries,
    overtimeDraft, solidarityDraft, setSolidarityDraft, recoveryDraft, mecenatDraft,
    trainingRecoveryMode, recoveryRangeDates, setRecoveryRangeDates,
    recoveryRangePrefillDate, setRecoveryRangePrefillDate, setRecoveryRangeOpen,
    setRecoveryRangeSelecting, savingOvertime, setSavingOvertime, setSavingMecenat,
    setOvertimeDialogOpen, setSolidarityDialogOpen, setRecoveryDialogOpen,
    setMecenatDialogOpen, setHomeSection, setMode, overtimeSaveInFlightRef,
    mecenatSaveInFlightRef, lastOvertimeSubmissionRef, lastRecoverySubmissionRef,
    lastMecenatSubmissionRef, handoffKey, notify, confirmMessage, post, postBatch,
  } = options;

  async function saveOvertimeEntry() {
    if (overtimeSaveInFlightRef.current) return;
    if (!validCalendarDate(overtimeDraft.date)) {
      notify("Choisissez une date valide pour les heures supplémentaires.");
      return;
    }
    const duration = splitOvertimeRange(overtimeDraft.start, overtimeDraft.end);
    if (!duration) {
      notify("Indiquez des heures de début et de fin valides et différentes. Une plage peut passer minuit.");
      return;
    }
    const submissionKey = [
      overtimeDraft.date, duration.minutes, duration.dayMinutes,
      duration.nightMinutes, overtimeDraft.disposition,
    ].join("|");
    if (
      lastOvertimeSubmissionRef.current.key === submissionKey &&
      Date.now() - lastOvertimeSubmissionRef.current.at < 1500
    ) return;
    lastOvertimeSubmissionRef.current = { key: submissionKey, at: Date.now() };
    overtimeSaveInFlightRef.current = true;
    setSavingOvertime(true);
    try {
      const localEntry: OvertimeEntry = {
        id: createClientId("overtime"), date: overtimeDraft.date, ...duration,
        disposition: overtimeDraft.disposition, inputMode: "range",
        start: overtimeDraft.start, end: overtimeDraft.end,
        updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await post<OvertimeResponse>(overtimeSavePayload(localEntry));
        localEntry.updatedAt = result.overtime_entry?.updated_at || localEntry.updatedAt;
      }
      setOvertimeEntries((current) =>
        current.some((item) => item.id === localEntry.id) ? current : [...current, localEntry],
      );
      setOvertimeDialogOpen(false);
      confirmMessage(
        localEntry.disposition === "paid"
          ? "Heures enregistrées pour la paie du mois suivant."
          : `${minutesLabel(localEntry.minutes)} ajoutées au solde de récupération.`,
      );
    } catch (error) {
      notify(calendarErrorMessage(error, "Les heures n’ont pas pu être enregistrées."));
    } finally {
      overtimeSaveInFlightRef.current = false;
      setSavingOvertime(false);
    }
  }

  async function saveSolidarityHours() {
    if (overtimeSaveInFlightRef.current) return;
    const minutes = solidarityMinutes(solidarityDraft);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600_000) {
      notify("Indiquez un nombre d’heures valide à ajouter au solde.");
      return;
    }
    overtimeSaveInFlightRef.current = true;
    setSavingOvertime(true);
    try {
      const localEntry: OvertimeEntry = {
        id: createClientId("solidarity"), date: dateKey(new Date()), minutes,
        dayMinutes: minutes, nightMinutes: 0, disposition: "recovery",
        inputMode: "duration", updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await post<OvertimeResponse>(overtimeSavePayload(localEntry));
        localEntry.updatedAt = result.overtime_entry?.updated_at || localEntry.updatedAt;
      }
      setOvertimeEntries((current) => [...current, localEntry]);
      setSolidarityDialogOpen(false);
      setSolidarityDraft({ hours: "", minutes: "0" });
      confirmMessage(`${minutesLabel(minutes)} ajoutées au solde de récupération.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "Les heures n’ont pas pu être ajoutées au solde."));
    } finally {
      overtimeSaveInFlightRef.current = false;
      setSavingOvertime(false);
    }
  }

  async function deleteOvertimeEntry(entry: OvertimeEntry) {
    if (entry.disposition === "recovery" && recoveryBalanceRemaining < entry.minutes) {
      notify("Cette récupération a déjà été utilisée. Annulez d’abord les récupérations posées correspondantes.");
      return;
    }
    if (!window.confirm("Supprimer cette déclaration d’heures supplémentaires ?")) return;
    try {
      if (!demoMode) await post({ action: "delete-overtime", id: entry.id });
      setOvertimeEntries((current) => current.filter((item) => item.id !== entry.id));
      confirmMessage("La déclaration a été supprimée.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La déclaration n’a pas pu être supprimée."));
    }
  }

  async function saveRecoveryUse() {
    if (overtimeSaveInFlightRef.current) return;
    const minutes = recoveryDraftMinutes(recoveryDraft);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recoveryDraft.date) || minutes <= 0) {
      notify("Vérifiez la date et la durée de récupération.");
      return;
    }
    if (minutes > recoveryBalanceRemaining) {
      notify(`Votre solde disponible est de ${minutesLabel(recoveryBalanceRemaining)}.`);
      return;
    }
    if (recoveryDraft.kind === "training" && trainingRecoveryMode === "form") {
      const times = { start: "09:00", end: minutes === 180 ? "12:00" : "15:00" };
      const payload = {
        version: 1, requestId: createClientId("request"), requestKind: "recovery" as const,
        ownerKey: userEmail.trim().toLowerCase(), group,
        createdAt: new Date().toISOString(), profile: formProfile, periods: [],
        timed: [{ date: recoveryDraft.date, type: "recovery_training", ...times }],
      };
      try {
        localStorage.setItem(handoffKey, JSON.stringify(payload));
        setRecoveryDialogOpen(false);
        window.location.href = "/formulaire/index.html?planning=1";
      } catch {
        notify("Le formulaire n’a pas pu être préparé. Réessayez.");
      }
      return;
    }
    const submissionKey = `${recoveryDraft.date}|${minutes}`;
    if (
      lastRecoverySubmissionRef.current.key === submissionKey &&
      Date.now() - lastRecoverySubmissionRef.current.at < 1500
    ) return;
    lastRecoverySubmissionRef.current = { key: submissionKey, at: Date.now() };
    overtimeSaveInFlightRef.current = true;
    setSavingOvertime(true);
    try {
      const localUse: RecoveryUse = {
        id: createClientId("recovery"), date: recoveryDraft.date, minutes,
        start: recoveryDraft.start || undefined,
        kind: recoveryDraft.kind === "training" ? "training" : undefined,
        updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await post<RecoveryResponse>(recoverySavePayload(localUse));
        localUse.updatedAt = result.recovery_use?.updated_at || localUse.updatedAt;
      }
      setRecoveryUses((current) =>
        current.some((item) => item.id === localUse.id) ? current : [...current, localUse],
      );
      setRecoveryDialogOpen(false);
      confirmMessage(`${minutesLabel(minutes)} de récupération posées.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "La récupération n’a pas pu être enregistrée."));
    } finally {
      overtimeSaveInFlightRef.current = false;
      setSavingOvertime(false);
    }
  }

  function beginRecoveryRangeSelection() {
    setRecoveryRangeDates(recoveryRangePrefillDate ? [recoveryRangePrefillDate] : []);
    setRecoveryRangePrefillDate(null);
    setRecoveryRangeOpen(false);
    setRecoveryRangeSelecting(true);
    setHomeSection("home");
    setMode("month");
    window.setTimeout(() =>
      document.getElementById("recovery-range-selection-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }), 80,
    );
  }

  function cancelRecoveryRangeSelection() {
    setRecoveryRangeSelecting(false);
    setRecoveryRangeDates([]);
    setRecoveryRangePrefillDate(null);
  }

  async function saveRecoveryRangeDates() {
    if (!recoveryRangeDates.length || savingOvertime) return;
    const minutes = recoveryDraftMinutes(recoveryDraft);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      notify("Vérifiez la durée de récupération.");
      return;
    }
    const totalMinutes = minutes * recoveryRangeDates.length;
    if (totalMinutes > recoveryBalanceRemaining) {
      notify(`Ces dates utilisent ${minutesLabel(totalMinutes)}, mais votre solde disponible est de ${minutesLabel(recoveryBalanceRemaining)}.`);
      return;
    }
    setSavingOvertime(true);
    try {
      const nowIso = new Date().toISOString();
      const localUses: RecoveryUse[] = [...recoveryRangeDates].sort().map((date) => ({
        id: createClientId("recovery"), date, minutes,
        start: recoveryDraft.start || undefined,
        kind: recoveryDraft.kind === "training" ? "training" : undefined,
        updatedAt: nowIso,
      }));
      if (!demoMode) await postBatch(localUses.map(recoverySavePayload));
      setRecoveryUses((current) => [...current, ...localUses]);
      cancelRecoveryRangeSelection();
      confirmMessage(`${recoveryRangeDates.length} date${s(recoveryRangeDates.length)} de récupération enregistrée${s(recoveryRangeDates.length)} · ${minutesLabel(totalMinutes)} déduites du solde.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "Les récupérations n’ont pas pu être enregistrées."));
    } finally {
      setSavingOvertime(false);
    }
  }

  async function deleteRecoveryUse(entry: RecoveryUse) {
    if (!window.confirm("Annuler cette utilisation de récupération ?")) return;
    try {
      if (!demoMode) await post({ action: "delete-recovery-use", id: entry.id });
      setRecoveryUses((current) => current.filter((item) => item.id !== entry.id));
      confirmMessage("La récupération a été remise dans votre solde.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La récupération n’a pas pu être annulée."));
    }
  }

  async function saveMecenatEntry() {
    if (mecenatSaveInFlightRef.current) return;
    const calculation = calculateMecenatVacation(mecenatDraft.start, mecenatDraft.end, workQuota);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mecenatDraft.date) || !calculation) {
      notify("Vérifiez la date et les horaires du mécénat.");
      return;
    }
    const { year: payYear, month: payMonth } = nextPayPeriod(mecenatDraft.date);
    const submissionKey = [mecenatDraft.date, mecenatDraft.start, mecenatDraft.end, payYear, payMonth].join("|");
    if (
      lastMecenatSubmissionRef.current.key === submissionKey &&
      Date.now() - lastMecenatSubmissionRef.current.at < 1500
    ) return;
    lastMecenatSubmissionRef.current = { key: submissionKey, at: Date.now() };
    mecenatSaveInFlightRef.current = true;
    setSavingMecenat(true);
    try {
      const localEntry: MecenatEntry = {
        id: createClientId("mecenat"), date: mecenatDraft.date,
        start: mecenatDraft.start, end: mecenatDraft.end,
        dayMinutes: calculation.dayMinutes, nightMinutes: calculation.nightMinutes,
        grossAmountCents: calculation.grossAmountCents, payYear, payMonth,
        updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await post<MecenatResponse>(mecenatSavePayload(localEntry));
        localEntry.updatedAt = result.mecenat_entry?.updated_at || localEntry.updatedAt;
      }
      setMecenatEntries((current) =>
        current.some((item) => item.id === localEntry.id) ? current : [...current, localEntry],
      );
      setMecenatDialogOpen(false);
      confirmMessage(`Mécénat enregistré : ${euros(localEntry.grossAmountCents / 100)} brut, intégré automatiquement à la paie du mois suivant.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "Le mécénat n’a pas pu être enregistré."));
    } finally {
      mecenatSaveInFlightRef.current = false;
      setSavingMecenat(false);
    }
  }

  async function deleteMecenatEntry(entry: MecenatEntry) {
    if (!window.confirm("Supprimer ce mécénat ?")) return;
    try {
      if (!demoMode) await post({ action: "delete-mecenat", id: entry.id });
      setMecenatEntries((current) => current.filter((item) => item.id !== entry.id));
      confirmMessage("Le mécénat a été supprimé.");
    } catch (error) {
      notify(calendarErrorMessage(error, "Le mécénat n’a pas pu être supprimé."));
    }
  }

  return {
    saveOvertimeEntry, saveSolidarityHours, deleteOvertimeEntry,
    saveRecoveryUse, beginRecoveryRangeSelection, cancelRecoveryRangeSelection,
    saveRecoveryRangeDates, deleteRecoveryUse, saveMecenatEntry, deleteMecenatEntry,
  };
}
