import { json, listBlobs } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleDeleteUserData(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  if (body.confirmation !== "SUPPRIMER")
    return json({ error: "Confirmation invalide" }, 400);
  const allUserData = await listBlobs(store, scopedKey(""));
  await Promise.all(allUserData.blobs.map((blob) => store.delete(blob.key)));
  return json({
    ok: true,
    deleted: allUserData.blobs.length,
  });
}
