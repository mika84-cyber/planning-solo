import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
export default async (request: Request) => {
  const user = await getUser();
  if (!user?.email) return json({ error: "Connexion requise" }, 401);
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  if (request.method === "GET") {
    const [listed, listedPeriods, formProfile] = await Promise.all([
      store.list({ prefix: "entry/" }),
      store.list({ prefix: "period/" }),
      store.get("form-profile", {
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
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return json({ error: "Requête invalide" }, 400);
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
    const previousProfile = (await store.get("form-profile", {
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
      updated_at: new Date().toISOString(),
    };
    await store.setJSON("form-profile", formProfile);
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
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from)
      return json({ error: "Période invalide" }, 400);
    const span = rangeSpan(from, to);
    if (span < 1 || span > 366)
      return json({ error: "Période trop longue" }, 400);
    if (requestedId && !validId(requestedId))
      return json({ error: "Identifiant invalide" }, 400);
    const id = requestedId || crypto.randomUUID();
    const previous = requestedId
      ? ((await store.get(`period/${id}`, {
          type: "json",
        })) as LeavePeriod | null)
      : null;
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
    await store.setJSON(`period/${id}`, period);
    return json({ ok: true, period });
  }
  if (body.action === "delete-period") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!validId(id)) return json({ error: "Identifiant invalide" }, 400);
    await store.delete(`period/${id}`);
    return json({ ok: true, deleted: true });
  }
  if (body.action === "clear-legacy-period") {
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from)
      return json({ error: "Période invalide" }, 400);
    const listed = await store.list({ prefix: "entry/" });
    for (const blob of listed.blobs) {
      const date = blob.key.slice("entry/".length);
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
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from || !noteText)
      return json({ error: "Période de note invalide" }, 400);
    if (rangeSpan(from, to) > 366)
      return json({ error: "Période trop longue" }, 400);
    if (requestedId && !validId(requestedId))
      return json({ error: "Identifiant invalide" }, 400);
    const groupId = requestedId || crypto.randomUUID();
    const listed = await store.list({ prefix: "entry/" });
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
      const key = `entry/${date}`;
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
    if (!groupId && !DATE_RE.test(date))
      return json({ error: "Note invalide" }, 400);
    if (groupId) {
      const listed = await store.list({ prefix: "entry/" });
      for (const blob of listed.blobs) {
        const entry = (await store.get(blob.key, {
          type: "json",
        })) as CalendarEntry | null;
        if (entry?.note_group_id === groupId)
          await clearNote(store, blob.key, entry);
      }
    } else {
      const key = `entry/${date}`;
      const entry = (await store.get(key, {
        type: "json",
      })) as CalendarEntry | null;
      if (entry) await clearNote(store, key, entry);
    }
    return json({ ok: true });
  }
  if (body.action === "save-leaves") {
    const date = typeof body.date === "string" ? body.date : "";
    if (!DATE_RE.test(date)) return json({ error: "Date invalide" }, 400);
    const key = `entry/${date}`;
    const previous = (await store.get(key, {
      type: "json",
    })) as CalendarEntry | null;
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
  if (!DATE_RE.test(date)) return json({ error: "Date invalide" }, 400);
  const noteText =
    typeof body.noteText === "string" ? body.noteText.trim().slice(0, 300) : "";
  const noteColor =
    typeof body.noteColor === "string" && COLORS.has(body.noteColor)
      ? body.noteColor
      : "#D3943D";
  const leave = body.leave === true,
    wish = body.wish === true,
    key = `entry/${date}`;
  const previous = (await store.get(key, {
    type: "json",
  })) as CalendarEntry | null;
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
};
export const config = { path: "/api/calendar" };
