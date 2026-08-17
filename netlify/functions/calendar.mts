import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import {
  LEGACY_OWNER_KEY,
  migrateLegacyData,
  userDataKey,
} from "../lib/userScopedStore.mts";
import {
  isValidDateKey,
  readCalendarBody,
} from "../lib/calendarValidation.mts";
import { sanitizeCalendarBackup } from "../lib/calendarBackup.mts";

const COLORS = new Set(["#D3943D", "#7358d8", "#2878b8", "#268b69", "#d57928"]);
type LeaveType =
  | "annual"
  | "rtt"
  | "fraction"
  | "half"
  | "recovery"
  | "sick"
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
  ifse_cents?: number;
  carence_cents?: number;
  other_fixed_cents?: number;
  cia_cents?: number;
  cia_month?: number;
  net_ratio_fixed_bp?: number;
  net_ratio_variable_bp?: number;
  navigo_cents?: number;
  meal_voucher_deduction_cents?: number;
  pas_rate_bp?: number;
};
type FormProfile = {
  full_name: string;
  group: string;
  signature: string;
  /** Absent sur les profils créés avant l'ajout de ce champ : traité comme
   *  « fonctionnaire », le statut jusque-là implicite de l'appli. */
  status?: "fonctionnaire" | "contractuel";
  /** Traitement de base mensuel, hors primes : il sert à calculer les
   *  indemnités de jour férié, qui en sont un multiple. Stocké en centimes
   *  pour éviter les arrondis flottants. */
  base_salary_cents?: number;
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
  if (!next.leave && !next.wish && !next.holiday_pay) await store.delete(key);
  else await store.setJSON(key, next);
}
async function calendarHandler(request: Request): Promise<Response> {
  const user = await getUser();
  if (!user?.id || !user.email)
    return json({ error: "Connexion requise" }, 401);
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  await migrateLegacyData(store, user.id);
  const scopedKey = (key: string) => userDataKey(user.id, key);
  const entryPrefix = scopedKey("entry/");
  const periodPrefix = scopedKey("period/");
  if (request.method === "GET") {
    const [listed, listedPeriods, formProfile] = await Promise.all([
      listBlobs(store, entryPrefix),
      listBlobs(store, periodPrefix),
      store.get(scopedKey("form-profile"), {
        type: "json",
      }) as Promise<FormProfile | null>,
    ]);
    const [entries, periods] = await Promise.all([
      Promise.all(
        listed.blobs.map((blob) => store.get(blob.key, { type: "json" })),
      ),
      Promise.all(
        listedPeriods.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }),
        ),
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
    return json({
      email: user.email,
      entries: cleanEntries,
      periods: cleanPeriods,
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
  if (body.action === "batch") {
    const operations = Array.isArray(body.operations) ? body.operations : [];
    const forbidden = new Set([
      "batch",
      "restore-backup",
      "delete-user-data",
      "archive-legacy-data",
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
    const [entryList, periodList, profile] = await Promise.all([
      listBlobs(store, entryPrefix),
      listBlobs(store, periodPrefix),
      store.get(scopedKey("form-profile"), { type: "json" }),
    ]);
    const snapshot = await Promise.all(
      [...entryList.blobs, ...periodList.blobs].map(async (blob) => ({
        key: blob.key,
        value: await store.get(blob.key, { type: "json" }),
      })),
    );
    const rollback = async () => {
      const [newEntries, newPeriods] = await Promise.all([
        listBlobs(store, entryPrefix),
        listBlobs(store, periodPrefix),
      ]);
      await Promise.all([
        ...newEntries.blobs.map((blob) => store.delete(blob.key)),
        ...newPeriods.blobs.map((blob) => store.delete(blob.key)),
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
    const [currentEntries, currentPeriods, currentProfile] = await Promise.all([
      listBlobs(store, entryPrefix),
      listBlobs(store, periodPrefix),
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
      currentProfile === null
        ? Promise.resolve()
        : store.setJSON(`${archivePrefix}form-profile`, currentProfile),
    ]);
    await Promise.all([
      ...currentEntries.blobs.map((blob) => store.delete(blob.key)),
      ...currentPeriods.blobs.map((blob) => store.delete(blob.key)),
      store.delete(scopedKey("form-profile")),
    ]);
    await Promise.all([
      ...sanitized.backup.entries.map((entry) =>
        store.setJSON(scopedKey(`entry/${entry.date}`), entry),
      ),
      ...sanitized.backup.periods.map((period) =>
        store.setJSON(scopedKey(`period/${period.id}`), period),
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
        : previousProfile?.status;
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
      base_salary_cents: amountCents(
        body.baseSalaryCents,
        previousProfile?.base_salary_cents,
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
      updated_at: new Date().toISOString(),
    };
    const payYear = Number(body.payYear);
    if (Number.isInteger(payYear) && payYear >= 2000 && payYear <= 2100) {
      const key = String(payYear);
      const previousYear = previousProfile?.pay_profiles?.[key] || {
        base_salary_cents: previousProfile?.base_salary_cents,
        ifse_cents: previousProfile?.ifse_cents,
        carence_cents: previousProfile?.carence_cents,
        other_fixed_cents: previousProfile?.other_fixed_cents,
        cia_cents: previousProfile?.cia_cents,
        cia_month: previousProfile?.cia_month,
        net_ratio_fixed_bp: previousProfile?.net_ratio_fixed_bp,
        net_ratio_variable_bp: previousProfile?.net_ratio_variable_bp,
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
    }
    await store.setJSON(scopedKey("form-profile"), formProfile);
    return json({ ok: true, form_profile: formProfile });
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
      if (!next.note_text && !next.leave && !next.wish && !next.holiday_pay)
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
      updated_at: new Date().toISOString(),
    };
    if (!next.note_text && !next.leave && !next.wish && !next.holiday_pay)
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
  const noteChanged = (previous?.note_text || "") !== noteText;
  const noteUpdatedAt = noteText
    ? noteChanged
      ? new Date().toISOString()
      : previous?.note_updated_at || new Date().toISOString()
    : "";
  if (!noteText && !leave && !wish && !holidayPay) {
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
    updated_at: new Date().toISOString(),
  } satisfies CalendarEntry);
  return json({ ok: true, noteUpdatedAt });
}
export default calendarHandler;
export const config = { path: "/api/calendar" };
