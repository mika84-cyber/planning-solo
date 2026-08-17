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
        if (/^20\d{2}$/.test(year) && values)
          payProfiles[year] = sanitizePayValues(values);
      }
    formProfile = {
      full_name: typeof raw.full_name === "string" ? raw.full_name.trim().slice(0, 120) : "",
      group: ["1", "2", "3"].includes(String(raw.group)) ? String(raw.group) : "",
      signature,
      status: raw.status === "contractuel" ? "contractuel" : "fonctionnaire",
      ...sanitizePayValues(raw),
      pay_profiles: payProfiles,
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
  return { backup: { entries, periods, form_profile: formProfile } };
}
