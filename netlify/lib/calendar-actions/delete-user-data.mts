import { json, listBlobs } from "../calendarShared.mts";
import { MIGRATION_MARKER } from "../userScopedStore.mts";
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
  // Le repère de migration survit à l’effacement : sans lui, les anciennes
  // données d’avant la séparation par compte, si elles n’ont jamais été
  // archivées, seraient recopiées dans le compte à la requête suivante.
  const markerKey = scopedKey(MIGRATION_MARKER);
  const allUserData = await listBlobs(store, scopedKey(""));
  const erased = allUserData.blobs.filter((blob) => blob.key !== markerKey);
  await Promise.all(erased.map((blob) => store.delete(blob.key)));
  await store.setJSON(markerKey, {
    status: "user-data-deleted",
    completed_at: new Date().toISOString(),
  });
  return json({
    ok: true,
    deleted: erased.length,
  });
}
