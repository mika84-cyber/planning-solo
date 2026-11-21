import { useState } from "react";
import type { Entries, FormProfile, LeavePeriod, PartnerCalendarEntries, PartnerLeavePeriod, PartnerSharingStatus, PayProfile } from "./appModel";
import type { MecenatEntry, MecenatSignup } from "./mecenat";
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
  const [mecenatSignups, setMecenatSignups] = useState<MecenatSignup[]>([]);
  const [partnerEntries, setPartnerEntries] = useState<PartnerCalendarEntries>({});
  const [partnerPeriods, setPartnerPeriods] = useState<PartnerLeavePeriod[]>([]);
  const [partnerSharingStatus, setPartnerSharingStatus] = useState<PartnerSharingStatus>("disabled");
  /** Le serveur a répondu, ou ne répondra pas (hors connexion, démo) : ce
   *  qui est affiché n'est plus la copie gardée en attente de sa relecture.
   *  La fenêtre des expositions l'attend, pour ne pas s'ouvrir sur un message
   *  déjà lu depuis un autre appareil puis se refermer seule. */
  const [calendarSettled, setCalendarSettled] = useState(false);

  return {
    entries, setEntries, periods, setPeriods, formProfile, setFormProfile,
    payProfiles, setPayProfiles, overtimeEntries, setOvertimeEntries,
    recoveryUses, setRecoveryUses, mecenatEntries, setMecenatEntries,
    mecenatSignups, setMecenatSignups,
    partnerEntries, setPartnerEntries, partnerPeriods, setPartnerPeriods,
    partnerSharingStatus, setPartnerSharingStatus,
    calendarSettled, setCalendarSettled,
  };
}
