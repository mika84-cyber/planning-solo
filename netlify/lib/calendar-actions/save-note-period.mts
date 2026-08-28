import { isValidDateKey } from "../calendarValidation.mts";
import { COLORS, clearNote, dateKeys, json, listBlobs, rangeSpan, validId, type CalendarEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSaveNotePeriod(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
    entryPrefix,
  } = context;
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
      closure_override: previous?.closure_override,
      updated_at: updatedAt,
    } satisfies CalendarEntry);
  }
  return json({ ok: true, groupId });
}
