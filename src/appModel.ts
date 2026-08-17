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

export type ViewMode = "month" | "year";
export type RequestKind = "leave" | "recovery";
export type BalanceType = "annual" | "rtt" | "fraction";
export type AuthStatus = "loading" | "guest" | "invite" | "ready";

export type SharedEntry = {
  noteText: string;
  noteColor: string;
  noteUpdatedAt: string;
  noteGroupId: string;
  leave: boolean;
  wish: boolean;
  holidayPay: HolidayPay | "";
};
export type Entries = Record<string, SharedEntry>;
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
export type FormProfile = {
  fullName: string;
  group: string;
  signature: string;
  status?: PayStatus;
  baseSalary?: number;
  ifse?: number;
  carenceDay?: number;
  otherFixed?: number;
  cia?: number;
  ciaMonth?: number;
  netRatioFixed?: number;
  netRatioVariable?: number;
  navigo?: number;
  mealVoucherDeduction?: number;
  pasRate?: number;
  sundayCarryover?: number;
  sundayCarryoverYear?: number;
  sundayCarryoverMonth?: number;
  sundayCarryoverFromYear?: number;
  sundayCarryoverFromMonth?: number;
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
};

export const HOLIDAY_PAY_OPTIONS: Array<{
  value: HolidayPay | "";
  label: string;
}> = [
  { value: "prime", label: "Prime seule" },
  { value: "recovery", label: "Prime + 1 jour de récup" },
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

export function workedDayCount(
  year: number,
  firstMonth: number,
  lastMonth: number,
  group: number,
  periods: LeavePeriod[],
  entries: Entries,
) {
  let scheduled = 0;
  let onLeave = 0;
  for (let month = firstMonth; month <= lastMonth; month++)
    for (let day = 1; day <= monthDays(year, month); day++) {
      const date = localDate(year, month, day);
      if (getDayInfo(date, group).kind !== "work") continue;
      scheduled++;
      const key = dateKey(date);
      const period = periods.find(
        (item) => key >= item.from && key <= item.to,
      );
      if (period) onLeave += period.leaveType === "half" ? 0.5 : 1;
      else if (entries[key]?.leave) onLeave += 1;
    }
  return { scheduled, onLeave, worked: scheduled - onLeave };
}
