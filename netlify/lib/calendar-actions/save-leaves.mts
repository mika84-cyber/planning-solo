import { isValidDateKey } from "../calendarValidation.mts";
import { holidayPayFrom, json, type CalendarEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSaveLeaves(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const date = typeof body.date === "string" ? body.date : "";
  if (!isValidDateKey(date)) return json({ error: "Date invalide" }, 400);
  const key = scopedKey(`entry/${date}`);
  const previous = (await store.get(key, {
    type: "json",
  })) as CalendarEntry | null;
  if (
    typeof body.expectedUpdatedAt === "string" &&
    body.expectedUpdatedAt !== (previous?.updated_at || "")
  )
    return json(
      { error: "Cette journée a été modifiée sur un autre appareil" },
      409,
    );
  const next: CalendarEntry = {
    date,
    note_text: previous?.note_text || "",
    note_color: previous?.note_color || "#D3943D",
    note_updated_at: previous?.note_updated_at || "",
    note_group_id: previous?.note_group_id || "",
    leave: body.leave === true,
    wish: body.wish === true,
    holiday_pay: holidayPayFrom(body, previous?.holiday_pay),
    closure_override: previous?.closure_override,
    updated_at: new Date().toISOString(),
  };
  if (
    !next.note_text &&
    !next.leave &&
    !next.wish &&
    !next.holiday_pay &&
    !next.closure_override
  )
    await store.delete(key);
  else await store.setJSON(key, next);
  return json({ ok: true });
}
