import { getStore } from "@netlify/blobs";
import { isValidDateKey } from "./calendarValidation.mts";

export const COLORS = new Set(["#D3943D", "#7358d8", "#2878b8", "#268b69", "#d57928"]);
export type LeaveType =
  | "annual"
  | "rtt"
  | "fraction"
  | "half"
  | "recovery"
  | "sick"
  | "strike"
  | "cet"
  | "other"
  | "childcare"
  | "exceptional"
  | "";
/** Moitié de journée posée, pour les seules demi-journées. */
export type HalfMoment = "morning" | "afternoon" | "";
/** Compensation d'un jour férié travaillé : prime seule, ou prime minorée
 *  plus un jour de récupération. */
export type HolidayPay = "prime" | "recovery" | "";
export type CalendarEntry = {
  date: string;
  note_text: string;
  note_color: string;
  note_updated_at?: string;
  note_group_id?: string;
  leave: boolean;
  /** Congé souhaité, pas encore validé par l'administration : visible sur le
   *  planning, sans effet sur le solde. */
  wish?: boolean;
  /** Sur un jour férié travaillé : la prime seule, ou la prime minorée
   *  assortie d'un jour de récupération. Vide tant que le choix n'est pas
   *  fait — le férié est alors signalé comme en attente. */
  holiday_pay?: HolidayPay;
  closure_override?: "closed" | "open";
  updated_at: string;
};
export type LeavePeriod = {
  id: string;
  from: string;
  to: string;
  leave_type?: LeaveType;
  /** Renseigné seulement quand `leave_type` vaut « half ». */
  half_moment?: HalfMoment;
  group?: number;
  updated_at: string;
};
export type PayProfileValues = {
  base_salary_cents?: number;
  residence_allowance_cents?: number;
  ifse_cents?: number;
  carence_cents?: number;
  other_fixed_cents?: number;
  cia_cents?: number;
  cia_month?: number;
  net_ratio_fixed_bp?: number;
  net_ratio_variable_bp?: number;
  net_ratio_regime?: "pre-culture-psc" | "culture-psc";
  navigo_cents?: number;
  meal_voucher_deduction_cents?: number;
  pas_rate_bp?: number;
};
export type ManualYearAdjustments = {
  annual_used: number;
  rtt_used: number;
  fraction_used: number;
  sunday_leave_jan_jun: number;
  sunday_leave_jul_sep: number;
  sunday_leave_oct_nov: number;
  sunday_leave_dec: number;
};
export type CetStoredAccount = {
  enabled: boolean;
  employer: "ministry" | "public-establishment";
  employer_name: string;
  category: "A" | "B" | "C";
  work_rule: string;
  has_one_year_service: boolean;
  is_trainee: boolean;
  opened_on: string;
  initial_balance: number;
  legacy_cap_70: boolean;
  operations: Array<{
    id: string;
    date: string;
    kind: "deposit" | "leave" | "indemnity" | "rafp" | "adjustment";
    days: number;
    source?: "annual" | "rtt" | "fraction";
    note?: string;
  }>;
};

const CET_WORK_RULES = new Set([
  "administrative", "night_security", "day_security", "fire_12h", "fire_24h",
  "visitor_service", "gtb_day", "gtb_night", "nurse", "audiovisual_operations",
  "visitor_service_assistant", "cashier", "pass_office", "room_management",
  "president_driver", "part_time_90", "part_time_80", "part_time_70",
  "part_time_60", "part_time_50",
]);
export type FormProfile = {
  full_name: string;
  group: string;
  signature: string;
  /** Absent sur les profils créés avant l'ajout de ce champ : traité comme
   *  « fonctionnaire », le statut jusque-là implicite de l'appli. */
  status?: "fonctionnaire" | "contractuel";
  work_quota?: "full" | "three_quarters" | "half";
  /** Traitement de base mensuel, hors primes : il sert à calculer les
   *  indemnités de jour férié, qui en sont un multiple. Stocké en centimes
   *  pour éviter les arrondis flottants. */
  base_salary_cents?: number;
  residence_allowance_cents?: number;
  /** Régime indemnitaire mensuel : seconde assiette de la retenue maladie. */
  ifse_cents?: number;
  /** Montant d'un jour de carence, relevé sur le bulletin. */
  carence_cents?: number;
  /** Somme des éléments fixes hors traitement et IFSE : indemnité de
   *  résidence, ICHCSG, aide MGEN, transfert primes/points. */
  other_fixed_cents?: number;
  /** Complément indemnitaire annuel : prime unique, versée une fois par an en
   *  juillet ou en août selon les années. */
  cia_cents?: number;
  /** Mois de versement du CIA cette année-là. */
  cia_month?: number;
  /** Taux net/brut, en points de base (7737 = 77,37 %), à calibrer sur ses
   *  propres bulletins plutôt que calculés cotisation par cotisation. Deux
   *  taux : le traitement/IFSE porte la pension civile, les primes n'y sont
   *  pas soumises et gardent une part bien plus grande. */
  net_ratio_fixed_bp?: number;
  net_ratio_variable_bp?: number;
  net_ratio_regime?: "pre-culture-psc" | "culture-psc";
  /** Remboursement transport et retenue titres repas, en centimes : hors
   *  cumul brut, des montants fixes plutôt qu'un ratio. */
  navigo_cents?: number;
  meal_voucher_deduction_cents?: number;
  /** Taux du prélèvement à la source, en points de base, recopié du
   *  bulletin — à part des deux taux ci-dessus pour rester à jour sans
   *  recalibration si l'impôt change. */
  pas_rate_bp?: number;
  /** Dimanches manquants sur un bulletin, reportés sur le prochain mois de
   *  versement — la paie a un délai de traitement, un dimanche travaillé en
   *  fin de période peut n'apparaître que sur le rappel suivant. */
  sunday_carryover?: number;
  sunday_carryover_year?: number;
  sunday_carryover_month?: number;
  /** Le bulletin d'où vient le report : sa propre ligne doit refléter ce qui
   *  a été réellement payé, pas ce que le cycle laissait attendre. */
  sunday_carryover_from_year?: number;
  sunday_carryover_from_month?: number;
  /** Valeurs de paie historisées par année d'effet. Les champs historiques
   *  ci-dessus restent le repli des profils créés avant cette évolution. */
  pay_profiles?: Record<string, PayProfileValues>;
  manual_adjustments?: Record<string, ManualYearAdjustments>;
  cet_account?: CetStoredAccount;
  updated_at: string;
};

export function sanitizeCetAccount(value: unknown): CetStoredAccount | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    raw.employer !== "ministry" &&
    raw.employer !== "public-establishment"
  )
    return null;
  if (raw.category !== "A" && raw.category !== "B" && raw.category !== "C")
    return null;
  if (!CET_WORK_RULES.has(String(raw.workRule))) return null;
  const initialBalance = Number(raw.initialBalance);
  if (
    !Number.isInteger(initialBalance) ||
    initialBalance < 0 ||
    initialBalance > 200
  )
    return null;
  const openedOn = typeof raw.openedOn === "string" ? raw.openedOn : "";
  if (openedOn && !isValidDateKey(openedOn)) return null;
  if (!Array.isArray(raw.operations) || raw.operations.length > 500) return null;
  const ids = new Set<string>();
  const operations: CetStoredAccount["operations"] = [];
  for (const candidate of raw.operations) {
    if (!candidate || typeof candidate !== "object") return null;
    const operation = candidate as Record<string, unknown>;
    const id = typeof operation.id === "string" ? operation.id.slice(0, 100) : "";
    const date = typeof operation.date === "string" ? operation.date : "";
    const kind = operation.kind;
    const days = Number(operation.days);
    if (
      !id ||
      ids.has(id) ||
      !isValidDateKey(date) ||
      (kind !== "deposit" &&
        kind !== "leave" &&
        kind !== "indemnity" &&
        kind !== "rafp" &&
        kind !== "adjustment") ||
      !Number.isInteger(days) ||
      days === 0 ||
      Math.abs(days) > 200 ||
      (kind !== "adjustment" && days < 0)
    )
      return null;
    const source =
      operation.source === "annual" ||
      operation.source === "rtt" ||
      operation.source === "fraction"
        ? operation.source
        : undefined;
    if (kind === "deposit" && !source) return null;
    ids.add(id);
    operations.push({
      id,
      date,
      kind,
      days,
      source: kind === "deposit" ? source : undefined,
      note:
        typeof operation.note === "string"
          ? operation.note.trim().slice(0, 120) || undefined
          : undefined,
    });
  }
  return {
    enabled: raw.enabled !== false,
    employer: raw.employer,
    employer_name:
      typeof raw.employerName === "string"
        ? raw.employerName.trim().slice(0, 120)
        : "",
    category: raw.category,
    work_rule: String(raw.workRule),
    has_one_year_service: raw.hasOneYearService === true,
    is_trainee: raw.isTrainee === true,
    opened_on: openedOn,
    initial_balance: initialBalance,
    legacy_cap_70: raw.legacyCap70 === true,
    operations,
  };
}
export type OvertimeEntry = {
  id: string;
  date: string;
  minutes: number;
  day_minutes: number;
  night_minutes: number;
  disposition: "paid" | "recovery";
  input_mode: "range" | "duration";
  start?: string;
  end?: string;
  updated_at: string;
};
export type RecoveryUse = {
  id: string;
  date: string;
  minutes: number;
  start?: string;
  end?: string;
  kind?: "training" | "";
  updated_at: string;
};
export type MecenatEntry = {
  id: string;
  date: string;
  start: string;
  end: string;
  day_minutes: number;
  night_minutes: number;
  gross_amount_cents: number;
  pay_year: number;
  pay_month: number;
  updated_at: string;
};
/** Le choix de compensation d'un férié travaillé.
 *
 *  Absent du corps de la requête, il n'est pas touché : les écritures qui ne
 *  concernent pas le férié (pose d'un congé sur plusieurs dates, note) ne
 *  doivent pas effacer un choix déjà fait. Présent mais non reconnu, il repasse
 *  en attente.
 */
export function holidayPayFrom(
  body: Record<string, unknown>,
  previous: HolidayPay | undefined,
): HolidayPay | undefined {
  if (body.holidayPay === undefined) return previous;
  return body.holidayPay === "prime" || body.holidayPay === "recovery"
    ? body.holidayPay
    : "";
}
const headers = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
export function validId(value: string) {
  return /^[a-zA-Z0-9-]{8,80}$/.test(value);
}
export function rangeSpan(from: string, to: string) {
  return (
    Math.floor(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000,
    ) + 1
  );
}
export function dateKeys(from: string, to: string) {
  const keys: string[] = [];
  for (
    let timestamp = Date.parse(`${from}T12:00:00Z`);
    timestamp <= Date.parse(`${to}T12:00:00Z`);
    timestamp += 86400000
  )
    keys.push(new Date(timestamp).toISOString().slice(0, 10));
  return keys;
}
export async function listBlobs(
  store: ReturnType<typeof getStore>,
  prefix: string,
) {
  const blobs: Array<{ key: string }> = [];
  for await (const page of store.list({ prefix, paginate: true }))
    blobs.push(...page.blobs);
  return { blobs };
}
export async function clearNote(
  store: ReturnType<typeof getStore>,
  key: string,
  entry: CalendarEntry,
) {
  const next: CalendarEntry = {
    ...entry,
    note_text: "",
    note_updated_at: "",
    note_group_id: "",
    updated_at: new Date().toISOString(),
  };
  if (!next.leave && !next.wish && !next.holiday_pay && !next.closure_override)
    await store.delete(key);
  else await store.setJSON(key, next);
}
