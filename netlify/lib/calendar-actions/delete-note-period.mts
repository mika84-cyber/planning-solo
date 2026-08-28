import { isValidDateKey } from "../calendarValidation.mts";
import { clearNote, json, listBlobs, validId, type CalendarEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleDeleteNotePeriod(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
    entryPrefix,
  } = context;
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
