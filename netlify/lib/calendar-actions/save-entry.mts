import { isValidDateKey } from "../calendarValidation.mts";
import { COLORS, holidayPayFrom, json, wishMomentFrom, type CalendarEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
import { CALENDAR_TOMBSTONE, readAtomic, writeAtomic } from "../calendarAtomic.mts";
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
  const version = await readAtomic<CalendarEntry>(store, key);
  const previous = version.value;
  if (
    typeof body.expectedUpdatedAt === "string" &&
    body.expectedUpdatedAt !== (previous?.updated_at || "")
  )
    return json(
      { error: "Cette journée a été modifiée sur un autre appareil" },
      409,
    );
  const holidayPay = holidayPayFrom(body, previous?.holiday_pay);
  const requestedHolidayMinutes = Number(body.holidayRecoveryMinutes);
  const holidayRecoveryMinutes = holidayPay === "recovery"
    ? body.holidayRecoveryMinutes === undefined
      ? previous?.holiday_recovery_minutes
      : [495, 375, 390, 240, 225].includes(requestedHolidayMinutes)
        ? requestedHolidayMinutes
        : undefined
    : undefined;
  const closureOverride =
    body.closureOverride === "closed" || body.closureOverride === "open"
      ? body.closureOverride
      : body.closureOverride === ""
        ? ""
        : previous?.closure_override || "";
  // Le poste suit la fiche du jour ; absent de la requête, il est conservé.
  const workPost =
    body.workPost === "counter" || body.workPost === "ticketing"
      ? body.workPost
      : body.workPost === undefined
        ? previous?.work_post || ""
        : "";
  const noteChanged = (previous?.note_text || "") !== noteText;
  const noteUpdatedAt = noteText
    ? noteChanged
      ? new Date().toISOString()
      : previous?.note_updated_at || new Date().toISOString()
    : "";
  if (!noteText && !leave && !wish && !holidayPay && !closureOverride && !workPost && !previous?.exchange_id) {
    const savedEtag = await writeAtomic(store, key, CALENDAR_TOMBSTONE, version.etag);
    if (!savedEtag)
      return json({ error: "Cette journée a été modifiée sur un autre appareil" }, 409);
    return json({ ok: true, deleted: true, writeEtag: savedEtag });
  }
  const updatedAt = new Date().toISOString();
  const savedEtag = await writeAtomic(store, key, {
    date,
    note_text: noteText,
    note_color: noteColor,
    note_updated_at: noteUpdatedAt,
    note_group_id: "",
    leave,
    // Écrire une note ne doit pas effacer un congé souhaité posé sur le jour.
    wish,
    wish_moment: wishMomentFrom(body, wish, previous?.wish_moment),
    holiday_pay: holidayPay,
    holiday_recovery_minutes: holidayRecoveryMinutes,
    closure_override: closureOverride || undefined,
    work_post: workPost || undefined,
    exchange_id: previous?.exchange_id,
    exchange_role: previous?.exchange_role,
    exchange_partner: previous?.exchange_partner,
    exchange_partner_group: previous?.exchange_partner_group,
    exchange_other_date: previous?.exchange_other_date,
    updated_at: updatedAt,
  } satisfies CalendarEntry, version.etag);
  if (!savedEtag) return json({ error: "Cette journée a été modifiée sur un autre appareil" }, 409);
  // La nouvelle version permet au client de garder la journée à jour sans
  // relire tout le calendrier.
  return json({ ok: true, noteUpdatedAt, writeEtag: savedEtag, updatedAt });
}
