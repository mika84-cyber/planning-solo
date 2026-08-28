import { holidayRecoveryCreditMinutes } from "../../../src/overtime.ts";
import { json, listBlobs, validId, type CalendarEntry, type FormProfile, type OvertimeEntry, type RecoveryUse } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleDeleteOvertime(
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
