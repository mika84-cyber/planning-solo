import { isValidDateKey } from "../calendarValidation.mts";
import { storedHolidayRecoveryCreditMinutes } from "../../../src/overtime.ts";
import { json, listBlobs, validId, type CalendarEntry, type OvertimeEntry, type RecoveryUse } from "../calendarShared.mts";
import { acquireAtomicLock, readAtomic, writeAtomic } from "../calendarAtomic.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSaveRecoveryUse(
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
  const requestedId = typeof body.id === "string" ? body.id : "";
  const id = requestedId || crypto.randomUUID();
  const date = typeof body.date === "string" ? body.date : "";
  const minutes = Math.round(Number(body.minutes));
  if (!validId(id) || !isValidDateKey(date) || !Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60)
    return json({ error: "Utilisation de récupération invalide" }, 400);
  const release = await acquireAtomicLock(store, scopedKey("lock/recovery-balance"));
  if (!release) return json({ error: "Le solde est en cours de modification. Réessayez." }, 409);
  try {
  const [overtimeList, recoveryList, calendarList, previousVersion] = await Promise.all([
    listBlobs(store, overtimePrefix),
    listBlobs(store, recoveryUsePrefix),
    listBlobs(store, entryPrefix),
    readAtomic<RecoveryUse>(store, scopedKey(`recovery-use/${id}`)),
  ]);
  const previousUse = previousVersion.value;
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
  const holidayEarned = storedHolidayRecoveryCreditMinutes(calendarValues
    .filter((item): item is CalendarEntry => Boolean(item))
    .filter((item) => item.holiday_pay === "recovery"));
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
  const savedEtag = await writeAtomic(store, scopedKey(`recovery-use/${id}`), entry, previousVersion.etag);
  if (!savedEtag) return json({ error: "Cette récupération a été modifiée sur un autre appareil" }, 409);
  return json({ ok: true, recovery_use: entry, writeEtag: savedEtag });
  } finally {
    await release();
  }
}
