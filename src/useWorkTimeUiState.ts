import { useRef, useState } from "react";
import { dateKey } from "./planningLogic";
import type { OvertimeDisposition } from "./overtime";

export type OvertimeDraft = {
  date: string;
  start: string;
  end: string;
  disposition: OvertimeDisposition;
};

export type SolidarityDraft = { hours: string; minutes: string };

export type MecenatDraft = { date: string; start: string; end: string };

export type RecoveryDraft = {
  date: string;
  kind: "hours" | "half" | "day" | "holiday" | "training";
  hours: string;
  minutes: string;
  start: string;
  durationMinutes: number | null;
  trainingMinutes: 180 | 360;
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
  const [overtimeDraft, setOvertimeDraft] = useState<OvertimeDraft>({
    date: dateKey(new Date()), start: "18:00", end: "20:00",
    disposition: "paid" as OvertimeDisposition,
  });
  const [solidarityDraft, setSolidarityDraft] = useState<SolidarityDraft>({ hours: "", minutes: "0" });
  const [recoveryDraft, setRecoveryDraft] = useState<RecoveryDraft>({
    date: dateKey(new Date()),
    kind: "hours" as "hours" | "half" | "day" | "holiday" | "training",
    hours: "2", minutes: "0", start: "", durationMinutes: 480 as number | null,
    trainingMinutes: 360 as 180 | 360,
  });
  const [mecenatDraft, setMecenatDraft] = useState<MecenatDraft>({
    date: dateKey(new Date()), start: "19:00", end: "00:00",
  });
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
