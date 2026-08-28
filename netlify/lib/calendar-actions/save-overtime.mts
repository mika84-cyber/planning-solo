import { isValidDateKey } from "../calendarValidation.mts";
import { json, validId, type OvertimeEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSaveOvertime(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const requestedId = typeof body.id === "string" ? body.id : "";
  const id = requestedId || crypto.randomUUID();
  const date = typeof body.date === "string" ? body.date : "";
  const minutes = Math.round(Number(body.minutes));
  const dayMinutes = Math.round(Number(body.dayMinutes));
  const nightMinutes = Math.round(Number(body.nightMinutes));
  const disposition = body.disposition === "paid" || body.disposition === "recovery"
    ? body.disposition
    : null;
  const inputMode = body.inputMode === "range" || body.inputMode === "duration"
    ? body.inputMode
    : null;
  if (
    !validId(id) ||
    !isValidDateKey(date) ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > (id.startsWith("solidarity-") ? 600_000 : 24 * 60) ||
    !Number.isInteger(dayMinutes) ||
    !Number.isInteger(nightMinutes) ||
    dayMinutes < 0 ||
    nightMinutes < 0 ||
    dayMinutes + nightMinutes !== minutes ||
    !disposition ||
    !inputMode
  )
    return json({ error: "Déclaration d’heures supplémentaires invalide" }, 400);
  const entry: OvertimeEntry = {
    id,
    date,
    minutes,
    day_minutes: dayMinutes,
    night_minutes: nightMinutes,
    disposition,
    input_mode: inputMode,
    start: typeof body.start === "string" ? body.start.slice(0, 5) : "",
    end: typeof body.end === "string" ? body.end.slice(0, 5) : "",
    updated_at: new Date().toISOString(),
  };
  await store.setJSON(scopedKey(`overtime/${id}`), entry);
  return json({ ok: true, overtime_entry: entry });
}
