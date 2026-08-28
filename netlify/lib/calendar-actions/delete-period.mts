import { json, validId, type LeavePeriod } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleDeletePeriod(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const id = typeof body.id === "string" ? body.id : "";
  if (!validId(id)) return json({ error: "Identifiant invalide" }, 400);
  if (typeof body.expectedUpdatedAt === "string") {
    const previous = (await store.get(scopedKey(`period/${id}`), {
      type: "json",
    })) as LeavePeriod | null;
    if (body.expectedUpdatedAt !== (previous?.updated_at || ""))
      return json(
        { error: "Cette période a été modifiée sur un autre appareil" },
        409,
      );
  }
  await store.delete(scopedKey(`period/${id}`));
  return json({ ok: true, deleted: true });
}
