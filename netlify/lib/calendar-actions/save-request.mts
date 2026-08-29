import { LeaveRequestValidationError, normalizeLeaveRequest } from "../../../src/leaveRequest.ts";
import { holidayRecoveryCreditMinutes, recoveryRequestMinutes } from "../../../src/overtime.ts";
import { json, listBlobs, type CalendarEntry, type FormProfile, type LeavePeriod, type LeaveType, type OvertimeEntry, type RecoveryUse } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
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
