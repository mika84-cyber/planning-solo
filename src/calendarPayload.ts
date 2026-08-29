import type {
  Entries,
  FormProfile,
  LeavePeriod,
  ManualYearAdjustments,
  PayProfile,
} from "./appModel";
import { cetAccountFromApi } from "./cet";
import type { MecenatEntry } from "./mecenat";
import type { OvertimeEntry, RecoveryUse } from "./overtime";
import type { HalfMoment, HolidayPay, LeaveType } from "./planningLogic";

type JsonRecord = Record<string, unknown>;

const leaveTypes = new Set<LeaveType | "">([
  "annual", "rtt", "fraction", "half", "recovery", "sick", "strike",
  "cet", "other", "childcare", "exceptional", "",
]);
const halfMoments = new Set<HalfMoment | "">(["morning", "afternoon", ""]);
const holidayPays = new Set<HolidayPay | "">(["prime", "recovery", ""]);

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cents(value: unknown) {
  const amount = optionalFiniteNumber(value);
  return amount === undefined ? undefined : amount / 100;
}

function payProfileFromApi(value: unknown): PayProfile {
  const raw = record(value);
  return {
    baseSalary: cents(raw.base_salary_cents),
    residenceAllowance: cents(raw.residence_allowance_cents),
    ifse: cents(raw.ifse_cents),
    carenceDay: cents(raw.carence_cents),
    otherFixed: cents(raw.other_fixed_cents),
    cia: cents(raw.cia_cents),
    ciaMonth: optionalFiniteNumber(raw.cia_month),
    netRatioFixed: cents(raw.net_ratio_fixed_bp),
    netRatioVariable: cents(raw.net_ratio_variable_bp),
    netRatioRegime:
      raw.net_ratio_regime === "pre-culture-psc" || raw.net_ratio_regime === "culture-psc"
        ? raw.net_ratio_regime
        : undefined,
    navigo: cents(raw.navigo_cents),
    mealVoucherDeduction: cents(raw.meal_voucher_deduction_cents),
    pasRate: cents(raw.pas_rate_bp),
  };
}

function manualAdjustmentsFromApi(value: unknown) {
  const result: Record<string, ManualYearAdjustments> = {};
  for (const [year, candidate] of Object.entries(record(value))) {
    if (!/^\d{4}$/.test(year)) continue;
    const raw = record(candidate);
    const nonNegative = (field: unknown) => Math.max(0, finiteNumber(field));
    result[year] = {
      annualUsed: nonNegative(raw.annual_used),
      rttUsed: nonNegative(raw.rtt_used),
      fractionUsed: nonNegative(raw.fraction_used),
      sundayLeaveJanJun: nonNegative(raw.sunday_leave_jan_jun),
      sundayLeaveJulSep: nonNegative(raw.sunday_leave_jul_sep),
      sundayLeaveOctNov: nonNegative(raw.sunday_leave_oct_nov),
      sundayLeaveDec: nonNegative(raw.sunday_leave_dec),
    };
  }
  return result;
}

function formProfileFromApi(value: unknown): FormProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = record(value);
  return {
    fullName: text(raw.full_name),
    group: text(raw.group),
    signature: text(raw.signature),
    status: raw.status === "contractuel" ? "contractuel" : "fonctionnaire",
    workQuota:
      raw.work_quota === "half" || raw.work_quota === "three_quarters"
        ? raw.work_quota
        : "full",
    baseSalary: cents(raw.base_salary_cents),
    residenceAllowance: cents(raw.residence_allowance_cents),
    ifse: cents(raw.ifse_cents),
    carenceDay: cents(raw.carence_cents),
    otherFixed: cents(raw.other_fixed_cents),
    cia: cents(raw.cia_cents),
    ciaMonth: optionalFiniteNumber(raw.cia_month),
    netRatioFixed: cents(raw.net_ratio_fixed_bp),
    netRatioVariable: cents(raw.net_ratio_variable_bp),
    netRatioRegime:
      raw.net_ratio_regime === "pre-culture-psc" || raw.net_ratio_regime === "culture-psc"
        ? raw.net_ratio_regime
        : undefined,
    navigo: cents(raw.navigo_cents),
    mealVoucherDeduction: cents(raw.meal_voucher_deduction_cents),
    pasRate: cents(raw.pas_rate_bp),
    sundayCarryover: optionalFiniteNumber(raw.sunday_carryover),
    sundayCarryoverYear: optionalFiniteNumber(raw.sunday_carryover_year),
    sundayCarryoverMonth: optionalFiniteNumber(raw.sunday_carryover_month),
    sundayCarryoverFromYear: optionalFiniteNumber(raw.sunday_carryover_from_year),
    sundayCarryoverFromMonth: optionalFiniteNumber(raw.sunday_carryover_from_month),
    manualAdjustments: manualAdjustmentsFromApi(raw.manual_adjustments),
    cetAccount: cetAccountFromApi(raw.cet_account),
  };
}

function entriesFromApi(value: unknown): Entries {
  const result: Entries = {};
  for (const raw of records(value)) {
    const date = text(raw.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const holidayPay = holidayPays.has(raw.holiday_pay as HolidayPay)
      ? (raw.holiday_pay as HolidayPay)
      : "";
    result[date] = {
      noteText: text(raw.note_text),
      noteColor: text(raw.note_color, "#D3943D"),
      noteUpdatedAt: text(raw.note_updated_at),
      noteGroupId: text(raw.note_group_id),
      leave: raw.leave === true,
      wish: raw.wish === true,
      holidayPay,
      closureOverride:
        raw.closure_override === "closed" || raw.closure_override === "open"
          ? raw.closure_override
          : "",
      updatedAt: text(raw.updated_at),
    };
  }
  return result;
}

function periodsFromApi(value: unknown): LeavePeriod[] {
  return records(value).flatMap((raw) => {
    const id = text(raw.id);
    const from = text(raw.from);
    const to = text(raw.to);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      return [];
    const leaveType = leaveTypes.has(raw.leave_type as LeaveType)
      ? (raw.leave_type as LeaveType)
      : "";
    const halfMoment = halfMoments.has(raw.half_moment as HalfMoment)
      ? (raw.half_moment as HalfMoment)
      : "";
    return [{
      id,
      from,
      to,
      leaveType,
      halfMoment,
      group: optionalFiniteNumber(raw.group),
      updatedAt: text(raw.updated_at),
    }];
  });
}

function overtimeFromApi(value: unknown): OvertimeEntry[] {
  return records(value).flatMap((raw) => {
    const id = text(raw.id);
    const date = text(raw.date);
    if (!id || !date) return [];
    return [{
      id,
      date,
      minutes: finiteNumber(raw.minutes),
      dayMinutes: finiteNumber(raw.day_minutes),
      nightMinutes: finiteNumber(raw.night_minutes),
      disposition: raw.disposition === "paid" ? "paid" : "recovery",
      inputMode: raw.input_mode === "range" ? "range" : "duration",
      start: text(raw.start) || undefined,
      end: text(raw.end) || undefined,
      updatedAt: text(raw.updated_at),
    }];
  });
}

function recoveryUsesFromApi(value: unknown): RecoveryUse[] {
  return records(value).flatMap((raw) => {
    const id = text(raw.id);
    const date = text(raw.date);
    if (!id || !date) return [];
    return [{
      id,
      date,
      minutes: finiteNumber(raw.minutes),
      start: text(raw.start) || undefined,
      end: text(raw.end) || undefined,
      kind: raw.kind === "training" ? "training" : undefined,
      updatedAt: text(raw.updated_at),
    }];
  });
}

function mecenatFromApi(value: unknown): MecenatEntry[] {
  return records(value).flatMap((raw) => {
    const id = text(raw.id);
    const date = text(raw.date);
    if (!id || !date) return [];
    return [{
      id,
      date,
      start: text(raw.start),
      end: text(raw.end),
      dayMinutes: finiteNumber(raw.day_minutes),
      nightMinutes: finiteNumber(raw.night_minutes),
      grossAmountCents: finiteNumber(raw.gross_amount_cents),
      payYear: finiteNumber(raw.pay_year),
      payMonth: finiteNumber(raw.pay_month),
      updatedAt: text(raw.updated_at),
    }];
  });
}

export type CalendarSnapshot = {
  email: string;
  entries: Entries;
  periods: LeavePeriod[];
  formProfile: FormProfile | null;
  payProfiles: Record<string, PayProfile>;
  overtimeEntries: OvertimeEntry[];
  recoveryUses: RecoveryUse[];
  mecenatEntries: MecenatEntry[];
};

/** Transforme la réponse réseau non fiable en données métier strictes. Les
 * lignes incomplètes sont ignorées plutôt que de contaminer l’état React. */
export function parseCalendarSnapshot(value: unknown): CalendarSnapshot {
  const raw = record(value);
  const rawProfile = record(raw.form_profile);
  const payProfiles = Object.fromEntries(
    Object.entries(record(rawProfile.pay_profiles)).map(([year, profile]) => [
      year,
      payProfileFromApi(profile),
    ]),
  );
  return {
    email: text(raw.email, "Compte connecté"),
    entries: entriesFromApi(raw.entries),
    periods: periodsFromApi(raw.periods),
    formProfile: formProfileFromApi(raw.form_profile),
    payProfiles,
    overtimeEntries: overtimeFromApi(raw.overtime_entries),
    recoveryUses: recoveryUsesFromApi(raw.recovery_uses),
    mecenatEntries: mecenatFromApi(raw.mecenat_entries),
  };
}
