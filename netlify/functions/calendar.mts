import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import {
  LEGACY_OWNER_KEY,
  migrateLegacyData,
  userDataKey,
} from "../lib/userScopedStore.mts";
import {
  isValidDateKey,
  normalizeBulkPeriods,
  readCalendarBody,
} from "../lib/calendarValidation.mts";
import { sanitizeCalendarBackup } from "../lib/calendarBackup.mts";
import { calculateRegulatoryMecenatVacation } from "../../src/mecenatRegulation.ts";
import { LeaveRequestValidationError, normalizeLeaveRequest } from "../../src/leaveRequest.ts";
import {
  holidayRecoveryCreditMinutes,
  nextPayPeriod,
  recoveryRequestMinutes,
} from "../../src/overtime.ts";

const COLORS = new Set(["#D3943D", "#7358d8", "#2878b8", "#268b69", "#d57928"]);
type LeaveType =
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
type HalfMoment = "morning" | "afternoon" | "";
/** Compensation d'un jour férié travaillé : prime seule, ou prime minorée
 *  plus un jour de récupération. */
type HolidayPay = "prime" | "recovery" | "";
type CalendarEntry = {
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
type LeavePeriod = {
  id: string;
  from: string;
  to: string;
  leave_type?: LeaveType;
  /** Renseigné seulement quand `leave_type` vaut « half ». */
  half_moment?: HalfMoment;
  group?: number;
  updated_at: string;
};
type PayProfileValues = {
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
type ManualYearAdjustments = {
  annual_used: number;
  rtt_used: number;
  fraction_used: number;
  sunday_leave_jan_jun: number;
  sunday_leave_jul_sep: number;
  sunday_leave_oct_nov: number;
  sunday_leave_dec: number;
};
type CetStoredAccount = {
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
type FormProfile = {
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

function sanitizeCetAccount(value: unknown): CetStoredAccount | null {
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
type OvertimeEntry = {
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
type RecoveryUse = {
  id: string;
  date: string;
  minutes: number;
  start?: string;
  end?: string;
  kind?: "training" | "";
  updated_at: string;
};
type MecenatEntry = {
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
function holidayPayFrom(
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
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
function validId(value: string) {
  return /^[a-zA-Z0-9-]{8,80}$/.test(value);
}
function rangeSpan(from: string, to: string) {
  return (
    Math.floor(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000,
    ) + 1
  );
}
function dateKeys(from: string, to: string) {
  const keys: string[] = [];
  for (
    let timestamp = Date.parse(`${from}T12:00:00Z`);
    timestamp <= Date.parse(`${to}T12:00:00Z`);
    timestamp += 86400000
  )
    keys.push(new Date(timestamp).toISOString().slice(0, 10));
  return keys;
}
async function listBlobs(
  store: ReturnType<typeof getStore>,
  prefix: string,
) {
  const blobs: Array<{ key: string }> = [];
  for await (const page of store.list({ prefix, paginate: true }))
    blobs.push(...page.blobs);
  return { blobs };
}
async function clearNote(
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
async function calendarHandler(request: Request): Promise<Response> {
  if (!isTrustedMutation(request))
    return json({ error: "Origine de la requête non autorisée" }, 403);
  const user = await getUser();
  if (!user?.id || !user.email)
    return json({ error: "Connexion requise" }, 401);
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  await migrateLegacyData(store, user.id);
  const scopedKey = (key: string) => userDataKey(user.id, key);
  const entryPrefix = scopedKey("entry/");
  const periodPrefix = scopedKey("period/");
  const overtimePrefix = scopedKey("overtime/");
  const recoveryUsePrefix = scopedKey("recovery-use/");
  const mecenatPrefix = scopedKey("mecenat/");
  if (request.method === "GET") {
    const [listed, listedPeriods, listedOvertime, listedRecoveryUses, listedMecenat, formProfile] = await Promise.all([
      listBlobs(store, entryPrefix),
      listBlobs(store, periodPrefix),
      listBlobs(store, overtimePrefix),
      listBlobs(store, recoveryUsePrefix),
      listBlobs(store, mecenatPrefix),
      store.get(scopedKey("form-profile"), {
        type: "json",
      }) as Promise<FormProfile | null>,
    ]);
    const [entries, periods, overtimeEntries, recoveryUses, mecenatEntries] = await Promise.all([
      Promise.all(
        listed.blobs.map((blob) => store.get(blob.key, { type: "json" })),
      ),
      Promise.all(
        listedPeriods.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }),
        ),
      ),
      Promise.all(
        listedOvertime.blobs.map((blob) => store.get(blob.key, { type: "json" })),
      ),
      Promise.all(
        listedRecoveryUses.blobs.map((blob) => store.get(blob.key, { type: "json" })),
      ),
      Promise.all(
        listedMecenat.blobs.map((blob) => store.get(blob.key, { type: "json" })),
      ),
    ]);
    const cleanEntries = entries.filter((entry): entry is CalendarEntry =>
      Boolean(entry),
    );
    const cleanPeriods = periods.filter((period): period is LeavePeriod =>
      Boolean(period),
    );
    cleanEntries.sort((a, b) => a.date.localeCompare(b.date));
    cleanPeriods.sort((a, b) => a.from.localeCompare(b.from));
    const cleanOvertime = overtimeEntries.filter((item): item is OvertimeEntry => Boolean(item));
    const cleanRecoveryUses = recoveryUses.filter((item): item is RecoveryUse => Boolean(item));
    const cleanMecenat = mecenatEntries.filter((item): item is MecenatEntry => Boolean(item));
    cleanOvertime.sort((a, b) => a.date.localeCompare(b.date));
    cleanRecoveryUses.sort((a, b) => a.date.localeCompare(b.date));
    cleanMecenat.sort((a, b) => a.date.localeCompare(b.date));
    return json({
      email: user.email,
      entries: cleanEntries,
      periods: cleanPeriods,
      overtime_entries: cleanOvertime,
      recovery_uses: cleanRecoveryUses,
      mecenat_entries: cleanMecenat,
      form_profile: formProfile || null,
    });
  }
  if (request.method !== "POST")
    return json({ error: "Méthode non autorisée" }, 405);
  const parsed = await readCalendarBody(request);
  if ("error" in parsed)
    return json(
      { error: parsed.error },
      parsed.error === "Requête trop volumineuse" ? 413 : 400,
    );
  const body = parsed.body;
  if (body.action === "save-request") {
    let normalized;
    try {
      normalized = normalizeLeaveRequest(body);
    } catch (error) {
      return json(
        { error: error instanceof LeaveRequestValidationError ? error.message : "Demande de congé invalide" },
        400,
      );
    }

    // Les identifiants sont stables : un nouvel appui après une réponse réseau
    // perdue remplace la même demande au lieu de la dupliquer.
    const periodTargets = normalized.periods.map((candidate) => ({
      key: scopedKey(`period/${candidate.id}`),
      value: {
        id: candidate.id,
        from: candidate.from,
        to: candidate.to,
        leave_type: candidate.leaveType as LeaveType,
        half_moment: candidate.leaveType === "half" ? candidate.halfMoment || "" : "",
        group: candidate.group,
        updated_at: new Date().toISOString(),
      } satisfies LeavePeriod,
    }));
    let recoveryTargets: Array<{ key: string; value: RecoveryUse }> = [];
    if (normalized.requestKind === "recovery") {
      const [profile, overtimeList, recoveryList, calendarList] = await Promise.all([
        store.get(scopedKey("form-profile"), { type: "json" }) as Promise<FormProfile | null>,
        listBlobs(store, overtimePrefix),
        listBlobs(store, recoveryUsePrefix),
        listBlobs(store, entryPrefix),
      ]);
      const quota = profile?.work_quota || "full";
      const [overtimeValues, recoveryValues, calendarValues] = await Promise.all([
        Promise.all(
          overtimeList.blobs.map((blob) =>
            store.get(blob.key, { type: "json" }) as Promise<OvertimeEntry | null>,
          ),
        ),
        Promise.all(
          recoveryList.blobs.map((blob) =>
            store.get(blob.key, { type: "json" }) as Promise<RecoveryUse | null>,
          ),
        ),
        Promise.all(
          calendarList.blobs.map((blob) =>
            store.get(blob.key, { type: "json" }) as Promise<CalendarEntry | null>,
          ),
        ),
      ]);
      recoveryTargets = normalized.recoverySelections.map((selection) => ({
        key: scopedKey(`recovery-use/${selection.id}`),
        value: {
          id: selection.id,
          date: selection.date,
          minutes: recoveryRequestMinutes(
            selection.type,
            quota,
            selection.start,
            selection.end,
          ),
          start: selection.start || "",
          end: selection.end || "",
          kind: selection.type === "recovery_training" ? "training" : "",
          updated_at: new Date().toISOString(),
        } satisfies RecoveryUse,
      }));
      if (recoveryTargets.some(({ value }) => value.minutes < 1))
        return json({ error: "La durée d’une récupération est invalide" }, 400);
      const earnedFromOvertime = overtimeValues
        .filter((item): item is OvertimeEntry => Boolean(item))
        .filter((item) => item.disposition === "recovery")
        .reduce((total, item) => total + item.minutes, 0);
      const earnedFromHolidays = holidayRecoveryCreditMinutes(
        calendarValues
          .filter((item): item is CalendarEntry => Boolean(item))
          .filter((item) => item.holiday_pay === "recovery")
          .map((item) => item.date),
        quota,
      );
      const targetIds = new Set(recoveryTargets.map(({ value }) => value.id));
      const usedOutsideRequest = recoveryValues
        .filter((item): item is RecoveryUse => Boolean(item))
        .filter((item) => !targetIds.has(item.id))
        .reduce((total, item) => total + item.minutes, 0);
      const requested = recoveryTargets.reduce(
        (total, { value }) => total + value.minutes,
        0,
      );
      if (usedOutsideRequest + requested > earnedFromOvertime + earnedFromHolidays)
        return json(
          {
            error:
              "Le solde d’heures de récupération est insuffisant pour cette demande.",
          },
          409,
        );
    }
    const targets: Array<{ key: string; value: LeavePeriod | RecoveryUse }> = [
      ...periodTargets,
      ...recoveryTargets,
    ];
    const previous = await Promise.all(
      targets.map(({ key }) => store.get(key, { type: "json" })),
    );
    try {
      for (const target of targets) await store.setJSON(target.key, target.value);
    } catch {
      for (let index = 0; index < targets.length; index++) {
        if (previous[index] === null) await store.delete(targets[index].key);
        else await store.setJSON(targets[index].key, previous[index]);
      }
      return json({ error: "La demande n’a pas pu être enregistrée. Aucune donnée n’a été modifiée." }, 500);
    }
    return json({
      ok: true,
      periods: periodTargets.map(({ value }) => value),
      recovery_uses: recoveryTargets.map(({ value }) => value),
    });
  }
  if (body.action === "save-periods") {
    const normalized = normalizeBulkPeriods(body.periods);
    if ("error" in normalized) return json({ error: normalized.error }, 400);

    // Seules les clés de ce lot sont sauvegardées. Contrairement au batch
    // générique, le coût ne dépend donc plus de tout l'historique du compte.
    // Les identifiants fournis par le navigateur rendent aussi une seconde
    // tentative strictement idempotente après une coupure de connexion.
    const targets = normalized.periods.map((period) => ({
      key: scopedKey(`period/${period.id}`),
      period,
    }));
    const previous: any[] = [];
    for (const { key } of targets)
      previous.push(await store.get(key, { type: "json" }));
    const samePeriod = (left: any, right: typeof normalized.periods[number]) =>
      left?.id === right.id &&
      left?.from === right.from &&
      left?.to === right.to &&
      left?.leave_type === right.leave_type &&
      (left?.half_moment || "") === right.half_moment &&
      Number(left?.group) === Number(right.group);
    try {
      // Les écritures séquentielles évitent les rafales de requêtes fortes
      // vers Blobs. Lors d'une seconde tentative, une période déjà identique
      // est laissée intacte : le lot est réellement idempotent.
      for (let index = 0; index < targets.length; index++) {
        const { key, period } = targets[index];
        if (samePeriod(previous[index], period)) continue;
        await store.setJSON(key, period);
      }
    } catch (writeError) {
      // Une réponse Blobs peut être perdue après acceptation de l'écriture.
      // Avant d'annoncer un échec, on relit donc chaque identifiant.
      const confirmed: any[] = [];
      for (const { key } of targets) {
        try {
          confirmed.push(await store.get(key, { type: "json" }));
        } catch {
          confirmed.push(null);
        }
      }
      if (confirmed.every((period, index) => samePeriod(period, targets[index].period))) {
        console.warn("save-periods: réponse d'écriture perdue, lot confirmé par relecture", {
          count: targets.length,
        });
        return json({
          ok: true,
          periods: confirmed,
          recovered: true,
        });
      }
      let rollbackFailed = false;
      for (let index = 0; index < targets.length; index++) {
        try {
          if (previous[index] === null) await store.delete(targets[index].key);
          else await store.setJSON(targets[index].key, previous[index]);
        } catch {
          rollbackFailed = true;
        }
      }
      console.error("save-periods: échec réel du lot", {
        count: targets.length,
        rollbackFailed,
        cause: writeError instanceof Error ? writeError.message : String(writeError),
      });
      return json(
        {
          error: rollbackFailed
            ? "La synchronisation est incomplète. Rouvrez l’application avant de réessayer."
            : "Les congés n’ont pas pu être enregistrés. Aucune donnée n’a été modifiée.",
        },
        500,
      );
    }
    return json({
      ok: true,
      periods: targets.map(({ period }, index) =>
        samePeriod(previous[index], period) ? previous[index] : period,
      ),
    });
  }
  if (body.action === "batch") {
    const operations = Array.isArray(body.operations) ? body.operations : [];
    const forbidden = new Set([
      "batch",
      "restore-backup",
      "delete-user-data",
      "archive-legacy-data",
      "save-request",
      "save-periods",
    ]);
    if (
      operations.length < 1 ||
      operations.length > 400 ||
      operations.some(
        (operation) =>
          !operation ||
          typeof operation !== "object" ||
          forbidden.has(String((operation as Record<string, unknown>).action)),
      )
    )
      return json({ error: "Lot d’opérations invalide" }, 400);

    // Netlify Blobs n'offre pas de transaction multi-clés. On prend donc un
    // instantané privé avant le lot et on le restaure si une sous-opération
    // échoue : l'utilisateur ne reste jamais avec une sauvegarde partielle.
    const [entryList, periodList, overtimeList, recoveryUseList, mecenatList, profile] = await Promise.all([
      listBlobs(store, entryPrefix),
      listBlobs(store, periodPrefix),
      listBlobs(store, overtimePrefix),
      listBlobs(store, recoveryUsePrefix),
      listBlobs(store, mecenatPrefix),
      store.get(scopedKey("form-profile"), { type: "json" }),
    ]);
    const snapshot = await Promise.all(
      [...entryList.blobs, ...periodList.blobs, ...overtimeList.blobs, ...recoveryUseList.blobs, ...mecenatList.blobs].map(async (blob) => ({
        key: blob.key,
        value: await store.get(blob.key, { type: "json" }),
      })),
    );
    const rollback = async () => {
      const [newEntries, newPeriods, newOvertime, newRecoveryUses, newMecenat] = await Promise.all([
        listBlobs(store, entryPrefix),
        listBlobs(store, periodPrefix),
        listBlobs(store, overtimePrefix),
        listBlobs(store, recoveryUsePrefix),
        listBlobs(store, mecenatPrefix),
      ]);
      await Promise.all([
        ...newEntries.blobs.map((blob) => store.delete(blob.key)),
        ...newPeriods.blobs.map((blob) => store.delete(blob.key)),
        ...newOvertime.blobs.map((blob) => store.delete(blob.key)),
        ...newRecoveryUses.blobs.map((blob) => store.delete(blob.key)),
        ...newMecenat.blobs.map((blob) => store.delete(blob.key)),
        store.delete(scopedKey("form-profile")),
      ]);
      await Promise.all([
        ...snapshot.map(({ key, value }) =>
          value === null ? Promise.resolve() : store.setJSON(key, value),
        ),
        profile === null
          ? Promise.resolve()
          : store.setJSON(scopedKey("form-profile"), profile),
      ]);
    };

    const results: unknown[] = [];
    try {
      for (const operation of operations) {
        const response = await calendarHandler(
          new Request(request.url, {
            method: "POST",
            headers: request.headers,
            body: JSON.stringify(operation),
          }),
        );
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          await rollback();
          return json(
            {
              error:
                result && typeof result === "object" && "error" in result
                  ? result.error
                  : "Le lot n’a pas pu être enregistré",
              rolled_back: true,
            },
            response.status,
          );
        }
        results.push(result);
      }
      return json({ ok: true, results });
    } catch {
      await rollback();
      return json(
        { error: "Le lot n’a pas pu être enregistré", rolled_back: true },
        500,
      );
    }
  }
  if (body.action === "restore-backup") {
    const sanitized = sanitizeCalendarBackup(body.backup);
    if ("error" in sanitized) return json({ error: sanitized.error }, 400);
    const [currentEntries, currentPeriods, currentOvertime, currentRecoveryUses, currentMecenat, currentProfile] = await Promise.all([
      listBlobs(store, entryPrefix),
      listBlobs(store, periodPrefix),
      listBlobs(store, overtimePrefix),
      listBlobs(store, recoveryUsePrefix),
      listBlobs(store, mecenatPrefix),
      store.get(scopedKey("form-profile"), { type: "json" }),
    ]);
    // Une restauration ne détruit jamais silencieusement l'état précédent :
    // on en conserve une copie privée, datée, dans le même espace utilisateur.
    const archivePrefix = scopedKey(
      `restore-archive/${new Date().toISOString().replace(/[:.]/g, "-")}/`,
    );
    await Promise.all([
      ...currentEntries.blobs.map(async (blob) => {
        const value = await store.get(blob.key, { type: "json" });
        if (value !== null)
          await store.setJSON(
            `${archivePrefix}entry/${blob.key.slice(entryPrefix.length)}`,
            value,
          );
      }),
      ...currentPeriods.blobs.map(async (blob) => {
        const value = await store.get(blob.key, { type: "json" });
        if (value !== null)
          await store.setJSON(
            `${archivePrefix}period/${blob.key.slice(periodPrefix.length)}`,
            value,
          );
      }),
      ...currentOvertime.blobs.map(async (blob) => {
        const value = await store.get(blob.key, { type: "json" });
        if (value !== null)
          await store.setJSON(`${archivePrefix}overtime/${blob.key.slice(overtimePrefix.length)}`, value);
      }),
      ...currentRecoveryUses.blobs.map(async (blob) => {
        const value = await store.get(blob.key, { type: "json" });
        if (value !== null)
          await store.setJSON(`${archivePrefix}recovery-use/${blob.key.slice(recoveryUsePrefix.length)}`, value);
      }),
      ...currentMecenat.blobs.map(async (blob) => {
        const value = await store.get(blob.key, { type: "json" });
        if (value !== null)
          await store.setJSON(
            `${archivePrefix}mecenat/${blob.key.slice(mecenatPrefix.length)}`,
            value,
          );
      }),
      currentProfile === null
        ? Promise.resolve()
        : store.setJSON(`${archivePrefix}form-profile`, currentProfile),
    ]);
    await Promise.all([
      ...currentEntries.blobs.map((blob) => store.delete(blob.key)),
      ...currentPeriods.blobs.map((blob) => store.delete(blob.key)),
      ...currentOvertime.blobs.map((blob) => store.delete(blob.key)),
      ...currentRecoveryUses.blobs.map((blob) => store.delete(blob.key)),
      ...currentMecenat.blobs.map((blob) => store.delete(blob.key)),
      store.delete(scopedKey("form-profile")),
    ]);
    await Promise.all([
      ...sanitized.backup.entries.map((entry) =>
        store.setJSON(scopedKey(`entry/${entry.date}`), entry),
      ),
      ...sanitized.backup.periods.map((period) =>
        store.setJSON(scopedKey(`period/${period.id}`), period),
      ),
      ...sanitized.backup.overtime_entries.map((entry) =>
        store.setJSON(scopedKey(`overtime/${entry.id}`), entry),
      ),
      ...sanitized.backup.recovery_uses.map((entry) =>
        store.setJSON(scopedKey(`recovery-use/${entry.id}`), entry),
      ),
      ...sanitized.backup.mecenat_entries.map((entry) =>
        store.setJSON(scopedKey(`mecenat/${entry.id}`), entry),
      ),
      sanitized.backup.form_profile
        ? store.setJSON(
            scopedKey("form-profile"),
            sanitized.backup.form_profile,
          )
        : Promise.resolve(),
    ]);
    return json({ ok: true, restored: true });
  }
  if (body.action === "delete-user-data") {
    if (body.confirmation !== "SUPPRIMER")
      return json({ error: "Confirmation invalide" }, 400);
    const allUserData = await listBlobs(store, scopedKey(""));
    await Promise.all(allUserData.blobs.map((blob) => store.delete(blob.key)));
    return json({
      ok: true,
      deleted: allUserData.blobs.length,
    });
  }
  if (body.action === "archive-legacy-data") {
    if (body.confirmation !== "ARCHIVER")
      return json({ error: "Confirmation invalide" }, 400);
    const owner = (await store.get(LEGACY_OWNER_KEY, {
      type: "json",
    })) as { user_id?: string } | null;
    if (owner?.user_id !== user.id)
      return json({ error: "Ces données historiques ne vous appartiennent pas" }, 403);
    const [legacyEntries, legacyPeriods, legacyProfile] = await Promise.all([
      listBlobs(store, "entry/"),
      listBlobs(store, "period/"),
      store.get("form-profile", { type: "json" }),
    ]);
    const legacyKeys = [
      ...legacyEntries.blobs.map((blob) => blob.key),
      ...legacyPeriods.blobs.map((blob) => blob.key),
    ];
    await Promise.all([
      ...legacyKeys.map(async (key) => {
        const value = await store.get(key, { type: "json" });
        if (value !== null)
          await store.setJSON(scopedKey(`legacy-archive-v1/${key}`), value);
      }),
      legacyProfile === null
        ? Promise.resolve()
        : store.setJSON(
            scopedKey("legacy-archive-v1/form-profile"),
            legacyProfile,
          ),
    ]);
    await Promise.all([
      ...legacyKeys.map((key) => store.delete(key)),
      ...(legacyProfile === null ? [] : [store.delete("form-profile")]),
    ]);
    return json({
      ok: true,
      archived: legacyKeys.length + (legacyProfile === null ? 0 : 1),
    });
  }
  if (body.action === "save-form-profile") {
    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim().slice(0, 120)
        : "";
    const signature = typeof body.signature === "string" ? body.signature : "";
    if (
      signature &&
      (!signature.startsWith("data:image/png;base64,") ||
        signature.length > 600000)
    )
      return json({ error: "Signature invalide" }, 400);
    // Le traitement n'est envoyé que par l'écran qui le modifie : les autres
    // appels (changement de groupe, formulaire) l'ignorent et doivent le
    // laisser intact plutôt que de l'effacer.
    const previousProfile = (await store.get(scopedKey("form-profile"), {
      type: "json",
    })) as FormProfile | null;
    // Même règle pour le groupe : un appel qui ne le renvoie pas ne doit pas
    // effacer le cycle enregistré, qui fausserait ensuite tous les décomptes
    // de dimanches et fériés sans qu'on ait touché au planning.
    const group = ["1", "2", "3"].includes(String(body.group || ""))
      ? String(body.group)
      : previousProfile?.group || "";
    // Même règle qu'ailleurs : un appel qui ne renvoie pas le statut ne doit
    // pas l'effacer.
    const status =
      body.status === "fonctionnaire" || body.status === "contractuel"
        ? body.status
        : previousProfile?.status || "contractuel";
    const workQuota =
      body.workQuota === "full" ||
      body.workQuota === "three_quarters" ||
      body.workQuota === "half"
        ? body.workQuota
        : previousProfile?.work_quota || "full";
    const netRatioRegime =
      body.netRatioRegime === "pre-culture-psc" ||
      body.netRatioRegime === "culture-psc"
        ? body.netRatioRegime
        : previousProfile?.net_ratio_regime;
    const amountCents = (sent: unknown, previous: number | undefined) => {
      if (sent === undefined) return previous;
      const value = Number(sent);
      return Number.isFinite(value) && value >= 0 && value <= 100000000
        ? Math.round(value)
        : undefined;
    };
    // Un taux net/brut, en points de base : borné à 100 % (10000), pas au
    // même plafond très large qu'un montant en centimes.
    const ratioBp = (sent: unknown, previous: number | undefined) => {
      if (sent === undefined) return previous;
      const value = Number(sent);
      return Number.isFinite(value) && value >= 0 && value <= 10000
        ? Math.round(value)
        : undefined;
    };
    const formProfile: FormProfile = {
      full_name: fullName,
      group,
      signature,
      status,
      work_quota: workQuota,
      base_salary_cents: amountCents(
        body.baseSalaryCents,
        previousProfile?.base_salary_cents,
      ),
      residence_allowance_cents: amountCents(
        body.residenceAllowanceCents,
        previousProfile?.residence_allowance_cents,
      ),
      ifse_cents: amountCents(body.ifseCents, previousProfile?.ifse_cents),
      carence_cents: amountCents(
        body.carenceCents,
        previousProfile?.carence_cents,
      ),
      other_fixed_cents: amountCents(
        body.otherFixedCents,
        previousProfile?.other_fixed_cents,
      ),
      cia_cents: amountCents(body.ciaCents, previousProfile?.cia_cents),
      net_ratio_fixed_bp: ratioBp(
        body.netRatioFixedBp,
        previousProfile?.net_ratio_fixed_bp,
      ),
      net_ratio_variable_bp: ratioBp(
        body.netRatioVariableBp,
        previousProfile?.net_ratio_variable_bp,
      ),
      net_ratio_regime: netRatioRegime,
      navigo_cents: amountCents(body.navigoCents, previousProfile?.navigo_cents),
      meal_voucher_deduction_cents: amountCents(
        body.mealVoucherDeductionCents,
        previousProfile?.meal_voucher_deduction_cents,
      ),
      pas_rate_bp: ratioBp(body.pasRateBp, previousProfile?.pas_rate_bp),
      // Juillet, août ou septembre : les trois mois où le CIA est réellement
      // tombé entre 2024 et 2026 (septembre en 2024, août en 2025, juillet en
      // 2026).
      cia_month:
        body.ciaMonth === undefined
          ? previousProfile?.cia_month
          : body.ciaMonth === 6 || body.ciaMonth === 7 || body.ciaMonth === 8
            ? body.ciaMonth
            : undefined,
      sunday_carryover:
        body.sundayCarryover === undefined
          ? previousProfile?.sunday_carryover
          : Number.isFinite(Number(body.sundayCarryover)) &&
              Number(body.sundayCarryover) >= 0
            ? Math.round(Number(body.sundayCarryover))
            : undefined,
      sunday_carryover_year:
        body.sundayCarryoverYear === undefined
          ? previousProfile?.sunday_carryover_year
          : Number.isFinite(Number(body.sundayCarryoverYear))
            ? Number(body.sundayCarryoverYear)
            : undefined,
      sunday_carryover_month:
        body.sundayCarryoverMonth === undefined
          ? previousProfile?.sunday_carryover_month
          : Number.isFinite(Number(body.sundayCarryoverMonth)) &&
              Number(body.sundayCarryoverMonth) >= 0 &&
              Number(body.sundayCarryoverMonth) <= 11
            ? Number(body.sundayCarryoverMonth)
            : undefined,
      sunday_carryover_from_year:
        body.sundayCarryoverFromYear === undefined
          ? previousProfile?.sunday_carryover_from_year
          : Number.isFinite(Number(body.sundayCarryoverFromYear))
            ? Number(body.sundayCarryoverFromYear)
            : undefined,
      sunday_carryover_from_month:
        body.sundayCarryoverFromMonth === undefined
          ? previousProfile?.sunday_carryover_from_month
          : Number.isFinite(Number(body.sundayCarryoverFromMonth)) &&
              Number(body.sundayCarryoverFromMonth) >= 0 &&
              Number(body.sundayCarryoverFromMonth) <= 11
            ? Number(body.sundayCarryoverFromMonth)
            : undefined,
      pay_profiles: previousProfile?.pay_profiles,
      manual_adjustments: previousProfile?.manual_adjustments,
      cet_account: previousProfile?.cet_account,
      updated_at: new Date().toISOString(),
    };
    if (body.cetAccount !== undefined) {
      const cetAccount = sanitizeCetAccount(body.cetAccount);
      if (!cetAccount) return json({ error: "Compte épargne-temps invalide" }, 400);
      formProfile.cet_account = cetAccount;
    }
    const manualYear = Number(body.manualYear);
    if (body.manualYear !== undefined) {
      if (!Number.isInteger(manualYear) || manualYear < 2000 || manualYear > 2100)
        return json({ error: "Année de rattrapage invalide" }, 400);
      const leaveValue = (value: unknown, maximum: number) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum &&
          Number.isInteger(parsed * 2)
          ? parsed
          : null;
      };
      const sundayValue = (value: unknown) => {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 53
          ? parsed
          : null;
      };
      const manual: ManualYearAdjustments = {
        annual_used: leaveValue(body.manualAnnualUsed, 29) as number,
        rtt_used: leaveValue(body.manualRttUsed, 15) as number,
        fraction_used: leaveValue(body.manualFractionUsed, 2) as number,
        sunday_leave_jan_jun: sundayValue(body.manualSundayLeaveJanJun) as number,
        sunday_leave_jul_sep: sundayValue(body.manualSundayLeaveJulSep) as number,
        sunday_leave_oct_nov: sundayValue(body.manualSundayLeaveOctNov) as number,
        sunday_leave_dec: sundayValue(body.manualSundayLeaveDec) as number,
      };
      if (Object.values(manual).some((value) => value === null))
        return json({ error: "Valeurs de rattrapage invalides" }, 400);
      formProfile.manual_adjustments = {
        ...(previousProfile?.manual_adjustments || {}),
        [String(manualYear)]: manual,
      };
    }
    const payYear = Number(body.payYear);
    if (Number.isInteger(payYear) && payYear >= 2000 && payYear <= 2100) {
      const key = String(payYear);
      const previousYear = previousProfile?.pay_profiles?.[key] || {
        base_salary_cents: previousProfile?.base_salary_cents,
        residence_allowance_cents: previousProfile?.residence_allowance_cents,
        ifse_cents: previousProfile?.ifse_cents,
        carence_cents: previousProfile?.carence_cents,
        other_fixed_cents: previousProfile?.other_fixed_cents,
        cia_cents: previousProfile?.cia_cents,
        cia_month: previousProfile?.cia_month,
        net_ratio_fixed_bp: previousProfile?.net_ratio_fixed_bp,
        net_ratio_variable_bp: previousProfile?.net_ratio_variable_bp,
        net_ratio_regime: previousProfile?.net_ratio_regime,
        navigo_cents: previousProfile?.navigo_cents,
        meal_voucher_deduction_cents:
          previousProfile?.meal_voucher_deduction_cents,
        pas_rate_bp: previousProfile?.pas_rate_bp,
      };
      formProfile.pay_profiles = {
        ...(previousProfile?.pay_profiles || {}),
        [key]: {
          base_salary_cents: amountCents(
            body.baseSalaryCents,
            previousYear.base_salary_cents,
          ),
          residence_allowance_cents: amountCents(
            body.residenceAllowanceCents,
            previousYear.residence_allowance_cents,
          ),
          ifse_cents: amountCents(body.ifseCents, previousYear.ifse_cents),
          carence_cents: amountCents(
            body.carenceCents,
            previousYear.carence_cents,
          ),
          other_fixed_cents: amountCents(
            body.otherFixedCents,
            previousYear.other_fixed_cents,
          ),
          cia_cents: amountCents(body.ciaCents, previousYear.cia_cents),
          cia_month:
            body.ciaMonth === undefined
              ? previousYear.cia_month
              : body.ciaMonth === 6 ||
                  body.ciaMonth === 7 ||
                  body.ciaMonth === 8
                ? body.ciaMonth
                : undefined,
          net_ratio_fixed_bp: ratioBp(
            body.netRatioFixedBp,
            previousYear.net_ratio_fixed_bp,
          ),
          net_ratio_variable_bp: ratioBp(
            body.netRatioVariableBp,
            previousYear.net_ratio_variable_bp,
          ),
          net_ratio_regime:
            body.netRatioRegime === "pre-culture-psc" ||
            body.netRatioRegime === "culture-psc"
              ? body.netRatioRegime
              : previousYear.net_ratio_regime,
          navigo_cents: amountCents(
            body.navigoCents,
            previousYear.navigo_cents,
          ),
          meal_voucher_deduction_cents: amountCents(
            body.mealVoucherDeductionCents,
            previousYear.meal_voucher_deduction_cents,
          ),
          pas_rate_bp: ratioBp(body.pasRateBp, previousYear.pas_rate_bp),
        },
      };
      const payMonth = Number(body.payMonth);
      if (
        Number.isInteger(payMonth) &&
        payMonth >= 0 &&
        payMonth <= 11 &&
        (body.baseSalaryCents !== undefined ||
          body.residenceAllowanceCents !== undefined)
      ) {
        const monthKey = `${payYear}-${String(payMonth + 1).padStart(2, "0")}`;
        const previousMonth = previousProfile?.pay_profiles?.[monthKey] || {};
        formProfile.pay_profiles[monthKey] = {
          ...previousMonth,
          base_salary_cents: amountCents(
            body.baseSalaryCents,
            previousMonth.base_salary_cents,
          ),
          residence_allowance_cents: amountCents(
            body.residenceAllowanceCents,
            previousMonth.residence_allowance_cents,
          ),
        };
      }
      if (Array.isArray(body.monthlyPayProfiles)) {
        for (const rawMonthly of body.monthlyPayProfiles.slice(0, 24)) {
          if (!rawMonthly || typeof rawMonthly !== "object") continue;
          const monthly = rawMonthly as Record<string, unknown>;
          const monthlyYear = Number(monthly.year);
          const monthlyMonth = Number(monthly.month);
          if (
            !Number.isInteger(monthlyYear) ||
            monthlyYear < 2000 ||
            monthlyYear > 2100 ||
            !Number.isInteger(monthlyMonth) ||
            monthlyMonth < 0 ||
            monthlyMonth > 11
          )
            continue;
          const monthKey = `${monthlyYear}-${String(monthlyMonth + 1).padStart(2, "0")}`;
          const previousMonth = formProfile.pay_profiles[monthKey] || {};
          formProfile.pay_profiles[monthKey] = {
            ...previousMonth,
            base_salary_cents: amountCents(
              monthly.baseSalaryCents,
              previousMonth.base_salary_cents,
            ),
            residence_allowance_cents: amountCents(
              monthly.residenceAllowanceCents,
              previousMonth.residence_allowance_cents,
            ),
          };
        }
      }
    }
    await store.setJSON(scopedKey("form-profile"), formProfile);
    return json({ ok: true, form_profile: formProfile });
  }
  if (body.action === "save-mecenat") {
    const requestedId = typeof body.id === "string" ? body.id : "";
    const id = requestedId || crypto.randomUUID();
    const date = typeof body.date === "string" ? body.date : "";
    const start = typeof body.start === "string" ? body.start.slice(0, 5) : "";
    const end = typeof body.end === "string" ? body.end.slice(0, 5) : "";
    const payPeriod = nextPayPeriod(date);
    const payYear = payPeriod.year;
    const payMonth = payPeriod.month;
    const calculation = calculateRegulatoryMecenatVacation(start, end);
    if (
      !validId(id) ||
      !isValidDateKey(date) ||
      !calculation
    )
      return json({ error: "Déclaration de mécénat invalide" }, 400);
    const entry: MecenatEntry = {
      id,
      date,
      start,
      end,
      day_minutes: calculation.dayMinutes,
      night_minutes: calculation.nightMinutes,
      gross_amount_cents: calculation.grossAmountCents,
      pay_year: payYear,
      pay_month: payMonth,
      updated_at: new Date().toISOString(),
    };
    await store.setJSON(scopedKey(`mecenat/${id}`), entry);
    return json({ ok: true, mecenat_entry: entry });
  }
  if (body.action === "delete-mecenat") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!validId(id)) return json({ error: "Mécénat invalide" }, 400);
    await store.delete(scopedKey(`mecenat/${id}`));
    return json({ ok: true, deleted: true });
  }
  if (body.action === "save-overtime") {
    const requestedId = typeof body.id === "string" ? body.id : "";
    const id = requestedId || crypto.randomUUID();
    const date = typeof body.date === "string" ? body.date : "";
    const minutes = Math.round(Number(body.minutes));
    const dayMinutes = Math.round(Number(body.dayMinutes));
    const nightMinutes = Math.round(Number(body.nightMinutes));
    const disposition = body.disposition === "paid" || body.disposition === "recovery"
      ? body.disposition
      : null;
    const inputMode = body.inputMode === "range" || body.inputMode === "duration"
      ? body.inputMode
      : null;
    if (
      !validId(id) ||
      !isValidDateKey(date) ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > (id.startsWith("solidarity-") ? 600_000 : 24 * 60) ||
      !Number.isInteger(dayMinutes) ||
      !Number.isInteger(nightMinutes) ||
      dayMinutes < 0 ||
      nightMinutes < 0 ||
      dayMinutes + nightMinutes !== minutes ||
      !disposition ||
      !inputMode
    )
      return json({ error: "Déclaration d’heures supplémentaires invalide" }, 400);
    const entry: OvertimeEntry = {
      id,
      date,
      minutes,
      day_minutes: dayMinutes,
      night_minutes: nightMinutes,
      disposition,
      input_mode: inputMode,
      start: typeof body.start === "string" ? body.start.slice(0, 5) : "",
      end: typeof body.end === "string" ? body.end.slice(0, 5) : "",
      updated_at: new Date().toISOString(),
    };
    await store.setJSON(scopedKey(`overtime/${id}`), entry);
    return json({ ok: true, overtime_entry: entry });
  }
  if (body.action === "delete-overtime") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!validId(id)) return json({ error: "Heure supplémentaire invalide" }, 400);
    const target = (await store.get(scopedKey(`overtime/${id}`), {
      type: "json",
    })) as OvertimeEntry | null;
    if (target?.disposition === "recovery") {
      const [overtimeList, recoveryList, calendarList, formProfile] = await Promise.all([
        listBlobs(store, overtimePrefix),
        listBlobs(store, recoveryUsePrefix),
        listBlobs(store, entryPrefix),
        store.get(scopedKey("form-profile"), { type: "json" }) as Promise<FormProfile | null>,
      ]);
      const [overtimeValues, recoveryValues, calendarValues] = await Promise.all([
        Promise.all(
          overtimeList.blobs.map((blob) =>
            store.get(blob.key, { type: "json" }) as Promise<OvertimeEntry | null>,
          ),
        ),
        Promise.all(
          recoveryList.blobs.map((blob) =>
            store.get(blob.key, { type: "json" }) as Promise<RecoveryUse | null>,
          ),
        ),
        Promise.all(
          calendarList.blobs.map((blob) =>
            store.get(blob.key, { type: "json" }) as Promise<CalendarEntry | null>,
          ),
        ),
      ]);
      const overtimeEarned = overtimeValues
        .filter((item): item is OvertimeEntry => Boolean(item))
        .filter((item) => item.disposition === "recovery")
        .reduce((total, item) => total + item.minutes, 0);
      const earned = overtimeEarned + holidayRecoveryCreditMinutes(
        calendarValues
          .filter((item): item is CalendarEntry => Boolean(item))
          .filter((item) => item.holiday_pay === "recovery")
          .map((item) => item.date),
        formProfile?.work_quota || "full",
      );
      const used = recoveryValues
        .filter((item): item is RecoveryUse => Boolean(item))
        .reduce((total, item) => total + item.minutes, 0);
      if (earned - target.minutes < used)
        return json(
          {
            error:
              "Cette récupération a déjà été utilisée. Annulez d’abord les récupérations posées.",
          },
          409,
        );
    }
    await store.delete(scopedKey(`overtime/${id}`));
    return json({ ok: true, deleted: true });
  }
  if (body.action === "save-recovery-use") {
    const requestedId = typeof body.id === "string" ? body.id : "";
    const id = requestedId || crypto.randomUUID();
    const date = typeof body.date === "string" ? body.date : "";
    const minutes = Math.round(Number(body.minutes));
    if (!validId(id) || !isValidDateKey(date) || !Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60)
      return json({ error: "Utilisation de récupération invalide" }, 400);
    const [overtimeList, recoveryList, calendarList, formProfile, previousUse] = await Promise.all([
      listBlobs(store, overtimePrefix),
      listBlobs(store, recoveryUsePrefix),
      listBlobs(store, entryPrefix),
      store.get(scopedKey("form-profile"), { type: "json" }) as Promise<FormProfile | null>,
      store.get(scopedKey(`recovery-use/${id}`), { type: "json" }) as Promise<RecoveryUse | null>,
    ]);
    const [overtimeValues, recoveryValues, calendarValues] = await Promise.all([
      Promise.all(
        overtimeList.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }) as Promise<OvertimeEntry | null>,
        ),
      ),
      Promise.all(
        recoveryList.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }) as Promise<RecoveryUse | null>,
        ),
      ),
      Promise.all(
        calendarList.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }) as Promise<CalendarEntry | null>,
        ),
      ),
    ]);
    const overtimeEarned = overtimeValues
      .filter((item): item is OvertimeEntry => Boolean(item))
      .filter((item) => item.disposition === "recovery")
      .reduce((total, item) => total + item.minutes, 0);
    const holidayEarned = holidayRecoveryCreditMinutes(
      calendarValues
        .filter((item): item is CalendarEntry => Boolean(item))
        .filter((item) => item.holiday_pay === "recovery")
        .map((item) => item.date),
      formProfile?.work_quota || "full",
    );
    const earned = overtimeEarned + holidayEarned;
    const alreadyUsed = recoveryValues
      .filter((item): item is RecoveryUse => Boolean(item))
      .reduce((total, item) => total + item.minutes, 0);
    const usedAfterSave = alreadyUsed - (previousUse?.minutes || 0) + minutes;
    if (usedAfterSave > earned)
      return json({ error: "Le solde de récupération est insuffisant" }, 409);
    const entry: RecoveryUse = {
      id,
      date,
      minutes,
      start: typeof body.start === "string" ? body.start.slice(0, 5) : "",
      end: typeof body.end === "string" ? body.end.slice(0, 5) : "",
      kind: body.kind === "training" ? "training" : "",
      updated_at: new Date().toISOString(),
    };
    await store.setJSON(scopedKey(`recovery-use/${id}`), entry);
    return json({ ok: true, recovery_use: entry });
  }
  if (body.action === "delete-recovery-use") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!validId(id)) return json({ error: "Récupération invalide" }, 400);
    await store.delete(scopedKey(`recovery-use/${id}`));
    return json({ ok: true, deleted: true });
  }
  if (body.action === "save-period") {
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    const leaveType: LeaveType =
      body.leaveType === "annual" ||
      body.leaveType === "rtt" ||
      body.leaveType === "fraction" ||
      body.leaveType === "half" ||
      body.leaveType === "recovery" ||
      body.leaveType === "sick" ||
      body.leaveType === "strike" ||
      body.leaveType === "cet" ||
      body.leaveType === "other" ||
      body.leaveType === "childcare" ||
      body.leaveType === "exceptional"
        ? body.leaveType
        : "";
    const halfMoment: HalfMoment =
      body.halfMoment === "morning" || body.halfMoment === "afternoon"
        ? body.halfMoment
        : "";
    const periodGroup = [1, 2, 3].includes(Number(body.group))
      ? Number(body.group)
      : undefined;
    const requestedId = typeof body.id === "string" ? body.id : "";
    if (!isValidDateKey(from) || !isValidDateKey(to) || to < from)
      return json({ error: "Période invalide" }, 400);
    const span = rangeSpan(from, to);
    if (span < 1 || span > 366)
      return json({ error: "Période trop longue" }, 400);
    if (requestedId && !validId(requestedId))
      return json({ error: "Identifiant invalide" }, 400);
    const id = requestedId || crypto.randomUUID();
    const previous = requestedId
      ? ((await store.get(scopedKey(`period/${id}`), {
          type: "json",
        })) as LeavePeriod | null)
      : null;
    if (
      typeof body.expectedUpdatedAt === "string" &&
      body.expectedUpdatedAt !== (previous?.updated_at || "")
    )
      return json(
        { error: "Cette période a été modifiée sur un autre appareil" },
        409,
      );
    const resolvedType: LeaveType = leaveType || previous?.leave_type || "";
    const period: LeavePeriod = {
      id,
      from,
      to,
      leave_type: resolvedType,
      // Le moment ne vaut que pour une demi-journée : passer la période à un
      // autre type l'efface plutôt que de le laisser traîner.
      half_moment:
        resolvedType === "half"
          ? halfMoment || previous?.half_moment || ""
          : "",
      group: periodGroup || previous?.group,
      updated_at: new Date().toISOString(),
    };
    await store.setJSON(scopedKey(`period/${id}`), period);
    return json({ ok: true, period });
  }
  if (body.action === "delete-period") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!validId(id)) return json({ error: "Identifiant invalide" }, 400);
    if (typeof body.expectedUpdatedAt === "string") {
      const previous = (await store.get(scopedKey(`period/${id}`), {
        type: "json",
      })) as LeavePeriod | null;
      if (body.expectedUpdatedAt !== (previous?.updated_at || ""))
        return json(
          { error: "Cette période a été modifiée sur un autre appareil" },
          409,
        );
    }
    await store.delete(scopedKey(`period/${id}`));
    return json({ ok: true, deleted: true });
  }
  if (body.action === "clear-legacy-period") {
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    if (!isValidDateKey(from) || !isValidDateKey(to) || to < from)
      return json({ error: "Période invalide" }, 400);
    const listed = await listBlobs(store, entryPrefix);
    for (const blob of listed.blobs) {
      const date = blob.key.slice(entryPrefix.length);
      if (date < from || date > to) continue;
      const entry = (await store.get(blob.key, {
        type: "json",
      })) as CalendarEntry | null;
      if (!entry) continue;
      const next = {
        ...entry,
        leave: false,
        updated_at: new Date().toISOString(),
      };
      if (
        !next.note_text &&
        !next.leave &&
        !next.wish &&
        !next.holiday_pay &&
        !next.closure_override
      )
        await store.delete(blob.key);
      else await store.setJSON(blob.key, next);
    }
    return json({ ok: true });
  }
  if (body.action === "save-note-period") {
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    const noteText =
      typeof body.noteText === "string"
        ? body.noteText.trim().slice(0, 300)
        : "";
    const noteColor =
      typeof body.noteColor === "string" && COLORS.has(body.noteColor)
        ? body.noteColor
        : "#D3943D";
    const requestedId = typeof body.groupId === "string" ? body.groupId : "";
    if (!isValidDateKey(from) || !isValidDateKey(to) || to < from || !noteText)
      return json({ error: "Période de note invalide" }, 400);
    if (rangeSpan(from, to) > 366)
      return json({ error: "Période trop longue" }, 400);
    if (requestedId && !validId(requestedId))
      return json({ error: "Identifiant invalide" }, 400);
    const groupId = requestedId || crypto.randomUUID();
    const listed = await listBlobs(store, entryPrefix);
    if (requestedId) {
      for (const blob of listed.blobs) {
        const entry = (await store.get(blob.key, {
          type: "json",
        })) as CalendarEntry | null;
        if (entry?.note_group_id === groupId)
          await clearNote(store, blob.key, entry);
      }
    }
    const updatedAt = new Date().toISOString();
    for (const date of dateKeys(from, to)) {
      const key = scopedKey(`entry/${date}`);
      const previous = (await store.get(key, {
        type: "json",
      })) as CalendarEntry | null;
      await store.setJSON(key, {
        date,
        note_text: noteText,
        note_color: noteColor,
        note_updated_at: updatedAt,
        note_group_id: groupId,
        leave: previous?.leave || false,
        wish: previous?.wish || false,
        holiday_pay: previous?.holiday_pay,
        closure_override: previous?.closure_override,
        updated_at: updatedAt,
      } satisfies CalendarEntry);
    }
    return json({ ok: true, groupId });
  }
  if (body.action === "delete-note-period") {
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    const date = typeof body.date === "string" ? body.date : "";
    if (groupId && !validId(groupId))
      return json({ error: "Identifiant invalide" }, 400);
    if (!groupId && !isValidDateKey(date))
      return json({ error: "Note invalide" }, 400);
    if (groupId) {
      const listed = await listBlobs(store, entryPrefix);
      for (const blob of listed.blobs) {
        const entry = (await store.get(blob.key, {
          type: "json",
        })) as CalendarEntry | null;
        if (entry?.note_group_id === groupId)
          await clearNote(store, blob.key, entry);
      }
    } else {
      const key = scopedKey(`entry/${date}`);
      const entry = (await store.get(key, {
        type: "json",
      })) as CalendarEntry | null;
      if (entry) await clearNote(store, key, entry);
    }
    return json({ ok: true });
  }
  if (body.action === "save-leaves") {
    const date = typeof body.date === "string" ? body.date : "";
    if (!isValidDateKey(date)) return json({ error: "Date invalide" }, 400);
    const key = scopedKey(`entry/${date}`);
    const previous = (await store.get(key, {
      type: "json",
    })) as CalendarEntry | null;
    if (
      typeof body.expectedUpdatedAt === "string" &&
      body.expectedUpdatedAt !== (previous?.updated_at || "")
    )
      return json(
        { error: "Cette journée a été modifiée sur un autre appareil" },
        409,
      );
    const next: CalendarEntry = {
      date,
      note_text: previous?.note_text || "",
      note_color: previous?.note_color || "#D3943D",
      note_updated_at: previous?.note_updated_at || "",
      note_group_id: previous?.note_group_id || "",
      leave: body.leave === true,
      wish: body.wish === true,
      holiday_pay: holidayPayFrom(body, previous?.holiday_pay),
      closure_override: previous?.closure_override,
      updated_at: new Date().toISOString(),
    };
    if (
      !next.note_text &&
      !next.leave &&
      !next.wish &&
      !next.holiday_pay &&
      !next.closure_override
    )
      await store.delete(key);
    else await store.setJSON(key, next);
    return json({ ok: true });
  }
  if (body.action !== "save-entry")
    return json({ error: "Requête invalide" }, 400);
  const date = typeof body.date === "string" ? body.date : "";
  if (!isValidDateKey(date)) return json({ error: "Date invalide" }, 400);
  const noteText =
    typeof body.noteText === "string" ? body.noteText.trim().slice(0, 300) : "";
  const noteColor =
    typeof body.noteColor === "string" && COLORS.has(body.noteColor)
      ? body.noteColor
      : "#D3943D";
  const leave = body.leave === true,
    wish = body.wish === true,
    key = scopedKey(`entry/${date}`);
  const previous = (await store.get(key, {
    type: "json",
  })) as CalendarEntry | null;
  if (
    typeof body.expectedUpdatedAt === "string" &&
    body.expectedUpdatedAt !== (previous?.updated_at || "")
  )
    return json(
      { error: "Cette journée a été modifiée sur un autre appareil" },
      409,
    );
  const holidayPay = holidayPayFrom(body, previous?.holiday_pay);
  const closureOverride =
    body.closureOverride === "closed" || body.closureOverride === "open"
      ? body.closureOverride
      : body.closureOverride === ""
        ? ""
        : previous?.closure_override || "";
  const noteChanged = (previous?.note_text || "") !== noteText;
  const noteUpdatedAt = noteText
    ? noteChanged
      ? new Date().toISOString()
      : previous?.note_updated_at || new Date().toISOString()
    : "";
  if (!noteText && !leave && !wish && !holidayPay && !closureOverride) {
    await store.delete(key);
    return json({ ok: true, deleted: true });
  }
  await store.setJSON(key, {
    date,
    note_text: noteText,
    note_color: noteColor,
    note_updated_at: noteUpdatedAt,
    note_group_id: "",
    leave,
    // Écrire une note ne doit pas effacer un congé souhaité posé sur le jour.
    wish,
    holiday_pay: holidayPay,
    closure_override: closureOverride || undefined,
    updated_at: new Date().toISOString(),
  } satisfies CalendarEntry);
  return json({ ok: true, noteUpdatedAt });
}
export default calendarHandler;
export const config = { path: "/api/calendar" };
