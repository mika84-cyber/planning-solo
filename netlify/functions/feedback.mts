import { Buffer } from "node:buffer";
import { getStore } from "@netlify/blobs";
import { admin, getUser } from "@netlify/identity";
import { sendFeedbackAlert, type FeedbackKind } from "../lib/feedbackEmail.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { userDataKey } from "../lib/userScopedStore.mts";

type FeedbackPhoto = {
  filename: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  contentBase64: string;
};
type StoredFeedback = {
  id: string;
  senderUserId: string;
  kind: FeedbackKind;
  message: string;
  anonymous: boolean;
  authorName?: string;
  createdAt: string;
  readAt?: string;
  resolvedAt?: string;
  adminReplies?: Array<{ id: string; message: string; sentAt: string }>;
  photo?: FeedbackPhoto;
};
type ResolutionNotice = {
  id: string;
  feedbackId?: string;
  kind: FeedbackKind;
  type?: "resolved" | "reply" | "broadcast";
  message?: string;
  createdAt?: string;
  resolvedAt?: string;
};

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const kinds = new Set<FeedbackKind>(["idea", "suggestion", "bug"]);
const allowedPhotoTypes = new Set<FeedbackPhoto["contentType"]>(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const messageKey = (id: string) => `feedback/messages/${id}`;
const noticeKey = (userId: string, id: string) => `feedback/resolutions/${encodeURIComponent(userId)}/${id}`;
const colleagueProfileKey = (userId: string) => `colleagues/profile/${encodeURIComponent(userId)}`;
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);

function configuredAdminEmail() {
  return (globalThis as typeof globalThis & { Netlify?: { env?: { get(name: string): string | undefined } } })
    .Netlify?.env?.get("PROGRAM_ADMIN_EMAIL")?.trim().toLocaleLowerCase("fr") || "";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 70) : "";
}

function nameFromEmail(email: string) {
  const words = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return cleanName(words.replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr"))) || "Collègue";
}

async function automaticSenderName(store: ReturnType<typeof getStore>, userId: string, email = "") {
  const [colleagueProfile, formProfile] = await Promise.all([
    store.get(colleagueProfileKey(userId), { type: "json" }) as Promise<{ displayName?: unknown } | null>,
    store.get(userDataKey(userId, "form-profile"), { type: "json" }) as Promise<{ full_name?: unknown } | null>,
  ]);
  const storedName = cleanName(colleagueProfile?.displayName) || cleanName(formProfile?.full_name);
  if (storedName) return storedName;
  if (email) return nameFromEmail(email);
  try {
    const identityUser = await admin.getUser(userId);
    return identityUser.email ? nameFromEmail(identityUser.email) : "Collègue";
  } catch {
    return "Collègue";
  }
}

function validSignature(bytes: Buffer, contentType: FeedbackPhoto["contentType"]) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function parsePhoto(value: unknown): FeedbackPhoto | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object") throw new Error("Photo invalide.");
  const photo = value as Record<string, unknown>;
  if (typeof photo.contentType !== "string" || !allowedPhotoTypes.has(photo.contentType as FeedbackPhoto["contentType"]))
    throw new Error("Utilisez une photo JPEG, PNG ou WebP.");
  if (typeof photo.contentBase64 !== "string" || photo.contentBase64.length > MAX_PHOTO_BYTES * 1.4)
    throw new Error("La photo est trop volumineuse.");
  const compactBase64 = photo.contentBase64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compactBase64)) throw new Error("Photo invalide.");
  const bytes = Buffer.from(compactBase64, "base64");
  const contentType = photo.contentType as FeedbackPhoto["contentType"];
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) throw new Error("La photo est trop volumineuse.");
  if (!validSignature(bytes, contentType)) throw new Error("Le contenu de la photo est invalide.");
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  return { filename: `photo.${extension}`, contentType, contentBase64: bytes.toString("base64") };
}

async function listKeys(store: ReturnType<typeof getStore>, prefix: string) {
  const keys: string[] = [];
  const pages = store.list({ prefix, paginate: true });
  if (Symbol.asyncIterator in Object(pages)) {
    for await (const page of pages) keys.push(...page.blobs.map((blob) => blob.key));
  } else {
    const page = await (pages as unknown as Promise<{ blobs: Array<{ key: string }> }>);
    keys.push(...page.blobs.map((blob) => blob.key));
  }
  return keys;
}

async function guestAccounts(adminEmail: string) {
  const guests: Array<{ id: string; email: string }> = [];
  for (let page = 1; page <= 20; page += 1) {
    const users = await admin.listUsers({ page, perPage: 100 });
    guests.push(...users
      .filter((identityUser) => Boolean(identityUser.id && identityUser.email)
        && identityUser.email?.trim().toLocaleLowerCase("fr") !== adminEmail)
      .map((identityUser) => ({ id: identityUser.id, email: identityUser.email as string })));
    if (users.length < 100) break;
  }
  return guests;
}

async function publicMessage(store: ReturnType<typeof getStore>, item: StoredFeedback) {
  const { photo, senderUserId: _senderUserId, ...message } = item;
  const authorName = !item.anonymous && (!item.authorName || item.authorName === "Utilisateur Planning Solo")
    ? await automaticSenderName(store, item.senderUserId)
    : item.authorName;
  return { ...message, ...(authorName ? { authorName } : {}), hasPhoto: Boolean(photo) };
}

export default async function feedbackHandler(request: Request) {
  if (!isTrustedMutation(request)) return json({ error: "Requête refusée." }, 403);
  const user = await getUser();
  if (!user?.id || !user.email) return json({ error: "Authentification requise." }, 401);
  const isAdmin = user.email.trim().toLocaleLowerCase("fr") === configuredAdminEmail();
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  const url = new URL(request.url);

  if (request.method === "GET") {
    if (url.searchParams.get("notifications") === "1") {
      const prefix = `feedback/resolutions/${encodeURIComponent(user.id)}/`;
      const keys = await listKeys(store, prefix);
      const notifications = (await Promise.all(keys.map((key) => store.get(key, { type: "json" }) as Promise<ResolutionNotice | null>)))
        .filter((item): item is ResolutionNotice => Boolean(item))
        .sort((a, b) => (b.createdAt || b.resolvedAt || "").localeCompare(a.createdAt || a.resolvedAt || ""));
      return json({ notifications });
    }
    if (!isAdmin) return json({ error: "Accès réservé." }, 403);
    const photoId = url.searchParams.get("photo");
    if (photoId) {
      if (!validId(photoId)) return json({ error: "Message invalide." }, 400);
      const item = await store.get(messageKey(photoId), { type: "json" }) as StoredFeedback | null;
      if (!item?.photo) return json({ error: "Photo introuvable." }, 404);
      return new Response(Buffer.from(item.photo.contentBase64, "base64"), {
        headers: { "content-type": item.photo.contentType, "cache-control": "private, no-store", "content-disposition": `inline; filename="${item.photo.filename}"` },
      });
    }
    const keys = await listKeys(store, "feedback/messages/");
    const messages = (await Promise.all(keys.map((key) => store.get(key, { type: "json" }) as Promise<StoredFeedback | null>)))
      .filter((item): item is StoredFeedback => Boolean(item))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100);
    const unreadCount = messages.filter((item) => !item.readAt).length;
    return url.searchParams.get("summary") === "1"
      ? json({ unreadCount })
      : json({ unreadCount, messages: await Promise.all(messages.map((item) => publicMessage(store, item))) });
  }

  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Données invalides." }, 400);
  }

  if (body.action === "broadcast") {
    if (!isAdmin) return json({ error: "Accès réservé." }, 403);
    const message = typeof body.message === "string" ? body.message.replace(/\r\n?/g, "\n").trim() : "";
    if (message.length < 5 || message.length > 800)
      return json({ error: "Le message collectif doit contenir entre 5 et 800 caractères." }, 400);
    let guests: Array<{ id: string; email: string }>;
    try {
      guests = await guestAccounts(configuredAdminEmail());
    } catch (error) {
      console.error("Annuaire des comptes invités indisponible", error);
      return json({ error: "Les comptes invités sont momentanément indisponibles." }, 503);
    }
    const notice: ResolutionNotice = {
      id: crypto.randomUUID(),
      kind: "suggestion",
      type: "broadcast",
      message,
      createdAt: new Date().toISOString(),
    };
    const results = await Promise.allSettled(guests.map((guest) => store.setJSON(noticeKey(guest.id, notice.id), notice)));
    const delivered = results.filter((result) => result.status === "fulfilled").length;
    return json({ broadcast: true, accounts: guests.length, delivered, failed: guests.length - delivered });
  }

  if (body.action === "dismiss-resolution") {
    if (!validId(body.id)) return json({ error: "Notification invalide." }, 400);
    await store.delete(noticeKey(user.id, body.id));
    return json({ dismissed: true });
  }

  if (body.action === "mark-read" || body.action === "resolve" || body.action === "reply" || body.action === "delete") {
    if (!isAdmin) return json({ error: "Accès réservé." }, 403);
    if (!validId(body.id)) return json({ error: "Message invalide." }, 400);
    const key = messageKey(body.id);
    const item = await store.get(key, { type: "json" }) as StoredFeedback | null;
    if (!item) return json({ error: "Message introuvable." }, 404);
    const now = new Date().toISOString();
    if (body.action === "delete") {
      await store.delete(key);
      return json({ deleted: true });
    }
    if (body.action === "mark-read") {
      if (!item.readAt) await store.setJSON(key, { ...item, readAt: now });
      return json({ read: true });
    }
    if (body.action === "reply") {
      const replyMessage = typeof body.message === "string" ? body.message.replace(/\r\n?/g, "\n").trim() : "";
      if (replyMessage.length < 2 || replyMessage.length > 800)
        return json({ error: "La réponse doit contenir entre 2 et 800 caractères." }, 400);
      const reply = { id: crypto.randomUUID(), message: replyMessage, sentAt: now };
      await Promise.all([
        store.setJSON(key, { ...item, readAt: item.readAt || now, adminReplies: [...(item.adminReplies || []), reply] }),
        store.setJSON(noticeKey(item.senderUserId, reply.id), {
          id: reply.id, feedbackId: item.id, kind: item.kind, type: "reply", message: reply.message, createdAt: now,
        }),
      ]);
      return json({ replied: true, reply });
    }
    if (!item.resolvedAt) {
      await Promise.all([
        store.setJSON(key, { ...item, readAt: item.readAt || now, resolvedAt: now }),
        store.setJSON(noticeKey(item.senderUserId, item.id), {
          id: item.id, feedbackId: item.id, kind: item.kind, type: "resolved", createdAt: now, resolvedAt: now,
        }),
      ]);
    }
    return json({ resolved: true });
  }

  if (typeof body.kind !== "string" || !kinds.has(body.kind as FeedbackKind))
    return json({ error: "Choisissez le type de retour." }, 400);
  const message = typeof body.message === "string" ? body.message.replace(/\r\n?/g, "\n").trim() : "";
  if (message.length < 5 || message.length > 2_000)
    return json({ error: "Le message doit contenir entre 5 et 2 000 caractères." }, 400);
  const anonymous = body.anonymous === true;
  const authorName = anonymous ? undefined : await automaticSenderName(store, user.id, user.email);
  let photo: FeedbackPhoto | undefined;
  try {
    photo = parsePhoto(body.photo);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Photo invalide." }, 400);
  }

  const item: StoredFeedback = {
    id: crypto.randomUUID(),
    senderUserId: user.id,
    kind: body.kind as FeedbackKind,
    message,
    anonymous,
    createdAt: new Date().toISOString(),
    ...(authorName ? { authorName } : {}),
    ...(photo ? { photo } : {}),
  };
  await store.setJSON(messageKey(item.id), item);
  let notified = true;
  try {
    await sendFeedbackAlert(item.kind);
  } catch (error) {
    notified = false;
    console.error("Alerte de nouveau message non envoyée", error instanceof Error ? error.message : error);
  }
  return json({ sent: true, notified });
}

export const config = { path: "/api/feedback" };
