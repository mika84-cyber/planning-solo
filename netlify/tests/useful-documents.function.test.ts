import { Buffer } from "node:buffer";
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
vi.mock("@netlify/identity", () => ({ getUser: vi.fn(), admin: { listUsers: vi.fn() } }));
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));
vi.mock("../lib/documentAnnouncementEmail.mts", () => ({ sendDocumentAnnouncementEmail: vi.fn() }));

import { admin, getUser } from "@netlify/identity";
import usefulDocumentsHandler from "../functions/useful-documents.mts";
import { sendDocumentAnnouncementEmail } from "../lib/documentAnnouncementEmail.mts";

const mockedGetUser = vi.mocked(getUser);
const mockedListUsers = vi.mocked(admin.listUsers);
const mockedEmail = vi.mocked(sendDocumentAnnouncementEmail);
const pdf = Buffer.from("%PDF-1.7\ncontenu de test").toString("base64");
const post = (body: unknown, origin?: string) => new Request("https://example.test/api/useful-documents", {
  method: "POST",
  headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
  body: JSON.stringify(body),
});
const upload = (notifyGuests = false) => ({
  action: "add-document",
  title: "Consignes exposition",
  folder: "expo",
  filename: "consignes.pdf",
  contentType: "application/pdf",
  contentBase64: pdf,
  notifyGuests,
});

describe("documents utiles partagés", () => {
  beforeEach(() => {
    data.clear();
    vi.clearAllMocks();
    mockedGetUser.mockResolvedValue({ id: "guest-1", email: "invite@example.test" } as never);
    mockedListUsers.mockResolvedValue([] as never);
    mockedEmail.mockResolvedValue(true);
    (globalThis as typeof globalThis & { Netlify?: unknown }).Netlify = {
      env: { get: (name: string) => name === "PROGRAM_ADMIN_EMAIL" ? "admin@example.test" : undefined },
    };
  });

  it("réserve strictement l’ajout à l’administrateur et refuse une origine tierce", async () => {
    mockedGetUser.mockResolvedValueOnce(null);
    expect((await usefulDocumentsHandler(new Request("https://example.test/api/useful-documents"))).status).toBe(401);
    expect((await usefulDocumentsHandler(post(upload()))).status).toBe(403);
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    expect((await usefulDocumentsHandler(post(upload(), "https://evil.test"))).status).toBe(403);
    expect(data.size).toBe(0);
  });

  it("ajoute, liste et sert un PDF authentifié sans envoyer d’alerte par défaut", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "ADMIN@example.test" } as never);
    const response = await usefulDocumentsHandler(post(upload()));
    expect(response.status).toBe(201);
    const payload = await response.json() as { document: { id: string; href: string }; announcement: null };
    expect(payload.announcement).toBeNull();
    expect(payload.document.href).toContain(payload.document.id);
    expect(mockedListUsers).not.toHaveBeenCalled();
    expect(mockedEmail).not.toHaveBeenCalled();

    mockedGetUser.mockResolvedValue({ id: "guest-1", email: "invite@example.test" } as never);
    const listing = await usefulDocumentsHandler(new Request("https://example.test/api/useful-documents"));
    expect(await listing.json()).toMatchObject({ documents: [expect.objectContaining({ title: "Consignes exposition", folder: "expo", format: "PDF" })] });
    const download = await usefulDocumentsHandler(new Request(`https://example.test${payload.document.href}`));
    expect(download.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await download.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("alerte chaque compte invité dans l’application et par e-mail sans inclure l’administrateur", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    mockedListUsers.mockResolvedValue([
      { id: "admin", email: "ADMIN@example.test" },
      { id: "guest-1", email: "invite1@example.test" },
      { id: "guest-2", email: "invite2@example.test" },
    ] as never);
    mockedEmail.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("SMTP"));
    const response = await usefulDocumentsHandler(post(upload(true)));
    const payload = await response.json();
    expect(payload).toMatchObject({ announcement: { accounts: 2, inAppAlerts: 2, emailsSent: 1, emailsFailed: 1, directoryAvailable: true } });
    expect(mockedEmail).toHaveBeenCalledTimes(2);
    expect([...data.keys()].filter((key) => key.includes("/notices/"))).toHaveLength(2);

    mockedGetUser.mockResolvedValue({ id: "guest-1", email: "invite1@example.test" } as never);
    const notices = await usefulDocumentsHandler(new Request("https://example.test/api/useful-documents?notifications=1"));
    const noticePayload = await notices.json() as { notifications: Array<{ id: string; title: string }> };
    expect(noticePayload.notifications).toEqual([expect.objectContaining({ title: "Consignes exposition" })]);
    expect((await usefulDocumentsHandler(post({ action: "dismiss-notification", id: noticePayload.notifications[0].id }))).status).toBe(200);
    expect([...data.keys()].filter((key) => key.includes("/notices/guest-1/"))).toHaveLength(0);
  });

  it("refuse un fichier dont le contenu ne correspond pas à un PDF ou DOCX", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const response = await usefulDocumentsHandler(post({ ...upload(), contentBase64: Buffer.from("faux pdf").toString("base64") }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("PDF ou DOCX") });
    expect(data.size).toBe(0);
  });
});
