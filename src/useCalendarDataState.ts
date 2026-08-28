import { useState } from "react";
import type { Entries, FormProfile, LeavePeriod, PayProfile } from "./appModel";
import type { MecenatEntry } from "./mecenat";
import type { OvertimeEntry, RecoveryUse } from "./overtime";

/** Données synchronisées du compte, regroupées hors de l’orchestrateur visuel. */
export function useCalendarDataState() {
  const [entries, setEntries] = useState<Entries>({});
  const [periods, setPeriods] = useState<LeavePeriod[]>([]);
  const [formProfile, setFormProfile] = useState<FormProfile | null>(null);
  const [payProfiles, setPayProfiles] = useState<Record<string, PayProfile>>({});
  const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntry[]>([]);
  const [recoveryUses, setRecoveryUses] = useState<RecoveryUse[]>([]);
  const [mecenatEntries, setMecenatEntries] = useState<MecenatEntry[]>([]);

  return {
    entries, setEntries, periods, setPeriods, formProfile, setFormProfile,
    payProfiles, setPayProfiles, overtimeEntries, setOvertimeEntries,
    recoveryUses, setRecoveryUses, mecenatEntries, setMecenatEntries,
  };
}
