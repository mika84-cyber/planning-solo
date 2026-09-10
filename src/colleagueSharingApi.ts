export type ColleagueShareStatus = "pending" | "accepted" | "automatic" | "blocked";
export type ColleagueShare = {
  ownerId: string;
  viewerId: string;
  ownerName: string;
  viewerName: string;
  status: ColleagueShareStatus;
  createdAt: string;
  updatedAt: string;
  viewerSeenAt?: string;
};
export type ColleagueDirectory = {
  self: { userId: string; displayName: string; visible: boolean };
  canShareWithoutApproval: boolean;
  groups?: import("./colleagueGroups").ColleagueGroup[];
  directory: Array<{ userId: string; displayName: string }>;
  incoming: ColleagueShare[];
  outgoing: ColleagueShare[];
  blocked: Array<{ userId: string; displayName: string }>;
};
export type SharedColleaguePlanning = {
  owner: { userId: string; displayName: string };
  group: number;
  days: Array<{
    date: string;
    status: "work" | "training" | "rest" | "absence" | "partial";
    halfMoment?: "morning" | "afternoon";
    absentMinutes?: number;
  }>;
};

let cachedColleagueGroups: import("./colleagueGroups").ColleagueGroup[] | null = null;
export function clearColleagueGroupsCache() { cachedColleagueGroups = null; }

async function parse<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!response.ok) throw new Error(body?.error || "Le partage est momentanément indisponible.");
  return (body || {}) as T;
}

export async function getColleagueDirectory() {
  const directory = await parse<ColleagueDirectory>(await fetch("/api/colleagues", { cache: "no-store", credentials: "same-origin" }));
  if (directory.groups?.length) cachedColleagueGroups = directory.groups;
  return directory;
}

export async function getColleagueGroups() {
  if (cachedColleagueGroups) return cachedColleagueGroups;
  const response = await parse<{ groups: import("./colleagueGroups").ColleagueGroup[] }>(
    await fetch("/api/colleague-groups", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15000) }),
  );
  cachedColleagueGroups = response.groups;
  return response.groups;
}

export async function getSharedColleaguePlanning(ownerId: string) {
  return parse<SharedColleaguePlanning>(await fetch(`/api/colleagues?ownerId=${encodeURIComponent(ownerId)}`, {
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
    credentials: "same-origin",
  }));
}

export async function updateColleagueSharing(payload: Record<string, unknown>) {
  return parse<ColleagueDirectory>(await fetch("/api/colleagues", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
}
