import { isValidDateKey } from "../calendarValidation.mts";
import { holidayRecoveryCreditMinutes } from "../../../src/overtime.ts";
import { json, listBlobs, validId, type CalendarEntry, type FormProfile, type OvertimeEntry, type RecoveryUse } from "../calendarShared.mts";
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
