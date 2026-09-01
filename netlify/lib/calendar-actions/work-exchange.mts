import { isValidDateKey } from "../calendarValidation.mts";
import { json, validId, type CalendarEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";

function emptyEntry(date: string): CalendarEntry {
  return {
    date,
    note_text: "",
    note_color: "#D3943D",
    note_updated_at: "",
    note_group_id: "",
    leave: false,
    wish: false,
    updated_at: "",
  };
}

function hasContent(entry: CalendarEntry) {
  return Boolean(
    entry.note_text || entry.leave || entry.wish || entry.holiday_pay ||
    entry.closure_override || entry.exchange_id,
  );
}

function expectedVersions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, version]) => typeof version === "string"),
  ) as Record<string, string>;
}

async function loadAffected(
  context: CalendarActionContext,
  dates: string[],
  expected: Record<string, string>,
) {
  const rows = new Map<string, CalendarEntry | null>();
  for (const date of dates) {
    const entry = await context.store.get(context.scopedKey(`entry/${date}`), {
      type: "json",
    }) as CalendarEntry | null;
    if ((expected[date] ?? "") !== (entry?.updated_at || ""))
      return { error: "Une des journées a été modifiée sur un autre appareil" as const };
    rows.set(date, entry);
  }
  return { rows };
}

async function writeWithRollback(
  context: CalendarActionContext,
  previous: Map<string, CalendarEntry | null>,
  next: Map<string, CalendarEntry>,
) {
  const results: Array<{ date: string; updatedAt: string; deleted: boolean }> = [];
  try {
    for (const [date, entry] of next) {
      const key = context.scopedKey(`entry/${date}`);
      if (hasContent(entry)) {
        await context.store.setJSON(key, entry);
        results.push({ date, updatedAt: entry.updated_at, deleted: false });
      } else {
        await context.store.delete(key);
        results.push({ date, updatedAt: "", deleted: true });
      }
    }
  } catch {
    for (const [date, entry] of previous) {
      const key = context.scopedKey(`entry/${date}`);
      if (entry) await context.store.setJSON(key, entry);
      else await context.store.delete(key);
    }
    return null;
  }
  return results;
}

export async function handleSaveExchange(context: CalendarActionContext) {
  const id = typeof context.body.id === "string" ? context.body.id : "";
  const partner = typeof context.body.partnerName === "string"
    ? context.body.partnerName.trim().slice(0, 80)
    : "";
  const partnerGroup = Number(context.body.partnerGroup);
  const agreementDate = typeof context.body.agreementDate === "string"
    ? context.body.agreementDate
    : "";
  const returnDate = typeof context.body.returnDate === "string"
    ? context.body.returnDate
    : "";
  const previousAgreementDate = typeof context.body.previousAgreementDate === "string"
    ? context.body.previousAgreementDate
    : "";
  const previousReturnDate = typeof context.body.previousReturnDate === "string"
    ? context.body.previousReturnDate
    : "";
  if (
    !validId(id) || !partner || ![1, 2, 3].includes(partnerGroup) ||
    !isValidDateKey(agreementDate) || !isValidDateKey(returnDate) ||
    returnDate === agreementDate ||
    (previousAgreementDate && !isValidDateKey(previousAgreementDate)) ||
    (previousReturnDate && !isValidDateKey(previousReturnDate)) ||
    Boolean(previousAgreementDate) !== Boolean(previousReturnDate)
  ) return json({ error: "Échange invalide" }, 400);

  const dates = [...new Set([
    agreementDate, returnDate, previousAgreementDate, previousReturnDate,
  ].filter(Boolean))];
  const loaded = await loadAffected(context, dates, expectedVersions(context.body.expectedUpdatedAts));
  if ("error" in loaded) return json({ error: loaded.error }, 409);
  const previous = loaded.rows;
  for (const date of [agreementDate, returnDate]) {
    const otherId = previous.get(date)?.exchange_id;
    if (otherId && otherId !== id)
      return json({ error: "Une des journées appartient déjà à un autre échange" }, 409);
  }
  if (previousAgreementDate && previous.get(previousAgreementDate)?.exchange_id !== id)
    return json({ error: "L’échange à modifier est introuvable" }, 409);
  if (previousReturnDate && previous.get(previousReturnDate)?.exchange_id !== id)
    return json({ error: "L’échange à modifier est incomplet" }, 409);

  const now = new Date().toISOString();
  const next = new Map<string, CalendarEntry>();
  for (const date of dates) {
    const entry = { ...(previous.get(date) || emptyEntry(date)) };
    delete entry.exchange_id;
    delete entry.exchange_role;
    delete entry.exchange_partner;
    delete entry.exchange_partner_group;
    delete entry.exchange_other_date;
    entry.updated_at = now;
    if (date === agreementDate || date === returnDate) {
      entry.exchange_id = id;
      entry.exchange_role = date === agreementDate ? "given" : "return";
      entry.exchange_partner = partner;
      entry.exchange_partner_group = partnerGroup;
      entry.exchange_other_date = date === agreementDate ? returnDate : agreementDate;
    }
    next.set(date, entry);
  }
  const results = await writeWithRollback(context, previous, next);
  return results
    ? json({ ok: true, entries: results })
    : json({ error: "L’échange n’a pas pu être enregistré" }, 500);
}

export async function handleDeleteExchange(context: CalendarActionContext) {
  const id = typeof context.body.id === "string" ? context.body.id : "";
  const agreementDate = typeof context.body.agreementDate === "string"
    ? context.body.agreementDate
    : "";
  const returnDate = typeof context.body.returnDate === "string"
    ? context.body.returnDate
    : "";
  if (!validId(id) || !isValidDateKey(agreementDate) || !isValidDateKey(returnDate))
    return json({ error: "Échange invalide" }, 400);
  const dates = [...new Set([agreementDate, returnDate])];
  const loaded = await loadAffected(context, dates, expectedVersions(context.body.expectedUpdatedAts));
  if ("error" in loaded) return json({ error: loaded.error }, 409);
  if (dates.some((date) => loaded.rows.get(date)?.exchange_id !== id))
    return json({ error: "L’échange à supprimer est incomplet" }, 409);

  const now = new Date().toISOString();
  const next = new Map<string, CalendarEntry>();
  for (const date of dates) {
    const entry = { ...(loaded.rows.get(date) || emptyEntry(date)) };
    delete entry.exchange_id;
    delete entry.exchange_role;
    delete entry.exchange_partner;
    delete entry.exchange_partner_group;
    delete entry.exchange_other_date;
    entry.updated_at = now;
    next.set(date, entry);
  }
  const results = await writeWithRollback(context, loaded.rows, next);
  return results
    ? json({ ok: true, entries: results })
    : json({ error: "L’échange n’a pas pu être supprimé" }, 500);
}
