import { beforeEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, unknown>();
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  setJSON: vi.fn(async (key: string, value: unknown) => { data.set(key, value); return { modified: true }; }),
  delete: vi.fn(async (key: string) => { data.delete(key); }),
  list: vi.fn(({ prefix }: { prefix: string }) => ({
    async *[Symbol.asyncIterator]() {
      yield { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    },
  })),
};
vi.mock("@netlify/identity", () => ({ getUser: vi.fn(), admin: { getUser: vi.fn(), listUsers: vi.fn() } }));
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));
vi.mock("../lib/feedbackEmail.mts", () => ({ sendFeedbackAlert: vi.fn() }));

import { admin, getUser } from "@netlify/identity";
import { sendFeedbackAlert } from "../lib/feedbackEmail.mts";
import feedbackHandler from "../functions/feedback.mts";

const mockedGetUser = vi.mocked(getUser);
const mockedAdminGetUser = vi.mocked(admin.getUser);
const mockedListUsers = vi.mocked(admin.listUsers);
const mockedAlert = vi.mocked(sendFeedbackAlert);
const messageId = "11111111-1111-1111-1111-111111111111";
const post = (body: unknown, origin?: string) => new Request("https://example.test/api/feedback", {
  method: "POST",
  headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
  body: JSON.stringify(body),
});

describe("messagerie privée des idées et signalements", () => {
  beforeEach(() => {
    data.clear();
    store.get.mockClear();
    store.setJSON.mockClear();
    store.delete.mockClear();
    store.list.mockClear();
    mockedGetUser.mockReset();
    mockedGetUser.mockResolvedValue({ id: "user-1", email: "personne@example.test" } as never);
    mockedAdminGetUser.mockReset();
    mockedAdminGetUser.mockResolvedValue({ id: "user-1", email: "personne@example.test" } as never);
    mockedListUsers.mockReset();
    mockedListUsers.mockResolvedValue([] as never);
    mockedAlert.mockReset();
    mockedAlert.mockResolvedValue(true);
    (globalThis as typeof globalThis & { Netlify?: unknown }).Netlify = {
      env: { get: (name: string) => name === "PROGRAM_ADMIN_EMAIL" ? "admin@example.test" : undefined },
    };
  });

  it("refuse les personnes non connectées et les origines tierces", async () => {
    mockedGetUser.mockResolvedValueOnce(null);
    expect((await feedbackHandler(post({ kind: "idea", message: "Une idée utile" }))).status).toBe(401);
    expect((await feedbackHandler(post({ kind: "idea", message: "Une idée utile" }, "https://evil.test"))).status).toBe(403);
  });

  it("enregistre un message anonyme sans identité affichable et envoie seulement une alerte", async () => {
    const response = await feedbackHandler(post({ kind: "suggestion", message: "Simplifier cette page.", anonymous: true, authorName: "À masquer" }));
    expect(response.status).toBe(200);
    const stored = [...data.values()][0] as Record<string, unknown>;
    expect(stored).toMatchObject({ kind: "suggestion", message: "Simplifier cette page.", anonymous: true, senderUserId: "user-1" });
    expect(stored).not.toHaveProperty("authorName");
    expect(JSON.stringify(stored)).not.toContain("personne@example.test");
    expect(mockedAlert).toHaveBeenCalledWith("suggestion");
  });

  it("conserve une photo valide uniquement dans le stockage interne", async () => {
    const contentBase64 = Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString("base64");
    const response = await feedbackHandler(post({
      kind: "bug",
      message: "Le bouton ne répond plus.",
      anonymous: false,
      photo: { contentType: "image/jpeg", contentBase64 },
    }));
    expect(response.status).toBe(200);
    const stored = [...data.values()][0] as Record<string, unknown>;
    expect(stored).toMatchObject({ authorName: "Personne", photo: { filename: "photo.jpg", contentBase64 } });
    expect(mockedAlert).toHaveBeenCalledWith("bug");
  });

  it("réserve la boîte, le compteur et les photos à l’administrateur", async () => {
    data.set(`feedback/messages/${messageId}`, {
      id: messageId, senderUserId: "user-1", kind: "idea", message: "Test", anonymous: false, authorName: "Utilisateur Planning Solo", createdAt: "2026-09-05T10:00:00.000Z",
    });
    data.set("colleagues/profile/user-1", { displayName: "Camille Dupont" });
    expect((await feedbackHandler(new Request("https://example.test/api/feedback"))).status).toBe(403);
    expect((await feedbackHandler(new Request(`https://example.test/api/feedback?photo=${messageId}`))).status).toBe(403);
    expect((await feedbackHandler(post({ action: "resolve", id: messageId }))).status).toBe(403);
    mockedGetUser.mockResolvedValue({ id: "admin", email: "ADMIN@example.test" } as never);
    const response = await feedbackHandler(new Request("https://example.test/api/feedback"));
    const payload = await response.json();
    expect(payload).toMatchObject({ unreadCount: 1, messages: [expect.objectContaining({ message: "Test", authorName: "Camille Dupont", hasPhoto: false })] });
    expect(JSON.stringify(payload)).not.toContain("senderUserId");
  });

  it("permet à l’administrateur de résoudre manuellement puis alerte le bon compte", async () => {
    data.set(`feedback/messages/${messageId}`, {
      id: messageId, senderUserId: "user-1", kind: "bug", message: "Test", anonymous: true, createdAt: "2026-09-05T10:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    expect((await feedbackHandler(post({ action: "resolve", id: messageId }))).status).toBe(200);
    expect(data.get(`feedback/messages/${messageId}`)).toMatchObject({ readAt: expect.any(String), resolvedAt: expect.any(String) });
    expect(data.get(`feedback/resolutions/user-1/${messageId}`)).toMatchObject({ id: messageId, kind: "bug" });

    mockedGetUser.mockResolvedValue({ id: "user-1", email: "personne@example.test" } as never);
    const notices = await feedbackHandler(new Request("https://example.test/api/feedback?notifications=1"));
    expect(await notices.json()).toMatchObject({ notifications: [expect.objectContaining({ id: messageId, kind: "bug" })] });
    await feedbackHandler(post({ action: "dismiss-resolution", id: messageId }));
    expect(data.has(`feedback/resolutions/user-1/${messageId}`)).toBe(false);
  });

  it("permet une réponse personnalisée privée puis la suppression du message", async () => {
    data.set(`feedback/messages/${messageId}`, {
      id: messageId, senderUserId: "user-1", kind: "idea", message: "Test", anonymous: false, authorName: "Camille", createdAt: "2026-09-05T10:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const replyResponse = await feedbackHandler(post({ action: "reply", id: messageId, message: "Merci, je vais ajouter cette option." }));
    expect(replyResponse.status).toBe(200);
    const replyPayload = await replyResponse.json();
    expect(data.get(`feedback/messages/${messageId}`)).toMatchObject({
      adminReplies: [expect.objectContaining({ message: "Merci, je vais ajouter cette option." })],
    });
    expect(data.get(`feedback/resolutions/user-1/${replyPayload.reply.id}`)).toMatchObject({
      type: "reply", message: "Merci, je vais ajouter cette option.", feedbackId: messageId,
    });
    expect((await feedbackHandler(post({ action: "delete", id: messageId }))).status).toBe(200);
    expect(data.has(`feedback/messages/${messageId}`)).toBe(false);
  });

  it("garde le message lorsque l’alerte e-mail échoue", async () => {
    mockedAlert.mockRejectedValueOnce(new Error("SMTP indisponible"));
    const response = await feedbackHandler(post({ kind: "idea", message: "Une idée valide", anonymous: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: true, notified: false });
    expect(data.size).toBe(1);
  });

  it("réserve le message collectif à l’administrateur et crée seulement des popups pour les invités", async () => {
    expect((await feedbackHandler(post({ action: "broadcast", message: "Information pour toutes et tous." }))).status).toBe(403);
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    mockedListUsers.mockResolvedValue([
      { id: "admin", email: "ADMIN@example.test" },
      { id: "guest-1", email: "invite1@example.test" },
      { id: "guest-2", email: "invite2@example.test" },
    ] as never);
    const response = await feedbackHandler(post({ action: "broadcast", message: "Information pour toutes et tous." }));
    expect(await response.json()).toMatchObject({ broadcast: true, accounts: 2, delivered: 2, failed: 0 });
    const notices = [...data.entries()].filter(([key]) => key.startsWith("feedback/resolutions/"));
    expect(notices).toHaveLength(2);
    expect(notices.every(([, value]) => (value as { type?: string }).type === "broadcast")).toBe(true);
    expect(notices.some(([key]) => key.includes("/admin/"))).toBe(false);
    expect(mockedAlert).not.toHaveBeenCalled();
  });
});
