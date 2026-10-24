import { json, validId } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";

/** Une date d'inscription effacée, ou retenue (le mécénat déclaré la remplace). */
export async function handleDeleteMecenatSignup(
  context: CalendarActionContext,
): Promise<Response> {
  const { body, store, scopedKey } = context;
  const id = typeof body.id === "string" ? body.id : "";
  if (!validId(id)) return json({ error: "Date d’inscription invalide" }, 400);
  await store.delete(scopedKey(`mecenat-signup/${id}`));
  return json({ ok: true, deleted: true });
}
