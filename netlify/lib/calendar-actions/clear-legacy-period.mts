import { isValidDateKey } from "../calendarValidation.mts";
import { json, listBlobs, type CalendarEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleClearLegacyPeriod(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    entryPrefix,
  } = context;
  const from = typeof body.from === "string" ? body.from : "";
  const to = typeof body.to === "string" ? body.to : "";
  if (!isValidDateKey(from) || !isValidDateKey(to) || to < from)
    return json({ error: "Période invalide" }, 400);
  const listed = await listBlobs(store, entryPrefix);
  for (const blob of listed.blobs) {
    const date = blob.key.slice(entryPrefix.length);
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
    if (
      !next.note_text &&
      !next.leave &&
      !next.wish &&
      !next.holiday_pay &&
      !next.closure_override
    )
      await store.delete(blob.key);
    else await store.setJSON(blob.key, next);
  }
  return json({ ok: true });
}
