import { isValidDateKey } from "../calendarValidation.mts";
import { COLORS, holidayPayFrom, json, type CalendarEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSaveEntry(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const date = typeof body.date === "string" ? body.date : "";
  if (!isValidDateKey(date)) return json({ error: "Date invalide" }, 400);
  const noteText =
    typeof body.noteText === "string" ? body.noteText.trim().slice(0, 300) : "";
  const noteColor =
    typeof body.noteColor === "string" && COLORS.has(body.noteColor)
      ? body.noteColor
      : "#D3943D";
  const leave = body.leave === true,
    wish = body.wish === true,
    key = scopedKey(`entry/${date}`);
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
  const holidayPay = holidayPayFrom(body, previous?.holiday_pay);
  const closureOverride =
    body.closureOverride === "closed" || body.closureOverride === "open"
      ? body.closureOverride
      : body.closureOverride === ""
        ? ""
        : previous?.closure_override || "";
  const noteChanged = (previous?.note_text || "") !== noteText;
  const noteUpdatedAt = noteText
    ? noteChanged
      ? new Date().toISOString()
      : previous?.note_updated_at || new Date().toISOString()
    : "";
  if (!noteText && !leave && !wish && !holidayPay && !closureOverride) {
    await store.delete(key);
    return json({ ok: true, deleted: true });
  }
  await store.setJSON(key, {
    date,
    note_text: noteText,
    note_color: noteColor,
    note_updated_at: noteUpdatedAt,
    note_group_id: "",
    leave,
    // Écrire une note ne doit pas effacer un congé souhaité posé sur le jour.
    wish,
    holiday_pay: holidayPay,
    closure_override: closureOverride || undefined,
    updated_at: new Date().toISOString(),
  } satisfies CalendarEntry);
  return json({ ok: true, noteUpdatedAt });
}
