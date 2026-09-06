export type ResourceFavoriteKind = "documents" | "contacts";

export function resourceFavoritesKey(accountId: string, kind: ResourceFavoriteKind) {
  return `planning:resource-favorites-v1:${encodeURIComponent(accountId.trim().toLowerCase())}:${kind}`;
}

export function readResourceFavorites(accountId: string, kind: ResourceFavoriteKind, storage?: Pick<Storage, "getItem">) {
  if (!accountId.trim()) return [] as string[];
  try {
    const resolvedStorage = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
    if (!resolvedStorage) return [] as string[];
    const parsed = JSON.parse(resolvedStorage.getItem(resourceFavoritesKey(accountId, kind)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

export function writeResourceFavorites(accountId: string, kind: ResourceFavoriteKind, values: string[], storage?: Pick<Storage, "setItem">) {
  if (!accountId.trim()) return;
  const resolvedStorage = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  resolvedStorage?.setItem(resourceFavoritesKey(accountId, kind), JSON.stringify([...new Set(values)]));
}
