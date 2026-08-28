import { isValidDateKey } from "./calendarValidation.mts";

const ID_RE = /^[a-zA-Z0-9-]{8,80}$/;
const COLORS = new Set(["#D3943D", "#7358d8", "#2878b8", "#268b69", "#d57928"]);
const LEAVE_TYPES = new Set([
  "",
  "annual",
  "rtt",
  "fraction",
  "half",
  "recovery",
  "sick",
  "cet",
  "other",
  "strike",
  "childcare",
  "exceptional",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalNumber(value: unknown, maximum = 100_000_000) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    ? Math.round(value)
    : undefined;
}

function sanitizePayValues(raw: Record<string, unknown>) {
  return {
    base_salary_cents: optionalNumber(raw.base_salary_cents),
    residence_allowance_cents: optionalNumber(raw.residence_allowance_cents),
    ifse_cents: optionalNumber(raw.ifse_cents),
    carence_cents: optionalNumber(raw.carence_cents),
    other_fixed_cents: optionalNumber(raw.other_fixed_cents),
    cia_cents: optionalNumber(raw.cia_cents),
    cia_month: [6, 7, 8].includes(Number(raw.cia_month))
      ? Number(raw.cia_month)
      : undefined,
    net_ratio_fixed_bp: optionalNumber(raw.net_ratio_fixed_bp, 10_000),
    net_ratio_variable_bp: optionalNumber(raw.net_ratio_variable_bp, 10_000),
    navigo_cents: optionalNumber(raw.navigo_cents),
    meal_voucher_deduction_cents: optionalNumber(
      raw.meal_voucher_deduction_cents,
    ),
    pas_rate_bp: optionalNumber(raw.pas_rate_bp, 10_000),
  };
}

export function sanitizeCalendarBackup(value: unknown) {
  const backup = record(value);
  if (!backup || backup.version !== 1)
    return { error: "Format de sauvegarde non reconnu" as const };
  if (!Array.isArray(backup.entries) || backup.entries.length > 5_000)
    return { error: "Liste de journées invalide" as const };
  if (!Array.isArray(backup.periods) || backup.periods.length > 1_000)
    return { error: "Liste de périodes invalide" as const };
  const rawOvertime = backup.overtime_entries ?? [];
  const rawRecoveryUses = backup.recovery_uses ?? [];
  const rawMecenat = backup.mecenat_entries ?? [];
  if (!Array.isArray(rawOvertime) || rawOvertime.length > 5_000)
    return { error: "Liste d’heures supplémentaires invalide" as const };
  if (!Array.isArray(rawRecoveryUses) || rawRecoveryUses.length > 5_000)
    return { error: "Liste de récupérations invalide" as const };
  if (!Array.isArray(rawMecenat) || rawMecenat.length > 5_000)
    return { error: "Liste de mécénats invalide" as const };

  const entries = [];
  const entryDates = new Set<string>();
  for (const candidate of backup.entries) {
    const item = record(candidate);
    if (!item || !isValidDateKey(item.date) || entryDates.has(item.date))
      return { error: "Journée invalide dans la sauvegarde" as const };
    entryDates.add(item.date);
    const noteText = typeof item.note_text === "string" ? item.note_text.trim().slice(0, 300) : "";
    const noteColor = typeof item.note_color === "string" && COLORS.has(item.note_color)
      ? item.note_color
      : "#D3943D";
    entries.push({
      date: item.date,
      note_text: noteText,
      note_color: noteColor,
      note_updated_at:
        typeof item.note_updated_at === "string" ? item.note_updated_at : "",
      note_group_id:
        typeof item.note_group_id === "string" && ID_RE.test(item.note_group_id)
          ? item.note_group_id
          : "",
      leave: item.leave === true,
      wish: item.wish === true,
      holiday_pay:
        item.holiday_pay === "prime" || item.holiday_pay === "recovery"
          ? item.holiday_pay
          : "",
      closure_override:
        item.closure_override === "closed" || item.closure_override === "open"
          ? item.closure_override
          : "",
      updated_at:
        typeof item.updated_at === "string"
          ? item.updated_at
          : new Date().toISOString(),
    });
  }

  const periods = [];
  const periodIds = new Set<string>();
  for (const candidate of backup.periods) {
    const item = record(candidate);
    if (
      !item ||
      typeof item.id !== "string" ||
      !ID_RE.test(item.id) ||
      periodIds.has(item.id) ||
      !isValidDateKey(item.from) ||
      !isValidDateKey(item.to) ||
      item.to < item.from ||
      !LEAVE_TYPES.has(String(item.leave_type || ""))
    )
      return { error: "Période invalide dans la sauvegarde" as const };
    periodIds.add(item.id);
    periods.push({
      id: item.id,
      from: item.from,
      to: item.to,
      leave_type: String(item.leave_type || ""),
      half_moment:
        item.leave_type === "half" &&
        (item.half_moment === "morning" || item.half_moment === "afternoon")
          ? item.half_moment
          : "",
      group: [1, 2, 3].includes(Number(item.group)) ? Number(item.group) : undefined,
      updated_at:
        typeof item.updated_at === "string"
          ? item.updated_at
          : new Date().toISOString(),
    });
  }

  const overtimeEntries = [];
  const overtimeIds = new Set<string>();
  for (const candidate of rawOvertime) {
    const item = record(candidate);
    if (
      !item ||
      typeof item.id !== "string" ||
      !ID_RE.test(item.id) ||
      overtimeIds.has(item.id) ||
      !isValidDateKey(item.date) ||
      (item.disposition !== "paid" && item.disposition !== "recovery") ||
      (item.input_mode !== "range" && item.input_mode !== "duration")
    )
      return { error: "Heure supplémentaire invalide dans la sauvegarde" as const };
    const minutes = optionalNumber(item.minutes, 24 * 60);
    const dayMinutes = optionalNumber(item.day_minutes, 24 * 60);
    const nightMinutes = optionalNumber(item.night_minutes, 24 * 60);
    if (
      !minutes ||
      dayMinutes === undefined ||
      nightMinutes === undefined ||
      dayMinutes + nightMinutes !== minutes
    )
      return { error: "Durée supplémentaire invalide dans la sauvegarde" as const };
    overtimeIds.add(item.id);
    overtimeEntries.push({
      id: item.id,
      date: item.date,
      minutes,
      day_minutes: dayMinutes,
      night_minutes: nightMinutes,
      disposition: item.disposition,
      input_mode: item.input_mode,
      start: typeof item.start === "string" ? item.start : "",
      end: typeof item.end === "string" ? item.end : "",
      updated_at: typeof item.updated_at === "string" ? item.updated_at : new Date().toISOString(),
    });
  }

  const recoveryUses = [];
  const recoveryIds = new Set<string>();
  for (const candidate of rawRecoveryUses) {
    const item = record(candidate);
    if (
      !item ||
      typeof item.id !== "string" ||
      !ID_RE.test(item.id) ||
      recoveryIds.has(item.id) ||
      !isValidDateKey(item.date)
    )
      return { error: "Utilisation de récupération invalide dans la sauvegarde" as const };
    const minutes = optionalNumber(item.minutes, 24 * 60);
    if (!minutes)
      return { error: "Durée de récupération invalide dans la sauvegarde" as const };
    recoveryIds.add(item.id);
    recoveryUses.push({
      id: item.id,
      date: item.date,
      minutes,
      start: typeof item.start === "string" ? item.start : "",
      end: typeof item.end === "string" ? item.end : "",
      kind: item.kind === "training" ? "training" : "",
      updated_at: typeof item.updated_at === "string" ? item.updated_at : new Date().toISOString(),
    });
  }

  const mecenatEntries = [];
  const mecenatIds = new Set<string>();
  for (const candidate of rawMecenat) {
    const item = record(candidate);
    const dayMinutes = item ? optionalNumber(item.day_minutes, 24 * 60) : undefined;
    const nightMinutes = item ? optionalNumber(item.night_minutes, 24 * 60) : undefined;
    const grossAmountCents = item
      ? optionalNumber(item.gross_amount_cents, 10_000_000)
      : undefined;
    if (
      !item ||
      typeof item.id !== "string" ||
      !ID_RE.test(item.id) ||
      mecenatIds.has(item.id) ||
      !isValidDateKey(item.date) ||
      typeof item.start !== "string" ||
      typeof item.end !== "string" ||
      !/^\d{2}:\d{2}$/.test(item.start) ||
      !/^\d{2}:\d{2}$/.test(item.end) ||
      dayMinutes === undefined ||
      nightMinutes === undefined ||
      dayMinutes + nightMinutes < 1 ||
      dayMinutes + nightMinutes > 24 * 60 ||
      grossAmountCents === undefined ||
      !Number.isInteger(Number(item.pay_year)) ||
      Number(item.pay_year) < 2000 ||
      Number(item.pay_year) > 2100 ||
      !Number.isInteger(Number(item.pay_month)) ||
      Number(item.pay_month) < 0 ||
      Number(item.pay_month) > 11
    )
      return { error: "Mécénat invalide dans la sauvegarde" as const };
    mecenatIds.add(item.id);
    mecenatEntries.push({
      id: item.id,
      date: item.date,
      start: item.start,
      end: item.end,
      day_minutes: dayMinutes,
      night_minutes: nightMinutes,
      gross_amount_cents: grossAmountCents,
      pay_year: Number(item.pay_year),
      pay_month: Number(item.pay_month),
      updated_at:
        typeof item.updated_at === "string"
          ? item.updated_at
          : new Date().toISOString(),
    });
  }

  let formProfile = null;
  if (backup.form_profile !== null && backup.form_profile !== undefined) {
    const raw = record(backup.form_profile);
    if (!raw) return { error: "Profil invalide dans la sauvegarde" as const };
    const signature = typeof raw.signature === "string" ? raw.signature : "";
    if (
      signature &&
      (!signature.startsWith("data:image/png;base64,") || signature.length > 600_000)
    )
      return { error: "Signature invalide dans la sauvegarde" as const };
    const payProfiles: Record<string, ReturnType<typeof sanitizePayValues>> = {};
    const rawProfiles = record(raw.pay_profiles);
    if (rawProfiles)
      for (const [year, profile] of Object.entries(rawProfiles)) {
        const values = record(profile);
        if (/^20\d{2}(?:-(?:0[1-9]|1[0-2]))?$/.test(year) && values)
          payProfiles[year] = sanitizePayValues(values);
      }
    const manualAdjustments: Record<string, Record<string, number>> = {};
    const rawManualAdjustments = record(raw.manual_adjustments);
    const halfDay = (value: unknown, maximum: number) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0 &&
      value <= maximum && Number.isInteger(value * 2)
        ? value
        : 0;
    const sundayCount = (value: unknown) =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 53
        ? value
        : 0;
    if (rawManualAdjustments)
      for (const [year, adjustment] of Object.entries(rawManualAdjustments)) {
        const values = record(adjustment);
        if (!/^20\d{2}$/.test(year) || !values) continue;
        manualAdjustments[year] = {
          annual_used: halfDay(values.annual_used, 29),
          rtt_used: halfDay(values.rtt_used, 15),
          fraction_used: halfDay(values.fraction_used, 2),
          sunday_leave_jan_jun: sundayCount(values.sunday_leave_jan_jun),
          sunday_leave_jul_sep: sundayCount(values.sunday_leave_jul_sep),
          sunday_leave_oct_nov: sundayCount(values.sunday_leave_oct_nov),
          sunday_leave_dec: sundayCount(values.sunday_leave_dec),
        };
      }
    const cetAccount =
      raw.cet_account === undefined
        ? undefined
        : sanitizeCetStoredAccount(raw.cet_account);
    if (raw.cet_account !== undefined && !cetAccount)
      return { error: "Compte épargne-temps invalide dans la sauvegarde" as const };
    formProfile = {
      full_name: typeof raw.full_name === "string" ? raw.full_name.trim().slice(0, 120) : "",
      group: ["1", "2", "3"].includes(String(raw.group)) ? String(raw.group) : "",
      work_quota:
        raw.work_quota === "half" || raw.work_quota === "three_quarters"
          ? raw.work_quota
          : "full",
      signature,
      status: raw.status === "fonctionnaire" ? "fonctionnaire" : "contractuel",
      ...sanitizePayValues(raw),
      pay_profiles: payProfiles,
      manual_adjustments: manualAdjustments,
      cet_account: cetAccount,
      sunday_carryover: optionalNumber(raw.sunday_carryover, 100),
      sunday_carryover_year: optionalNumber(raw.sunday_carryover_year, 2100),
      sunday_carryover_month: optionalNumber(raw.sunday_carryover_month, 11),
      sunday_carryover_from_year: optionalNumber(
        raw.sunday_carryover_from_year,
        2100,
      ),
      sunday_carryover_from_month: optionalNumber(
        raw.sunday_carryover_from_month,
        11,
      ),
      updated_at: new Date().toISOString(),
    };
  }
  return {
    backup: {
      entries,
      periods,
      overtime_entries: overtimeEntries,
      recovery_uses: recoveryUses,
      mecenat_entries: mecenatEntries,
      form_profile: formProfile,
    },
  };
}

function sanitizeCetStoredAccount(value: unknown) {
  const raw = record(value);
  if (!raw) return null;
  const workRules = new Set([
    "administrative", "night_security", "day_security", "fire_12h", "fire_24h",
    "visitor_service", "gtb_day", "gtb_night", "nurse", "audiovisual_operations",
    "visitor_service_assistant", "cashier", "pass_office", "room_management",
    "president_driver", "part_time_90", "part_time_80", "part_time_70",
    "part_time_60", "part_time_50",
  ]);
  if (
    (raw.employer !== "ministry" && raw.employer !== "public-establishment") ||
    (raw.category !== "A" && raw.category !== "B" && raw.category !== "C") ||
    !Number.isInteger(raw.initial_balance) ||
    Number(raw.initial_balance) < 0 ||
    Number(raw.initial_balance) > 200 ||
    !Array.isArray(raw.operations) ||
    raw.operations.length > 500
  )
    return null;
  const openedOn = typeof raw.opened_on === "string" ? raw.opened_on : "";
  if (openedOn && !isValidDateKey(openedOn)) return null;
  const ids = new Set<string>();
  const operations = [];
  for (const candidate of raw.operations) {
    const operation = record(candidate);
    if (!operation) return null;
    const id = typeof operation.id === "string" ? operation.id.slice(0, 100) : "";
    const kind = operation.kind;
    const days = Number(operation.days);
    const source =
      operation.source === "annual" || operation.source === "rtt" || operation.source === "fraction"
        ? operation.source
        : undefined;
    if (
      !id || ids.has(id) || !isValidDateKey(operation.date) ||
      (kind !== "deposit" && kind !== "leave" && kind !== "indemnity" && kind !== "rafp" && kind !== "adjustment") ||
      !Number.isInteger(days) || days === 0 || Math.abs(days) > 200 ||
      (kind !== "adjustment" && days < 0) || (kind === "deposit" && !source)
    )
      return null;
    ids.add(id);
    operations.push({
      id,
      date: operation.date,
      kind,
      days,
      source: kind === "deposit" ? source : undefined,
      note: typeof operation.note === "string" ? operation.note.trim().slice(0, 120) || undefined : undefined,
    });
  }
  return {
    enabled: raw.enabled !== false,
    employer: raw.employer,
    employer_name: typeof raw.employer_name === "string" ? raw.employer_name.trim().slice(0, 120) : "",
    category: raw.category,
    work_rule: workRules.has(String(raw.work_rule)) ? String(raw.work_rule) : "visitor_service",
    has_one_year_service: raw.has_one_year_service === true,
    is_trainee: raw.is_trainee === true,
    opened_on: openedOn,
    initial_balance: Number(raw.initial_balance),
    legacy_cap_70: raw.legacy_cap_70 === true,
    operations,
  };
}
