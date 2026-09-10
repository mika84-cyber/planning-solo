import { LeaveRequestValidationError, normalizeLeaveRequest } from "../../../src/leaveRequest.ts";
import { overtimeRecoveryCreditMinutes, recoveryRequestMinutes, storedHolidayRecoveryCreditMinutes } from "../../../src/overtime.ts";
import { addDays, dateKey, fromKey, getDayInfo, LEAVE_ALLOWANCES } from "../../../src/planningLogic.ts";
import { json, listBlobs, type CalendarEntry, type FormProfile, type LeavePeriod, type LeaveType, type OvertimeEntry, type RecoveryUse } from "../calendarShared.mts";
import { acquireAtomicLock } from "../calendarAtomic.mts";
import type { CalendarActionContext } from "./context.mts";

type QuotaLeaveType = "annual" | "rtt" | "fraction";
type QuotaPeriod = { id: string; from: string; to: string; leaveType: string; group: number };

function quotaType(type: string): QuotaLeaveType | null {
  if (type === "half") return "annual";
  return type === "annual" || type === "rtt" || type === "fraction" ? type : null;
}

function quotaUsageByYear(periods: QuotaPeriod[]) {
  const usage: Record<string, Record<QuotaLeaveType, number>> = {};
  const counted = new Set<string>();
  for (const period of periods) {
    const type = quotaType(period.leaveType);
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
export async function handleSaveRequest(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
    entryPrefix,
    overtimePrefix,
    recoveryUsePrefix,
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
    const existingUsage = quotaUsageByYear(storedPeriods
      .filter((period) => !targetIds.has(period.id))
      .map((period) => ({
        id: period.id,
        from: period.from,
        to: period.to,
        leaveType: period.leave_type || "",
        group: period.group || normalized.group,
      })));
    const requestedUsage = quotaUsageByYear(normalized.periods.map((period) => ({
      id: period.id,
      from: period.from,
      to: period.to,
      leaveType: period.leaveType,
      group: period.group,
    })));
    for (const [year, categories] of Object.entries(requestedUsage)) {
      for (const type of ["annual", "rtt", "fraction"] as const) {
        if (categories[type] <= 0) continue;
        const manual = profile?.manual_adjustments?.[year];
        const manualUsed = type === "annual"
          ? manual?.annual_used || 0
          : type === "rtt"
            ? manual?.rtt_used || 0
            : manual?.fraction_used || 0;
        const remaining = LEAVE_ALLOWANCES[type] - manualUsed - (existingUsage[year]?.[type] || 0);
        if (remaining <= 0) return json({ error: emptyBalanceMessage(type) }, 409);
      }
    }
  }
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
      .reduce((total, item) => total + overtimeRecoveryCreditMinutes({
        id: item.id,
        date: item.date,
        minutes: item.minutes,
        dayMinutes: item.day_minutes,
        nightMinutes: item.night_minutes,
        disposition: item.disposition,
        inputMode: item.input_mode,
        start: item.start,
        end: item.end,
        updatedAt: item.updated_at,
      }, (key) => {
        const date = fromKey(key);
        return date.getDay() === 0 || Boolean(getDayInfo(date, normalized.group).holiday);
      }), 0);
    const earnedFromHolidays = storedHolidayRecoveryCreditMinutes(calendarValues
      .filter((item): item is CalendarEntry => Boolean(item))
      .filter((item) => item.holiday_pay === "recovery"));
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
  } finally {
    if (release) await release();
  }
}
