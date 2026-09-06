import {
  addDays,
  dateKey,
  fromKey,
  getDayInfo,
  localDate,
  monthDays,
  type HalfMoment,
  type HolidayPay,
  type LeaveType,
  type SelectionType,
} from "./planningLogic";
import type { WorkQuota, WorkSchedule } from "./overtime";
import type { CetAccount } from "./cet";

export type ViewMode = "month" | "year";
export type RequestKind = "leave" | "recovery" | "other" | "strike";
export type BalanceType = "annual" | "rtt" | "fraction";
export type AuthStatus = "loading" | "guest" | "invite" | "recovery" | "ready";

export type SharedEntry = {
  noteText: string;
  noteColor: string;
  noteUpdatedAt: string;
  noteGroupId: string;
  leave: boolean;
  wish: boolean;
  holidayPay: HolidayPay | "";
  /** Durée acquise au moment du choix, figée pour éviter tout recalcul
   * rétroactif lors d'un changement de quotité. */
  holidayRecoveryMinutes?: number;
  /** Correction locale d'une fermeture : `closed` l'ajoute, `open` masque
   *  une fermeture automatique du Grand Palais. */
  closureOverride: "closed" | "open" | "";
  /** Un échange validé porte toujours ses deux journées. `given` correspond
   *  au jour de cycle cédé au collègue, `return` au jour rendu. */
  exchangeId?: string;
  exchangeRole?: "given" | "return";
  exchangePartner?: string;
  exchangePartnerGroup?: number;
  exchangeOtherDate?: string;
  /** Version serveur utilisée pour détecter une modification concurrente. */
  updatedAt: string;
};
export type Entries = Record<string, SharedEntry>;
export type PartnerCalendarEntry = {
  noteText: string;
  noteColor: string;
  noteAuthor: "mika" | "agnes" | "";
  noteUpdatedAt: string;
  noteGroupId: string;
  agnesLeave: boolean;
};
export type PartnerCalendarEntries = Record<string, PartnerCalendarEntry>;
export type PartnerLeavePeriod = {
  id: string;
  from: string;
  to: string;
  person: "agnes" | "both";
};
export type PartnerSharingStatus = "connected" | "disabled" | "unavailable";
export type WorkExchange = {
  id: string;
  partnerName: string;
  partnerGroup: number;
  agreementDate: string;
  returnDate: string;
  updatedAt: string;
};
export type LeavePeriod = {
  id: string;
  from: string;
  to: string;
  leaveType?: LeaveType | "";
  halfMoment?: HalfMoment | "";
  group?: number;
  updatedAt: string;
  legacy?: boolean;
};
export type PayStatus = "fonctionnaire" | "contractuel";
export type PayCalibrationRegime = "pre-culture-psc" | "culture-psc";
export type PayProfile = {
  baseSalary?: number;
  residenceAllowance?: number;
  ifse?: number;
  carenceDay?: number;
  otherFixed?: number;
  cia?: number;
  ciaMonth?: number;
  netRatioFixed?: number;
  netRatioVariable?: number;
  netRatioRegime?: PayCalibrationRegime;
  navigo?: number;
  mealVoucherDeduction?: number;
  pasRate?: number;
};
export type ManualYearAdjustments = {
  annualUsed: number;
  rttUsed: number;
  fractionUsed: number;
  sundayLeaveJanJun: number;
  sundayLeaveJulSep: number;
  sundayLeaveOctNov: number;
  sundayLeaveDec: number;
};
export type FormProfile = {
  fullName: string;
  group: string;
  signature: string;
  status?: PayStatus;
  workQuota?: WorkQuota;
  workSchedule?: WorkSchedule;
  baseSalary?: number;
  residenceAllowance?: number;
  ifse?: number;
  carenceDay?: number;
  otherFixed?: number;
  cia?: number;
  ciaMonth?: number;
  netRatioFixed?: number;
  netRatioVariable?: number;
  netRatioRegime?: PayCalibrationRegime;
  navigo?: number;
  mealVoucherDeduction?: number;
  pasRate?: number;
  sundayCarryover?: number;
  sundayCarryoverYear?: number;
  sundayCarryoverMonth?: number;
  sundayCarryoverFromYear?: number;
  sundayCarryoverFromMonth?: number;
  /** Reprise sans dates des absences antérieures à l'utilisation de l'app. */
  manualAdjustments?: Record<string, ManualYearAdjustments>;
  cetAccount?: CetAccount;
};
export type SelectedDay = {
  date: string;
  type: SelectionType;
  start?: string;
  end?: string;
};
export type NoteListItem = {
  key: string;
  date: string;
  label: string;
  detail: string;
  kind: "leave" | "note";
  color?: string;
  author?: "mika" | "agnes";
  notes?: Array<{
    author: "mika" | "agnes";
    label: string;
  }>;
};

/** Réunit les notes de Mika et d’Agnès dans une seule carte lorsqu’elles
 * concernent le même jour. Chaque contenu reste identifié par son auteur. */
export function groupNoteItemsByDate(items: NoteListItem[]) {
  const grouped: NoteListItem[] = [];
  const byDate = new Map<string, NoteListItem>();
  for (const item of items) {
    if (item.kind !== "note" || !item.author) {
      grouped.push(item);
      continue;
    }
    const note = {
      author: item.author,
      label: item.label,
    };
    const current = byDate.get(item.date);
    if (current) {
      current.notes!.push(note);
      current.key = `notes-${item.date}`;
      continue;
    }
    const next = { ...item, notes: [note] };
    byDate.set(item.date, next);
    grouped.push(next);
  }
  return grouped;
}

const NOTE_MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
export function noteDateLabel(key: string) {
  const date = fromKey(key);
  return `${date.getDate()} ${NOTE_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export const HOLIDAY_PAY_OPTIONS: Array<{
  value: HolidayPay | "";
  label: string;
}> = [
  { value: "prime", label: "Prime seule" },
  { value: "recovery", label: "Prime + récup" },
];

export const PAY_STATUS_OPTIONS: Array<{
  value: PayStatus;
  label: string;
}> = [
  { value: "contractuel", label: "Contractuel" },
  { value: "fonctionnaire", label: "Fonctionnaire" },
];

const EUROS = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function euros(value: number) {
  return EUROS.format(value);
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function dayCountLabel(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(".", ",");
}

export function notePeriodFor(
  entries: Entries,
  key: string,
  entry: SharedEntry,
) {
  if (!entry.noteGroupId) return { from: key, to: key };
  const groupKeys = Object.entries(entries)
    .filter(([, candidate]) => candidate.noteGroupId === entry.noteGroupId)
    .map(([date]) => date)
    .sort();
  return groupKeys.length
    ? { from: groupKeys[0], to: groupKeys.at(-1)! }
    : { from: key, to: key };
}

export function emptyEntry(): SharedEntry {
  return {
    noteText: "",
    noteColor: "#D3943D",
    noteUpdatedAt: "",
    noteGroupId: "",
    leave: false,
    wish: false,
    holidayPay: "",
    closureOverride: "",
    updatedAt: "",
  };
}

export function rangeKeys(from: string, to: string) {
  const keys: string[] = [];
  let cursor = fromKey(from);
  const last = fromKey(to);
  for (let guard = 0; cursor <= last && guard < 400; guard++) {
    keys.push(dateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

export type PersonalPresence = {
  status: "work" | "training" | "rest" | "absence" | "partial";
  halfMoment?: HalfMoment;
  absentMinutes?: number;
};

/** Règle commune de présence utilisée par le planning personnel, ses
 * compteurs et le partage anonymisé. Aucun motif d'absence n'en sort. */
export function personalPresenceForDate(
  date: Date,
  group: number,
  periods: LeavePeriod[],
  entries: Entries,
  recoveryUses: Array<{ date: string; minutes: number; start?: string; end?: string }> = [],
  workDayMinutes = 8 * 60,
  isExceptionallyClosed: (date: string) => boolean = () => false,
): PersonalPresence {
  const key = dateKey(date);
  const scheduled = getDayInfo(date, group).kind;
  const entry = entries[key];
  if (isExceptionallyClosed(key)) return { status: "absence" };
  if (entry?.exchangeRole === "return") return { status: "work" };
  if (entry?.exchangeRole === "given") return { status: "absence" };
  if (scheduled === "off") return { status: "rest" };
  const dayPeriods = periods.filter((item) => key >= item.from && key <= item.to);
  if (dayPeriods.some((item) => item.leaveType !== "half") || entry?.leave) return { status: "absence" };
  const dayRecovery = recoveryUses.filter((item) => item.date === key);
  const recoveredMinutes = dayRecovery.reduce((total, item) => total + item.minutes, 0);
  const halfPeriods = dayPeriods.filter((item) => item.leaveType === "half");
  const halfMoments = new Set<HalfMoment>(halfPeriods
    .map((item) => item.halfMoment)
    .filter((moment): moment is HalfMoment => moment === "morning" || moment === "afternoon"));
  const halfLeaveMinutes = halfMoments.size >= 2
    ? workDayMinutes
    : halfPeriods.length > 0
      ? workDayMinutes / 2
      : 0;
  const absentMinutes = Math.min(workDayMinutes, halfLeaveMinutes + recoveredMinutes);
  if (absentMinutes >= workDayMinutes) return { status: "absence" };
  if (absentMinutes > 0) {
    const recoveryMoments = new Set<HalfMoment>();
    let allRecoveryTimesAreLocated = dayRecovery.length > 0;
    for (const recovery of dayRecovery) {
      if (recovery.end && recovery.end <= "13:30") recoveryMoments.add("morning");
      else if (recovery.start && recovery.start >= "13:00") recoveryMoments.add("afternoon");
      else allRecoveryTimesAreLocated = false;
    }
    const recoveryMoment = recoveredMinutes >= workDayMinutes / 2
      && allRecoveryTimesAreLocated
      && recoveryMoments.size === 1
      ? [...recoveryMoments][0]
      : undefined;
    const halfMoment = recoveredMinutes === 0 && halfMoments.size === 1
      ? [...halfMoments][0]
      : halfLeaveMinutes === 0
        ? recoveryMoment
        : undefined;
    return { status: "partial", halfMoment, absentMinutes };
  }
  return { status: scheduled === "training" ? "training" : "work" };
}

export function workedDayCount(
  year: number,
  firstMonth: number,
  lastMonth: number,
  group: number,
  periods: LeavePeriod[],
  entries: Entries,
  recoveryUses: Array<{ date: string; minutes: number }> = [],
  workDayMinutes = 8 * 60,
  isExceptionallyClosed: (date: string) => boolean = () => false,
  exchangeRoleFor: (date: string) => "given" | "return" | "" = () => "",
) {
  let scheduled = 0;
  let onLeave = 0;
  let exceptionallyClosed = 0;
  let exchangedGiven = 0;
  let exchangedReturned = 0;
  for (let month = firstMonth; month <= lastMonth; month++)
    for (let day = 1; day <= monthDays(year, month); day++) {
      const date = localDate(year, month, day);
      const key = dateKey(date);
      const kind = getDayInfo(date, group).kind;
      const closureScheduled = isExceptionallyClosed(key);
      const presence = personalPresenceForDate(
        date, group, periods, entries, recoveryUses, workDayMinutes,
        isExceptionallyClosed,
      );
      if (kind !== "work") {
        if (!closureScheduled && exchangeRoleFor(key) === "return") exchangedReturned++;
        continue;
      }
      scheduled++;
      if (closureScheduled) {
        exceptionallyClosed++;
        continue;
      }
      if (exchangeRoleFor(key) === "given") {
        exchangedGiven++;
        continue;
      }
      if (presence.status === "absence") onLeave += 1;
      else if (presence.status === "partial")
        onLeave += Math.min(1, (presence.absentMinutes || workDayMinutes / 2) / workDayMinutes);
    }
  return {
    scheduled,
    onLeave,
    exceptionallyClosed,
    exchangedGiven,
    exchangedReturned,
    worked: scheduled - onLeave - exceptionallyClosed - exchangedGiven + exchangedReturned,
  };
}

/** Journées de travail encore prévues entre deux dates incluses. Toutes les
 * absences enregistrées conservent leur nature, mais produisent ici le même
 * effet : elles retirent la journée (ou la fraction de journée) du travail
 * restant. */
export function workedDayCountBetween(
  firstDate: Date,
  lastDate: Date,
  group: number,
  periods: LeavePeriod[],
  entries: Entries,
  recoveryUses: Array<{ date: string; minutes: number }> = [],
  workDayMinutes = 8 * 60,
  isExceptionallyClosed: (date: string) => boolean = () => false,
  exchangeRoleFor: (date: string) => "given" | "return" | "" = () => "",
) {
  let scheduled = 0;
  let onLeave = 0;
  let exceptionallyClosed = 0;
  let exchangedGiven = 0;
  let exchangedReturned = 0;
  let date = localDate(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
  const last = localDate(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  for (let guard = 0; date <= last && guard < 400; guard++, date = addDays(date, 1)) {
    const key = dateKey(date);
    const kind = getDayInfo(date, group).kind;
    const closureScheduled = isExceptionallyClosed(key);
    const presence = personalPresenceForDate(
      date, group, periods, entries, recoveryUses, workDayMinutes,
      isExceptionallyClosed,
    );
    if (kind !== "work") {
      if (!closureScheduled && exchangeRoleFor(key) === "return") exchangedReturned++;
      continue;
    }
    scheduled++;
    if (closureScheduled) {
      exceptionallyClosed++;
      continue;
    }
    if (exchangeRoleFor(key) === "given") {
      exchangedGiven++;
      continue;
    }
    if (presence.status === "absence") onLeave += 1;
    else if (presence.status === "partial")
      onLeave += Math.min(1, (presence.absentMinutes || workDayMinutes / 2) / workDayMinutes);
  }
  return {
    scheduled,
    onLeave,
    exceptionallyClosed,
    exchangedGiven,
    exchangedReturned,
    worked: scheduled - onLeave - exceptionallyClosed - exchangedGiven + exchangedReturned,
  };
}
