import { sanitizeCalendarBackup } from "../calendarBackup.mts";
import { json, listBlobs } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleRestoreBackup(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
    entryPrefix,
    periodPrefix,
    overtimePrefix,
    recoveryUsePrefix,
    mecenatPrefix,
  } = context;
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
