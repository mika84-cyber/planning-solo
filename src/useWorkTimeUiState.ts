import { useRef, useState } from "react";
import { dateKey } from "./planningLogic";
import type { OvertimeDisposition } from "./overtime";

export type OvertimeDraft = {
  date: string;
  start: string;
  end: string;
  /** Vide tant que « À payer » ou « À récupérer » n'est pas choisi. */
  disposition: OvertimeDisposition | "";
};

/** Le champ basis dit ce que contient la saisie : « credited », un solde déjà
 *  constitué qu'on reprend tel quel, ou « worked », des heures travaillées
 *  que l'application doit encore majorer. */
export type SolidarityDraft = {
  hours: string;
  minutes: string;
  basis: "credited" | "worked";
};

export type MecenatDraft = { date: string; start: string; end: string };

export type RecoveryDraft = {
  date: string;
  kind: "hours" | "half" | "day" | "holiday" | "training";
  hours: string;
  minutes: string;
  start: string;
  durationMinutes: number | null;
  trainingMinutes: 180 | 360;
  trainingMoment?: "morning" | "afternoon";
};

/** État des dialogues heures supplémentaires, récupérations et mécénats. */
export function useWorkTimeUiState() {
  const [overtimeDialogOpen, setOvertimeDialogOpen] = useState(false);
  const [solidarityDialogOpen, setSolidarityDialogOpen] = useState(false);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryCalendarVisible, setRecoveryCalendarVisible] = useState(true);
  const [recoveryDatePicking, setRecoveryDatePicking] = useState(false);
  const [trainingRecoveryMode, setTrainingRecoveryMode] = useState<"manual" | "form">("manual");
  const [overtimeHistoryOpen, setOvertimeHistoryOpen] = useState(false);
  const [mecenatDialogOpen, setMecenatDialogOpen] = useState(false);
  const [mecenatHistoryOpen, setMecenatHistoryOpen] = useState(false);
  const [savingMecenat, setSavingMecenat] = useState(false);
  const [savingOvertime, setSavingOvertime] = useState(false);
  // Rien n'est prérempli : date, horaires et destination se choisissent.
  const [overtimeDraft, setOvertimeDraft] = useState<OvertimeDraft>({ date: "", start: "", end: "", disposition: "" });
  const [solidarityDraft, setSolidarityDraft] = useState<SolidarityDraft>({ hours: "", minutes: "0", basis: "credited" });
  const [recoveryDraft, setRecoveryDraft] = useState<RecoveryDraft>({
    date: dateKey(new Date()),
    kind: "hours" as "hours" | "half" | "day" | "holiday" | "training",
    hours: "2", minutes: "0", start: "09:00", durationMinutes: 480 as number | null,
    trainingMinutes: 360 as 180 | 360,
    trainingMoment: "morning" as "morning" | "afternoon",
  });
  // Rien n'est prérempli : date et horaires se saisissent à chaque mécénat.
  const [mecenatDraft, setMecenatDraft] = useState<MecenatDraft>({ date: "", start: "", end: "" });
  const overtimeSaveInFlightRef = useRef(false);
  const mecenatSaveInFlightRef = useRef(false);
  const lastOvertimeSubmissionRef = useRef({ key: "", at: 0 });
  const lastRecoverySubmissionRef = useRef({ key: "", at: 0 });
  const lastMecenatSubmissionRef = useRef({ key: "", at: 0 });

  return {
    overtimeDialogOpen, setOvertimeDialogOpen, solidarityDialogOpen, setSolidarityDialogOpen,
    recoveryDialogOpen, setRecoveryDialogOpen, recoveryCalendarVisible, setRecoveryCalendarVisible,
    recoveryDatePicking, setRecoveryDatePicking, trainingRecoveryMode, setTrainingRecoveryMode,
    overtimeHistoryOpen, setOvertimeHistoryOpen, mecenatDialogOpen, setMecenatDialogOpen,
    mecenatHistoryOpen, setMecenatHistoryOpen, savingMecenat, setSavingMecenat,
    savingOvertime, setSavingOvertime, overtimeDraft, setOvertimeDraft,
    solidarityDraft, setSolidarityDraft, recoveryDraft, setRecoveryDraft,
    mecenatDraft, setMecenatDraft, overtimeSaveInFlightRef, mecenatSaveInFlightRef,
    lastOvertimeSubmissionRef, lastRecoverySubmissionRef, lastMecenatSubmissionRef,
  };
}
