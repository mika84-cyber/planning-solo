import { isValidDateKey } from "../calendarValidation.mts";
import { json, validId, type MecenatSignup } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";

/** Une date à laquelle la personne s'est inscrite pour un mécénat, avec ses
 *  horaires si elle les connaît, en attente d'être retenue (déclarée) ou effacée. */
export async function handleSaveMecenatSignup(
  context: CalendarActionContext,
): Promise<Response> {
  const { body, store, scopedKey } = context;
  const requestedId = typeof body.id === "string" ? body.id : "";
  const id = requestedId || crypto.randomUUID();
  const date = typeof body.date === "string" ? body.date : "";
  const hour = (value: unknown) => (typeof value === "string" && /^\d{2}:\d{2}$/.test(value.slice(0, 5)) ? value.slice(0, 5) : "");
  const start = hour(body.start);
  const end = hour(body.end);
  if (!validId(id) || !isValidDateKey(date))
    return json({ error: "Date d’inscription invalide" }, 400);
  const signup: MecenatSignup = {
    id,
    date,
    ...(start && end ? { start, end } : {}),
    updated_at: new Date().toISOString(),
  };
  await store.setJSON(scopedKey(`mecenat-signup/${id}`), signup);
  return json({ ok: true, mecenat_signup: signup });
}
