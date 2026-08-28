import { LEGACY_OWNER_KEY } from "../userScopedStore.mts";
import { json, listBlobs } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleArchiveLegacyData(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    user,
    store,
    scopedKey,
  } = context;
  if (body.confirmation !== "ARCHIVER")
    return json({ error: "Confirmation invalide" }, 400);
  const owner = (await store.get(LEGACY_OWNER_KEY, {
    type: "json",
  })) as { user_id?: string } | null;
  if (owner?.user_id !== user.id)
    return json({ error: "Ces données historiques ne vous appartiennent pas" }, 403);
  const [legacyEntries, legacyPeriods, legacyProfile] = await Promise.all([
    listBlobs(store, "entry/"),
    listBlobs(store, "period/"),
    store.get("form-profile", { type: "json" }),
  ]);
  const legacyKeys = [
    ...legacyEntries.blobs.map((blob) => blob.key),
    ...legacyPeriods.blobs.map((blob) => blob.key),
  ];
  await Promise.all([
    ...legacyKeys.map(async (key) => {
      const value = await store.get(key, { type: "json" });
      if (value !== null)
        await store.setJSON(scopedKey(`legacy-archive-v1/${key}`), value);
    }),
    legacyProfile === null
      ? Promise.resolve()
      : store.setJSON(
          scopedKey("legacy-archive-v1/form-profile"),
          legacyProfile,
        ),
  ]);
  await Promise.all([
    ...legacyKeys.map((key) => store.delete(key)),
    ...(legacyProfile === null ? [] : [store.delete("form-profile")]),
  ]);
  return json({
    ok: true,
    archived: legacyKeys.length + (legacyProfile === null ? 0 : 1),
  });
}
