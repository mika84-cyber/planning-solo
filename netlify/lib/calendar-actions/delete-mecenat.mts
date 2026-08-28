import { json, validId } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleDeleteMecenat(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const id = typeof body.id === "string" ? body.id : "";
  if (!validId(id)) return json({ error: "Mécénat invalide" }, 400);
  await store.delete(scopedKey(`mecenat/${id}`));
  return json({ ok: true, deleted: true });
}
