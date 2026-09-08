import { getStore } from "@netlify/blobs";
import { admin, getUser } from "@netlify/identity";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { sendColleagueSharingEmail } from "../lib/colleagueSharingEmail.mts";
import { COLLEAGUE_GROUPS } from "../lib/colleagueGroups.ts";
import { isMikaSharingAccount } from "../lib/sharedCalendarBridge.mts";
import { userDataKey } from "../lib/userScopedStore.mts";
import { personalPresenceForDate, type Entries, type LeavePeriod } from "../../src/appModel.ts";
import { dailyMinutesForQuota, type WorkQuota } from "../../src/overtime.ts";
import { GRAND_PALAIS_EXCEPTIONAL_CLOSURES } from "../../src/grandPalaisClosures.ts";

type Store = ReturnType<typeof getStore>;
type ShareStatus = "pending" | "accepted" | "automatic" | "blocked";
type PublicProfile = {
  userId: string;
  displayName: string;
  email?: string;
  visible: boolean;
  updatedAt: string;
};
type Share = {
  ownerId: string;
  viewerId: string;
  ownerName: string;
  viewerName: string;
  status: ShareStatus;
  createdAt: string;
  updatedAt: string;
  viewerSeenAt?: string;
};
type ColleagueBlock = {
  blockerId: string;
  blockedId: string;
  blockedName: string;
  createdAt: string;
};

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const profileKey = (userId: string) => `colleagues/profile/${encodeURIComponent(userId)}`;
const ownerShareKey = (ownerId: string, viewerId: string) =>
  `colleagues/share/owner/${encodeURIComponent(ownerId)}/${encodeURIComponent(viewerId)}`;
const viewerShareKey = (viewerId: string, ownerId: string) =>
  `colleagues/share/viewer/${encodeURIComponent(viewerId)}/${encodeURIComponent(ownerId)}`;
const blockerKey = (blockerId: string, blockedId: string) =>
  `colleagues/block/by-user/${encodeURIComponent(blockerId)}/${encodeURIComponent(blockedId)}`;
const blockedKey = (blockedId: string, blockerId: string) =>
  `colleagues/block/against-user/${encodeURIComponent(blockedId)}/${encodeURIComponent(blockerId)}`;
const validUserId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{3,128}$/.test(value);

function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  const name = value.replace(/\s+/g, " ").trim().slice(0, 60);
  return name.length >= 2 && !name.includes("@") ? name : "";
}

async function listAll(store: Store, prefix: string) {
  const items: Array<{ key: string }> = [];
  const pages = store.list({ prefix, paginate: true });
  if (Symbol.asyncIterator in Object(pages)) {
    for await (const page of pages) items.push(...page.blobs);
  } else {
    const page = await (pages as unknown as Promise<{ blobs: Array<{ key: string }> }>);
    items.push(...page.blobs);
  }
  return items;
}

async function readMany<T>(store: Store, prefix: string) {
  const blobs = await listAll(store, prefix);
  return (await Promise.all(blobs.map((blob) => store.get(blob.key, { type: "json" }))))
    .filter((value): value is T => Boolean(value));
}

async function writeShare(store: Store, share: Share) {
  await Promise.all([
    store.setJSON(ownerShareKey(share.ownerId, share.viewerId), share),
    store.setJSON(viewerShareKey(share.viewerId, share.ownerId), share),
  ]);
}

async function removeShare(store: Store, ownerId: string, viewerId: string) {
  await Promise.all([
    store.delete(ownerShareKey(ownerId, viewerId)),
    store.delete(viewerShareKey(viewerId, ownerId)),
  ]);
}

async function writeBlock(store: Store, block: ColleagueBlock) {
  await Promise.all([
    store.setJSON(blockerKey(block.blockerId, block.blockedId), block),
    store.setJSON(blockedKey(block.blockedId, block.blockerId), block),
  ]);
}

async function removeBlock(store: Store, blockerId: string, blockedId: string) {
  await Promise.all([
    store.delete(blockerKey(blockerId, blockedId)),
    store.delete(blockedKey(blockedId, blockerId)),
  ]);
}

async function readProfile(store: Store, userId: string) {
  return (await store.get(profileKey(userId), { type: "json" })) as PublicProfile | null;
}

async function recipientEmail(store: Store, profile: PublicProfile) {
  try {
    const identityUser = await admin.getUser(profile.userId);
    const email = typeof identityUser.email === "string" ? identityUser.email.trim().toLocaleLowerCase("fr") : "";
    if (email && email !== profile.email) {
      await store.setJSON(profileKey(profile.userId), { ...profile, email, updatedAt: new Date().toISOString() });
    }
    return email || profile.email?.trim() || "";
  } catch (error) {
    console.warn("Adresse Identity momentanément indisponible", error instanceof Error ? error.message : error);
    return profile.email?.trim() || "";
  }
}

async function initialName(store: Store, userId: string) {
  const profile = (await store.get(userDataKey(userId, "form-profile"), { type: "json" })) as
    | { full_name?: unknown }
    | null;
  return cleanName(profile?.full_name);
}

function emailName(email: string) {
  const words = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return cleanName(words.replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr"))) || "Collègue";
}

async function ensureProfile(store: Store, userId: string, email: string, knownName = "") {
  const existing = await readProfile(store, userId);
  if (existing) {
    const identityName = cleanName(knownName);
    if (existing.email !== email || (!existing.visible && identityName && existing.displayName !== identityName)) {
      const updated = {
        ...existing,
        email,
        displayName: !existing.visible && identityName ? identityName : existing.displayName,
        updatedAt: new Date().toISOString(),
      };
      await store.setJSON(profileKey(userId), updated);
      return updated;
    }
    return existing;
  }
  const profile: PublicProfile = {
    userId,
    displayName: cleanName(knownName) || (await initialName(store, userId)) || emailName(email),
    email,
    visible: false,
    updatedAt: new Date().toISOString(),
  };
  await store.setJSON(profileKey(userId), profile);
  return profile;
}

async function ensureIdentityDirectory(store: Store) {
  try {
    for (let page = 1; page <= 20; page += 1) {
      const users = await admin.listUsers({ page, perPage: 100 });
      await Promise.all(users.map((user) =>
        user.email ? ensureProfile(store, user.id, user.email, user.name) : Promise.resolve(),
      ));
      if (users.length < 100) break;
    }
  } catch (error) {
    console.warn("Annuaire Identity momentanément indisponible", error);
  }
}

async function directoryResponse(store: Store, userId: string, email: string) {
  const privileged = await isMikaSharingAccount(email);
  if (privileged) await ensureIdentityDirectory(store);
  await ensureProfile(store, userId, email);
  const [self, profiles, incoming, outgoing, blockedByMe, blockedMe] = await Promise.all([
    readProfile(store, userId),
    readMany<PublicProfile>(store, "colleagues/profile/"),
    readMany<Share>(store, `colleagues/share/viewer/${encodeURIComponent(userId)}/`),
    readMany<Share>(store, `colleagues/share/owner/${encodeURIComponent(userId)}/`),
    readMany<ColleagueBlock>(store, `colleagues/block/by-user/${encodeURIComponent(userId)}/`),
    readMany<ColleagueBlock>(store, `colleagues/block/against-user/${encodeURIComponent(userId)}/`),
  ]);
  const excludedIds = new Set([
    ...blockedByMe.map((block) => block.blockedId),
    ...blockedMe.map((block) => block.blockerId),
  ]);
  const approvalShare = (share: Share): Share =>
    share.status === "automatic" ? { ...share, status: "pending" } : share;
  return json({
    self: self
      ? { userId: self.userId, displayName: self.displayName, visible: self.visible }
      : { userId, displayName: await initialName(store, userId), visible: false },
    canShareWithoutApproval: privileged,
    groups: COLLEAGUE_GROUPS,
    directory: profiles
      .filter((profile) => (privileged || profile.visible) && Boolean(profile.email) && profile.userId !== userId && !excludedIds.has(profile.userId))
      .map(({ userId: id, displayName }) => ({ userId: id, displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
    incoming: incoming.map(approvalShare).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    outgoing: outgoing.map(approvalShare).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    blocked: blockedByMe
      .map((block) => ({ userId: block.blockedId, displayName: block.blockedName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
  });
}

async function sharedPlanningResponse(store: Store, viewerId: string, ownerId: string) {
  const viewer = await readProfile(store, viewerId);
  if (!viewer?.visible) return json({ error: "Inscrivez-vous dans l’annuaire pour consulter un planning." }, 403);
  const share = (await store.get(viewerShareKey(viewerId, ownerId), { type: "json" })) as Share | null;
  if (!share || share.status !== "accepted")
    return json({ error: "Ce planning ne vous est pas partagé." }, 403);

  const [owner, formProfile, rawPeriods, rawEntries, rawRecoveryUses] = await Promise.all([
    readProfile(store, ownerId),
    store.get(userDataKey(ownerId, "form-profile"), { type: "json" }) as Promise<{ group?: unknown; work_quota?: unknown } | null>,
    readMany<{ from?: unknown; to?: unknown; leave_type?: unknown; half_moment?: unknown }>(store, userDataKey(ownerId, "period/")),
    readMany<Record<string, unknown>>(store, userDataKey(ownerId, "entry/")),
    readMany<Record<string, unknown>>(store, userDataKey(ownerId, "recovery-use/")),
  ]);
  if (!owner?.visible) return json({ error: "Ce planning n’est plus disponible." }, 404);
  const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const group = Math.min(6, Math.max(1, Number(formProfile?.group) || 2));
  const quota: WorkQuota = formProfile?.work_quota === "three_quarters" || formProfile?.work_quota === "half"
    ? formProfile.work_quota : "full";
  const periods: LeavePeriod[] = rawPeriods.filter((period) => validDate(period.from) && validDate(period.to)).map((period, index) => ({
    id: `shared-${index}`, from: String(period.from), to: String(period.to),
    leaveType: period.leave_type === "half" ? "half" : "annual",
    halfMoment: period.half_moment === "morning" || period.half_moment === "afternoon" ? period.half_moment : "",
    updatedAt: "",
  }));
  const entries: Entries = {};
  const candidateDates = new Set<string>();
  for (const raw of rawEntries) {
    if (!validDate(raw.date)) continue;
    candidateDates.add(raw.date);
    entries[raw.date] = {
      noteText: "", noteColor: "", noteUpdatedAt: "", noteGroupId: "",
      leave: raw.leave === true, wish: false, holidayPay: "",
      closureOverride: raw.closure_override === "closed" || raw.closure_override === "open" ? raw.closure_override : "",
      exchangeRole: raw.exchange_role === "given" || raw.exchange_role === "return" ? raw.exchange_role : undefined,
      updatedAt: "",
    };
  }
  const recoveryUses = rawRecoveryUses.filter((item) => validDate(item.date) && Number.isFinite(Number(item.minutes))).map((item) => {
    candidateDates.add(String(item.date));
    return { date: String(item.date), minutes: Math.max(0, Math.round(Number(item.minutes))), start: typeof item.start === "string" ? item.start : "", end: typeof item.end === "string" ? item.end : "" };
  });
  const addRange = (from: string, to: string) => {
    const cursor = new Date(`${from}T12:00:00Z`); const last = new Date(`${to}T12:00:00Z`);
    for (let guard = 0; cursor <= last && guard < 400; guard += 1) {
      candidateDates.add(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  };
  periods.forEach((period) => { addRange(period.from, period.to); });
  GRAND_PALAIS_EXCEPTIONAL_CLOSURES.forEach((closure) => { candidateDates.add(closure.date); });
  const automaticClosures = new Set(GRAND_PALAIS_EXCEPTIONAL_CLOSURES.map((closure) => closure.date));
  const isClosed = (date: string) => entries[date]?.closureOverride === "closed" ||
    (entries[date]?.closureOverride !== "open" && automaticClosures.has(date));
  const days = [...candidateDates].sort().map((date) => {
    const presence = personalPresenceForDate(new Date(`${date}T12:00:00`), group, periods, entries, recoveryUses, dailyMinutesForQuota(quota), isClosed);
    return { date, ...presence };
  });
  return json({
    owner: { userId: owner.userId, displayName: owner.displayName },
    group,
    days,
  });
}

export default async (request: Request) => {
  if (!isTrustedMutation(request)) return json({ error: "Requête refusée." }, 403);
  const user = await getUser();
  if (!user?.id || !user.email) return json({ error: "Authentification requise." }, 401);
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  const url = new URL(request.url);

  if (request.method === "GET") {
    const ownerId = url.searchParams.get("ownerId");
    return ownerId && validUserId(ownerId)
      ? sharedPlanningResponse(store, user.id, ownerId)
      : directoryResponse(store, user.id, user.email);
  }
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const action = body.action;
  const now = new Date().toISOString();

  if (action === "set-profile") {
    const displayName = cleanName(body.displayName);
    if (!displayName) return json({ error: "Indiquez un nom public valide." }, 400);
    if (body.visible === true) {
      const profiles = await readMany<PublicProfile>(store, "colleagues/profile/");
      const duplicate = profiles.some((profile) =>
        profile.visible && profile.userId !== user.id &&
        profile.displayName.localeCompare(displayName, "fr", { sensitivity: "base" }) === 0,
      );
      if (duplicate) return json({ error: "Ce nom est déjà utilisé. Ajoutez votre initiale ou votre service." }, 409);
    }
    const profile: PublicProfile = { userId: user.id, displayName, email: user.email, visible: body.visible === true, updatedAt: now };
    await store.setJSON(profileKey(user.id), profile);
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "disable-sharing") {
    const [profile, incoming, outgoing] = await Promise.all([
      readProfile(store, user.id),
      readMany<Share>(store, `colleagues/share/viewer/${encodeURIComponent(user.id)}/`),
      readMany<Share>(store, `colleagues/share/owner/${encodeURIComponent(user.id)}/`),
    ]);
    await Promise.all([
      ...incoming.map((share) => removeShare(store, share.ownerId, user.id)),
      ...outgoing.map((share) => removeShare(store, user.id, share.viewerId)),
      profile
        ? store.setJSON(profileKey(user.id), { ...profile, visible: false, updatedAt: now })
        : Promise.resolve(),
    ]);
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "share") {
    const viewerId = body.viewerId;
    if (!validUserId(viewerId) || viewerId === user.id) return json({ error: "Destinataire invalide." }, 400);
    const [owner, viewer, existing, blockedByOwner, blockedByViewer] = await Promise.all([
      readProfile(store, user.id),
      readProfile(store, viewerId),
      store.get(ownerShareKey(user.id, viewerId), { type: "json" }) as Promise<Share | null>,
      store.get(blockerKey(user.id, viewerId), { type: "json" }),
      store.get(blockerKey(viewerId, user.id), { type: "json" }),
    ]);
    if (!owner?.visible) return json({ error: "Activez d’abord votre nom dans l’annuaire." }, 409);
    const privilegedOwner = await isMikaSharingAccount(user.email);
    if (!viewer || (!viewer.visible && !privilegedOwner)) return json({ error: "Ce collègue n’est plus disponible." }, 404);
    if (blockedByOwner || blockedByViewer || existing?.status === "blocked")
      return json({ error: "Ce collègue n’est pas disponible." }, 404);
    if (existing?.status === "accepted") return json({ error: "Ce planning est déjà partagé avec ce collègue." }, 409);
    const email = await recipientEmail(store, viewer);
    if (!email) return json({ error: "L’adresse e-mail de ce collègue est indisponible. Réessayez plus tard." }, 409);
    const share: Share = {
      ownerId: user.id,
      viewerId,
      ownerName: owner.displayName,
      viewerName: viewer.displayName,
      status: "pending",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      viewerSeenAt: undefined,
    };
    await writeShare(store, share);
    try {
      await sendColleagueSharingEmail(email, owner.displayName);
    } catch (error) {
      await removeShare(store, user.id, viewerId);
      console.error("E-mail de partage indisponible", error instanceof Error ? error.message : error);
      return json({ error: "Le mail n’a pas pu être envoyé. Aucun partage n’a été créé ; vous pouvez réessayer." }, 502);
    }
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "respond") {
    const ownerId = body.ownerId;
    if (!validUserId(ownerId)) return json({ error: "Partage invalide." }, 400);
    const share = (await store.get(viewerShareKey(user.id, ownerId), { type: "json" })) as Share | null;
    const viewer = await readProfile(store, user.id);
    if (!viewer?.visible) return json({ error: "Inscrivez-vous dans l’annuaire avant de répondre." }, 403);
    if (!share) return json({ error: "Demande introuvable." }, 404);
    if (body.response === "reject") {
      await removeShare(store, ownerId, user.id);
    } else if (body.response === "block") {
      await writeShare(store, { ...share, status: "blocked", updatedAt: now });
    } else if (body.response === "accept" && (share.status === "pending" || share.status === "automatic")) {
      await writeShare(store, { ...share, status: "accepted", updatedAt: now });
    } else return json({ error: "Réponse invalide." }, 400);
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "remove-access") {
    const ownerId = body.ownerId;
    if (!validUserId(ownerId)) return json({ error: "Partage invalide." }, 400);
    await removeShare(store, ownerId, user.id);
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "mark-notice-seen") {
    const ownerId = body.ownerId;
    if (!validUserId(ownerId)) return json({ error: "Partage invalide." }, 400);
    const share = (await store.get(viewerShareKey(user.id, ownerId), { type: "json" })) as Share | null;
    if (!share) return json({ error: "Partage introuvable." }, 404);
    await writeShare(store, { ...share, viewerSeenAt: now, updatedAt: share.updatedAt });
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "block-person") {
    const blockedId = body.userId;
    if (!validUserId(blockedId) || blockedId === user.id) return json({ error: "Collègue invalide." }, 400);
    const target = await readProfile(store, blockedId);
    const privilegedBlocker = await isMikaSharingAccount(user.email);
    if (!target || (!target.visible && !privilegedBlocker))
      return json({ error: "Ce collègue n’est plus disponible." }, 404);
    await Promise.all([
      writeBlock(store, { blockerId: user.id, blockedId, blockedName: target.displayName, createdAt: now }),
      removeShare(store, user.id, blockedId),
      removeShare(store, blockedId, user.id),
    ]);
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "unblock-person") {
    const blockedId = body.userId;
    if (!validUserId(blockedId)) return json({ error: "Collègue invalide." }, 400);
    await removeBlock(store, user.id, blockedId);
    return directoryResponse(store, user.id, user.email);
  }

  if (action === "revoke") {
    const viewerId = body.viewerId;
    if (!validUserId(viewerId)) return json({ error: "Partage invalide." }, 400);
    await removeShare(store, user.id, viewerId);
    return directoryResponse(store, user.id, user.email);
  }

  return json({ error: "Action inconnue." }, 400);
};

export const config = { path: "/api/colleagues" };
