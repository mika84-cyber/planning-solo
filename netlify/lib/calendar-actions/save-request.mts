import { LeaveRequestValidationError, normalizeLeaveRequest } from "../../../src/leaveRequest.ts";
import { recoveryRequestMinutes } from "../../../src/overtime.ts";
import { addDays, dateKey, fromKey, getDayInfo, LEAVE_ALLOWANCES } from "../../../src/planningLogic.ts";
import { fractionAllowance, isOffSeasonDate } from "../../../src/fractionRules.ts";
import { annualCharges } from "../../../src/annualCarryOver.ts";
import { json, listBlobs, type FormProfile, type LeavePeriod, type LeaveType, type RecoveryUse } from "../calendarShared.mts";
import { acquireAtomicLock } from "../calendarAtomic.mts";
import { readRecoveryBalance } from "../recoveryBalance.mts";
import type { CalendarActionContext } from "./context.mts";

type QuotaLeaveType = "annual" | "rtt" | "fraction";
type QuotaPeriod = { id: string; from: string; to: string; leaveType: string; halfBalance?: string; group: number };

/** Solde consommé : une demi-journée est prise sur le solde choisi, CA par
 *  défaut. */
function quotaType(type: string, halfBalance?: string): QuotaLeaveType | null {
  // Une demi-journée d'ASA ou de Divers ne consomme aucun quota.
  if (type === "half")
    return halfBalance === "exceptional" || halfBalance === "other" ? null
      : halfBalance === "rtt" || halfBalance === "fraction" ? halfBalance : "annual";
  return type === "annual" || type === "rtt" || type === "fraction" ? type : null;
}

/** Jours pris par solde et par année civile. */
function quotaUsageByYear(periods: QuotaPeriod[]) {
  const usage: Record<string, Record<QuotaLeaveType, number>> = {};
  const counted = new Set<string>();
  for (const period of periods) {
    const type = quotaType(period.leaveType, period.halfBalance);
    if (!type) continue;
    const units = period.leaveType === "half" ? 0.5 : 1;
    for (let date = fromKey(period.from); dateKey(date) <= period.to; date = addDays(date, 1)) {
      const key = dateKey(date);
      const info = getDayInfo(date, period.group);
      if (info.holiday || info.kind === "off") continue;
      const unique = `${type}:${key}:${units}`;
      if (counted.has(unique)) continue;
      counted.add(unique);
      const year = key.slice(0, 4);
      usage[year] ||= { annual: 0, rtt: 0, fraction: 0 };
      usage[year][type] += units;
    }
  }
  return usage;
}

function emptyBalanceMessage(type: QuotaLeaveType) {
  if (type === "annual") return "Vous n’avez plus de congés annuels disponibles.";
  if (type === "rtt") return "Vous n’avez plus de RTT disponibles.";
  return "Vous n’avez plus de jours de fractionnement disponibles.";
}

/** Une demande ne pose jamais plus de jours qu'il n'en reste. */
function shortageMessage(type: QuotaLeaveType, available: number) {
  if (available <= 0) return emptyBalanceMessage(type);
  const category = type === "annual" ? "de congés annuels" : type === "rtt" ? "de RTT" : "de fractionnement";
  const amount = `${available.toLocaleString("fr-FR")} jour${available > 1 ? "s" : ""}`;
  return `Solde insuffisant : il ne reste que ${amount} ${category} pour cette demande.`;
}
export async function handleSaveRequest(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
    periodPrefix,
  } = context;
  let normalized: ReturnType<typeof normalizeLeaveRequest>;
  try {
    normalized = normalizeLeaveRequest(body);
  } catch (error) {
    return json(
      { error: error instanceof LeaveRequestValidationError ? error.message : "Demande de congé invalide" },
      400,
    );
  }
  const balanceLock = normalized.requestKind === "recovery"
    ? "lock/recovery-balance"
    : "lock/leave-balance";
  const release = await acquireAtomicLock(store, scopedKey(balanceLock));
  if (!release)
    return json({ error: "Le solde est en cours de modification. Réessayez." }, 409);
  try {

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
      ...(candidate.leaveType === "half" && candidate.halfBalance
        ? { half_balance: candidate.halfBalance }
        : {}),
      group: candidate.group,
      updated_at: new Date().toISOString(),
    } satisfies LeavePeriod,
  }));
  let recoveryTargets: Array<{ key: string; value: RecoveryUse }> = [];
  if (normalized.requestKind === "leave") {
    const [profile, periodList] = await Promise.all([
      store.get(scopedKey("form-profile"), { type: "json" }) as Promise<FormProfile | null>,
      listBlobs(store, periodPrefix),
    ]);
    const storedPeriods = (await Promise.all(periodList.blobs.map((blob) =>
      store.get(blob.key, { type: "json" }) as Promise<LeavePeriod | null>,
    ))).filter((period): period is LeavePeriod => Boolean(period));
    const targetIds = new Set(normalized.periods.map((period) => period.id));
    const existingPeriods = storedPeriods
      .filter((period) => !targetIds.has(period.id))
      .map((period) => ({
        id: period.id,
        from: period.from,
        to: period.to,
        leaveType: period.leave_type || "",
        halfBalance: period.half_balance,
        group: period.group || normalized.group,
      }));
    const requestedPeriods = normalized.periods.map((period) => ({
      id: period.id,
      from: period.from,
      to: period.to,
      leaveType: period.leaveType,
      halfBalance: period.halfBalance,
      group: period.group,
    }));
    const existingUsage = quotaUsageByYear(existingPeriods);
    const requestedUsage = quotaUsageByYear(requestedPeriods);
    // Congés annuels : les restes d'une année se prennent jusqu'au 30 avril
    // suivant. Chaque jour est décompté sur l'année dont il consomme le solde,
    // comme dans l'application ; la demande est refusée dès qu'elle dépasse
    // ce qui reste à cette année-là.
    const annualAvailable = (year: number) =>
      LEAVE_ALLOWANCES.annual - (profile?.manual_adjustments?.[String(year)]?.annual_used || 0);
    const existingAnnual = annualCharges(existingPeriods, annualAvailable);
    const combinedAnnual = annualCharges([...existingPeriods, ...requestedPeriods], annualAvailable);
    for (const [year, total] of combinedAnnual.charged) {
      const before = existingAnnual.charged.get(year) || 0;
      if (total > before && total > annualAvailable(year))
        return json({ error: shortageMessage("annual", annualAvailable(year) - before) }, 409);
    }
    // Les CA posés hors mai–octobre ouvrent le fractionnement de l'année
    // dont ils consomment le solde (jusqu'au 30 avril suivant compris).
    const offSeasonAnnual = (year: string) => combinedAnnual.charges
      .filter((charge) => String(charge.year) === year && isOffSeasonDate(charge.date))
      .reduce((sum, charge) => sum + charge.units, 0);
    for (const [year, categories] of Object.entries(requestedUsage)) {
      for (const type of ["rtt", "fraction"] as const) {
        if (categories[type] <= 0) continue;
        const manual = profile?.manual_adjustments?.[year];
        const manualUsed = type === "rtt" ? manual?.rtt_used || 0 : manual?.fraction_used || 0;
        const allowance = type === "fraction"
          ? fractionAllowance(Number(year), offSeasonAnnual(year))
          : LEAVE_ALLOWANCES[type];
        const remaining = allowance - manualUsed - (existingUsage[year]?.[type] || 0);
        if (categories[type] > remaining) return json({ error: shortageMessage(type, remaining) }, 409);
      }
    }
  }
  if (normalized.requestKind === "recovery") {
    const balance = await readRecoveryBalance(context, normalized.group);
    const quota = balance.profile?.work_quota || "full";
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
    const targetIds = new Set(recoveryTargets.map(({ value }) => value.id));
    const usedOutsideRequest = balance.recoveryUses
      .filter((item) => !targetIds.has(item.id))
      .reduce((total, item) => total + item.minutes, 0);
    const requested = recoveryTargets.reduce(
      (total, { value }) => total + value.minutes,
      0,
    );
    if (usedOutsideRequest + requested > balance.earned)
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
  } finally {
    if (release) await release();
  }
}
