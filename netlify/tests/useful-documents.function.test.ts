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
import documentFileHandler from '../functions/useful-document-file.mts';
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

  it("interdit aux invités le partage et la lecture de l’annuaire", async () => {
    for (const action of ['replace-document', 'restore-document-version']) expect((await usefulDocumentsHandler(post({ action, documentId: 'demande-conges.pdf' }))).status).toBe(403);
    expect((await usefulDocumentsHandler(new Request('https://example.test/api/useful-documents?versions=demande-conges.pdf'))).status).toBe(403);
    for (const action of ["rename-document", "delete-document"]) expect((await usefulDocumentsHandler(post({ action, documentId: "demande-conges.pdf", title: "Autre titre" }))).status).toBe(403);
    expect((await usefulDocumentsHandler(post({ action: "share-document", documentId: "demande-conges.pdf", audience: "all", message: "Bonjour" }))).status).toBe(403);
    expect((await usefulDocumentsHandler(new Request("https://example.test/api/useful-documents?recipients=1"))).status).toBe(403);
    expect(mockedEmail).not.toHaveBeenCalled();
  });

  it('remplace un document ajouté en gardant sa fiche, son lien et ses destinataires puis restaure son contenu', async () => {
    mockedGetUser.mockResolvedValue({ id: 'admin', email: 'admin@example.test' } as never);
    const added = await (await usefulDocumentsHandler(post(upload()))).json();
    const metadataBefore = structuredClone(data.get(`useful-documents/metadata/${added.document.id}`));
    const newer = Buffer.from('%PDF-1.7\nversion actualisée').toString('base64');
    expect((await usefulDocumentsHandler(post({ action: 'replace-document', documentId: added.document.id, filename: 'nouveau.pdf', contentBase64: newer }))).status).toBe(200);
    expect(data.get(`useful-documents/metadata/${added.document.id}`)).toEqual(metadataBefore);
    const link = new Request(`https://example.test${added.document.href}`);
    expect(await (await usefulDocumentsHandler(link)).text()).toContain('version actualisée');
    const history = await (await usefulDocumentsHandler(new Request(`https://example.test/api/useful-documents?versions=${added.document.id}`))).json();
    expect(JSON.stringify(history)).not.toContain('contentBase64');
    expect((await usefulDocumentsHandler(post({ action: 'restore-document-version', documentId: added.document.id, versionId: history.versions[0].id }))).status).toBe(200);
    expect(await (await usefulDocumentsHandler(link)).text()).toBe(Buffer.from(pdf, 'base64').toString());
    expect(mockedEmail).not.toHaveBeenCalled();
  });

  it('sert une nouvelle version intégrée au même lien puis revient au fichier original', async () => {
    mockedGetUser.mockResolvedValue({ id: 'admin', email: 'admin@example.test' } as never);
    const id = 'demande-conges.pdf';
    const request = new Request(`https://example.test/useful-forms/${id}`);
    const original = Buffer.from(await (await documentFileHandler(request)).arrayBuffer());
    expect(original.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await usefulDocumentsHandler(post({ action: 'replace-document', documentId: id, filename: 'nouveau.pdf', contentBase64: pdf }))).status).toBe(200);
    mockedGetUser.mockResolvedValue({ id: 'guest', email: 'guest@example.test' } as never);
    expect(await (await documentFileHandler(request)).text()).toBe(Buffer.from(pdf, 'base64').toString());
    mockedGetUser.mockResolvedValue(null);
    expect((await documentFileHandler(request)).status).toBe(401);
    mockedGetUser.mockResolvedValue({ id: 'admin', email: 'admin@example.test' } as never);
    const history = await (await usefulDocumentsHandler(new Request(`https://example.test/api/useful-documents?versions=${id}`))).json();
    await usefulDocumentsHandler(post({ action: 'restore-document-version', documentId: id, versionId: history.versions[0].id }));
    expect(Buffer.from(await (await documentFileHandler(request)).arrayBuffer())).toEqual(original);
    await usefulDocumentsHandler(post({ action: 'delete-document', documentId: id }));
    expect((await documentFileHandler(request)).status).toBe(404);
    const unknownFile = await documentFileHandler(new Request('https://example.test/useful-forms/non-prevu.pdf'));
    expect(unknownFile.status).toBe(404);
  });

  it('refuse les fichiers invalides, les changements de format et les versions d’un autre document', async () => {
    mockedGetUser.mockResolvedValue({ id: 'admin', email: 'admin@example.test' } as never);
    const base = { action: 'replace-document', documentId: 'demande-conges.pdf', filename: 'nouveau.pdf', contentBase64: pdf };
    for (const extra of [{ contentBase64: 'bad' }, { filename: 'autre.docx' }, { documentId: '../../autre' }, { contentBase64: 'A'.repeat(4500000) }]) {
      expect((await usefulDocumentsHandler(post({ ...base, ...extra }))).status).toBeGreaterThanOrEqual(400);
    }
    expect(data.size).toBe(0);
    await usefulDocumentsHandler(post(base));
    const history = await (await usefulDocumentsHandler(new Request('https://example.test/api/useful-documents?versions=demande-conges.pdf'))).json();
    expect((await usefulDocumentsHandler(post({ action: 'restore-document-version', documentId: 'demande-recuperations.pdf', versionId: history.versions[0].id }))).status).toBe(404);
  });

  it("affiche les noms Netlify des destinataires sans exposer leurs e-mails", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    mockedListUsers.mockResolvedValue([
      { id: "guest-2", email: "zoe@example.test", name: "Zoé Martin" },
      { id: "guest-1", email: "alice@example.test", userMetadata: { full_name: "Alice Bernard" } },
      { id: "admin", email: "admin@example.test", name: "Administrateur" },
    ] as never);

    const response = await usefulDocumentsHandler(new Request("https://example.test/api/useful-documents?recipients=1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recipients: [
      { id: "guest-1", name: "Alice Bernard" },
      { id: "guest-2", name: "Zoé Martin" },
    ] });
  });

  it("renomme puis retire un formulaire intégré sans permettre de le repartager", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    expect((await usefulDocumentsHandler(post({ action: "rename-document", documentId: "demande-conges.pdf", title: "Congés à remplir" }))).status).toBe(200);
    const listing = await (await usefulDocumentsHandler(new Request("https://example.test/api/useful-documents"))).json();
    expect(listing.catalogEdits).toEqual([{ id: "demande-conges.pdf", title: "Congés à remplir" }]);
    expect((await usefulDocumentsHandler(post({ action: "delete-document", documentId: "demande-conges.pdf" }))).status).toBe(200);
    expect((await usefulDocumentsHandler(post({ action: "share-document", documentId: "demande-conges.pdf", audience: "all", message: "Bonjour" }))).status).toBe(404);
  });

  it("renomme et supprime un document ajouté avec son fichier", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const added = await (await usefulDocumentsHandler(post(upload()))).json();
    const id = added.document.id;
    expect((await usefulDocumentsHandler(post({ action: "rename-document", documentId: id, title: "Nouveau titre" }))).status).toBe(200);
    expect(data.get(`useful-documents/metadata/${id}`)).toMatchObject({ title: "Nouveau titre" });
    expect((await usefulDocumentsHandler(post({ action: "delete-document", documentId: id }))).status).toBe(200);
    expect(data.has(`useful-documents/files/${id}`)).toBe(false);
    expect(data.has(`useful-documents/metadata/${id}`)).toBe(false);
  });

  it("partage un ancien formulaire uniquement aux destinataires choisis avec le message personnalisé", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    mockedListUsers.mockResolvedValue([{ id: "guest-1", email: "un@example.test" }, { id: "guest-2", email: "deux@example.test" }] as never);
    const response = await usefulDocumentsHandler(post({ action: "share-document", documentId: "demande-conges.pdf", audience: "selected", recipientIds: ["guest-2", "guest-2"], message: "À lire avant vendredi." }));
    expect(await response.json()).toEqual({ accounts: 1, inAppAlerts: 1, emailsSent: 1 });
    expect(mockedEmail).toHaveBeenCalledExactlyOnceWith("deux@example.test", "Demande de congés", "Formulaire SAP");
    expect([...data.entries()].filter(([key]) => key.includes('/notices/'))).toEqual([[expect.stringContaining("/notices/guest-2/"), expect.objectContaining({ message: "À lire avant vendredi.", documentId: "demande-conges.pdf" })]]);
  });

  it("partage un document ajouté à tous les invités et rapporte les échecs partiels", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const added = await (await usefulDocumentsHandler(post(upload()))).json();
    mockedListUsers.mockResolvedValue([{ id: "admin", email: "admin@example.test" }, { id: "guest-1", email: "un@example.test" }, { id: "guest-2", email: "deux@example.test" }] as never);
    mockedEmail.mockRejectedValueOnce(new Error("SMTP"));
    const response = await usefulDocumentsHandler(post({ action: "share-document", documentId: added.document.id, audience: "all", message: "Nouvelles consignes" }));
    expect(await response.json()).toEqual({ accounts: 2, inAppAlerts: 2, emailsSent: 1 });
  });

  it("refuse une sélection vide, inconnue, un lien arbitraire et un message trop long sans envoyer", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    mockedListUsers.mockResolvedValue([{ id: "guest-1", email: "un@example.test" }] as never);
    const base = { action: "share-document", documentId: "demande-conges.pdf", audience: "selected", recipientIds: ["guest-1"], message: "Bonjour" };
    for (const change of [{ recipientIds: [] }, { recipientIds: ["inconnu"] }, { message: "x".repeat(1001) }, { documentId: "https://evil.test" }]) {
      expect((await usefulDocumentsHandler(post({ ...base, ...change }))).status).toBeGreaterThanOrEqual(400);
    }
    expect(data.size).toBe(0);
    expect(mockedEmail).not.toHaveBeenCalled();
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
