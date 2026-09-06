import type { getStore } from "@netlify/blobs";

type Store = ReturnType<typeof getStore>;
export const CALENDAR_TOMBSTONE = Object.freeze({ __calendar_tombstone: true });

export function isCalendarTombstone(value: unknown) {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).__calendar_tombstone === true);
}

export async function readAtomic<T>(store: Store, key: string) {
  const result = await store.getWithMetadata(key, { type: "json" });
  const raw = result?.data ?? null;
  return { value: isCalendarTombstone(raw) ? null : raw as T | null, raw, etag: result?.etag || "" };
}

export async function writeAtomic(store: Store, key: string, value: unknown, etag: string) {
  const result = await store.setJSON(key, value, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
  return result.modified ? result.etag : "";
}

export async function restoreAtomic(store: Store, key: string, original: unknown, expectedCurrentEtag: string) {
  if (!expectedCurrentEtag) return false;
  const result = await store.setJSON(key, original === null ? CALENDAR_TOMBSTONE : original, { onlyIfMatch: expectedCurrentEtag });
  return result.modified;
}

type CalendarLock = { token: string; expiresAt: string };

/** Verrou court fondé sur les écritures conditionnelles réellement fournies
 * par Netlify Blobs. Un ancien verrou expiré est remplacé par CAS et la
 * libération ne peut jamais effacer le verrou repris par une autre requête. */
export async function acquireAtomicLock(
  store: Store,
  key: string,
  options: { attempts?: number; leaseMs?: number } = {},
) {
  const attempts = options.attempts ?? 8;
  const leaseMs = options.leaseMs ?? 30_000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await readAtomic<CalendarLock>(store, key);
    const expiresAt = current.value?.expiresAt ? Date.parse(current.value.expiresAt) : 0;
    if (current.value && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      await new Promise((resolve) => setTimeout(resolve, 12 + attempt * 8));
      continue;
    }
    const token = crypto.randomUUID();
    const etag = await writeAtomic(store, key, {
      token,
      expiresAt: new Date(Date.now() + leaseMs).toISOString(),
    } satisfies CalendarLock, current.etag);
    if (!etag) continue;
    return async () => {
      await restoreAtomic(store, key, null, etag);
    };
  }
  return null;
}
