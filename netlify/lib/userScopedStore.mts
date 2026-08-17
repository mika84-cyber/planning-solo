import type { getStore } from "@netlify/blobs";

type Store = ReturnType<typeof getStore>;

const LEGACY_OWNER_KEY = "migration/legacy-owner-v1";
const MIGRATION_MARKER = "migration/legacy-import-v1";

type LegacyOwner = {
  user_id: string;
  claimed_at: string;
};

/** Toutes les données fonctionnelles d'un compte vivent sous ce préfixe. */
export function userDataPrefix(userId: string) {
  return `user/${encodeURIComponent(userId)}/`;
}

export function userDataKey(userId: string, key: string) {
  return `${userDataPrefix(userId)}${key}`;
}

/**
 * Importe une seule fois les clés créées avant l'isolation par compte.
 *
 * Le verrou `onlyIfNew` garantit que les anciennes données ne peuvent être
 * revendiquées que par un seul compte. Les clés historiques restent en place
 * pour permettre un retour arrière, mais l'API ne les lit plus directement.
 */
export async function migrateLegacyData(store: Store, userId: string) {
  const markerKey = userDataKey(userId, MIGRATION_MARKER);
  if (await store.get(markerKey, { type: "json" })) return;

  const [legacyEntries, legacyPeriods, legacyProfile] = await Promise.all([
    store.list({ prefix: "entry/" }),
    store.list({ prefix: "period/" }),
    store.get("form-profile", { type: "json" }),
  ]);
  const hasLegacyData =
    legacyEntries.blobs.length > 0 ||
    legacyPeriods.blobs.length > 0 ||
    legacyProfile !== null;

  if (!hasLegacyData) {
    await store.setJSON(markerKey, {
      status: "no-legacy-data",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  let owner = (await store.get(LEGACY_OWNER_KEY, {
    type: "json",
  })) as LegacyOwner | null;
  if (!owner) {
    const claim: LegacyOwner = {
      user_id: userId,
      claimed_at: new Date().toISOString(),
    };
    const result = await store.setJSON(LEGACY_OWNER_KEY, claim, {
      onlyIfNew: true,
    });
    owner = result.modified
      ? claim
      : ((await store.get(LEGACY_OWNER_KEY, {
          type: "json",
        })) as LegacyOwner | null);
  }

  if (owner?.user_id !== userId) {
    await store.setJSON(markerKey, {
      status: "owned-by-another-user",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const copyBlob = async (key: string) => {
    const value = await store.get(key, { type: "json" });
    if (value !== null)
      await store.setJSON(userDataKey(userId, key), value, {
        onlyIfNew: true,
      });
  };
  await Promise.all([
    ...legacyEntries.blobs.map((blob) => copyBlob(blob.key)),
    ...legacyPeriods.blobs.map((blob) => copyBlob(blob.key)),
    legacyProfile === null
      ? Promise.resolve()
      : store.setJSON(userDataKey(userId, "form-profile"), legacyProfile, {
          onlyIfNew: true,
        }),
  ]);
  await store.setJSON(markerKey, {
    status: "migrated",
    completed_at: new Date().toISOString(),
  });
}
