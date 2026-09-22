import type { ColleagueDirectory, SharedColleaguePlanning } from "./colleagueSharingApi";

/** Dernier annuaire et derniers plannings partagés lus, par compte : la page
 *  des collègues s'affiche aussitôt avec eux, puis se met à jour sans se vider. */
export type ColleagueBoardCache = {
  directory: ColleagueDirectory;
  plannings: Record<string, SharedColleaguePlanning>;
};

const memory = new Map<string, ColleagueBoardCache>();

function storageKey(accountId: string) {
  return `planning:colleague-board-v1:${accountId.trim().toLowerCase() || "local"}`;
}

export function readColleagueBoardCache(accountId: string): ColleagueBoardCache | null {
  const key = storageKey(accountId);
  const cached = memory.get(key);
  if (cached) return cached;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null") as ColleagueBoardCache | null;
    if (!value?.directory?.self || typeof value.plannings !== "object") return null;
    memory.set(key, value);
    return value;
  } catch {
    return null;
  }
}

export function writeColleagueBoardCache(accountId: string, value: ColleagueBoardCache) {
  const key = storageKey(accountId);
  memory.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
