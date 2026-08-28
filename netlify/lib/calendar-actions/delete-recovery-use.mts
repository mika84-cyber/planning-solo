import { json, validId } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleDeleteRecoveryUse(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const id = typeof body.id === "string" ? body.id : "";
  if (!validId(id)) return json({ error: "Récupération invalide" }, 400);
  await store.delete(scopedKey(`recovery-use/${id}`));
  return json({ ok: true, deleted: true });
}
