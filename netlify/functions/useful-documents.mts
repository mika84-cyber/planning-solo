import { Buffer } from "node:buffer";
import { getStore } from "@netlify/blobs";
import { admin, getUser } from "@netlify/identity";
import { sendDocumentAnnouncementEmail } from "../lib/documentAnnouncementEmail.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";

type DocumentFolder = "expo" | "sap" | "brantome";
type StoredDocument = {
  id: string;
  title: string;
  folder: DocumentFolder;
  format: "PDF" | "DOCX";
  contentType: string;
  filename: string;
  createdAt: string;
};
type StoredFile = { contentBase64: string };
type DocumentNotice = { id: string; documentId: string; title: string; folderTitle: string; createdAt: string };

const folders: Record<DocumentFolder, string> = {
  expo: "Formulaire Expo",
  sap: "Formulaire SAP",
  brantome: "Formulaire Brantôme",
};
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store, max-age=0" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const metadataKey = (id: string) => `useful-documents/metadata/${id}`;
const fileKey = (id: string) => `useful-documents/files/${id}`;
const noticeKey = (userId: string, id: string) => `useful-documents/notices/${encodeURIComponent(userId)}/${id}`;
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const normalizedEmail = (value: string | undefined) => (value || "").trim().toLocaleLowerCase("fr");

function configuredAdminEmail() {
  return (globalThis as typeof globalThis & { Netlify?: { env?: { get(name: string): string | undefined } } })
    .Netlify?.env?.get("PROGRAM_ADMIN_EMAIL");
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

async function listDocuments(store: ReturnType<typeof getStore>) {
  const keys = await listKeys(store, "useful-documents/metadata/");
  const documents = (await Promise.all(keys.map((key) => store.get(key, { type: "json" }) as Promise<StoredDocument | null>)))
    .filter((item): item is StoredDocument => Boolean(item))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return documents.map(({ contentType: _contentType, filename: _filename, ...document }) => ({
    ...document,
    href: `/api/useful-documents?file=${encodeURIComponent(document.id)}`,
  }));
}

function parseDocument(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (title.length < 3) throw new Error("Indiquez un titre de document.");
  if (typeof body.folder !== "string" || !Object.hasOwn(folders, body.folder)) throw new Error("Choisissez une rubrique valide.");
  if (typeof body.contentBase64 !== "string" || body.contentBase64.length > 3 * 1024 * 1024 * 1.4)
    throw new Error("Le document dépasse la taille maximale de 3 Mo.");
  const compactBase64 = body.contentBase64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compactBase64)) throw new Error("Le document est invalide.");
  const bytes = Buffer.from(compactBase64, "base64");
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new Error("Le document dépasse la taille maximale de 3 Mo.");
  const filename = typeof body.filename === "string"
    ? body.filename.replace(/[^\p{L}\p{N} ._()-]/gu, "").trim().slice(0, 160)
    : "";
  const isPdf = bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  const isDocx = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!isPdf && !isDocx) throw new Error("Choisissez un fichier PDF ou DOCX valide.");
  const format = isPdf ? "PDF" as const : "DOCX" as const;
  if (!filename.toLocaleLowerCase("fr").endsWith(format === "PDF" ? ".pdf" : ".docx"))
    throw new Error(`L’extension du fichier ne correspond pas au format ${format}.`);
  return { title, folder: body.folder as DocumentFolder, bytes, filename, format };
}

async function guestAccounts(adminEmail: string) {
  const guests: Array<{ id: string; email: string }> = [];
  for (let page = 1; page <= 20; page += 1) {
    const users = await admin.listUsers({ page, perPage: 100 });
    guests.push(...users
      .filter((user) => Boolean(user.id && user.email) && normalizedEmail(user.email) !== normalizedEmail(adminEmail))
      .map((user) => ({ id: user.id, email: user.email as string })));
    if (users.length < 100) break;
  }
  return guests;
}

export default async function usefulDocumentsHandler(request: Request) {
  if (!isTrustedMutation(request)) return json({ error: "Requête refusée." }, 403);
  const user = await getUser();
  if (!user?.id || !user.email) return json({ error: "Authentification requise." }, 401);
  const adminEmail = configuredAdminEmail();
  const isAdmin = Boolean(normalizedEmail(adminEmail) && normalizedEmail(user.email) === normalizedEmail(adminEmail));
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  const url = new URL(request.url);

  if (request.method === "GET") {
    const requestedFile = url.searchParams.get("file");
    if (requestedFile) {
      if (!validId(requestedFile)) return json({ error: "Document invalide." }, 400);
      const [document, storedFile] = await Promise.all([
        store.get(metadataKey(requestedFile), { type: "json" }) as Promise<StoredDocument | null>,
        store.get(fileKey(requestedFile), { type: "json" }) as Promise<StoredFile | null>,
      ]);
      if (!document || !storedFile) return json({ error: "Document introuvable." }, 404);
      return new Response(Buffer.from(storedFile.contentBase64, "base64"), { headers: {
        "content-type": document.contentType,
        "content-disposition": `inline; filename="${document.filename.replace(/["\\]/g, "")}"`,
        "cache-control": "private, no-store",
      } });
    }
    if (url.searchParams.get("notifications") === "1") {
      const prefix = `useful-documents/notices/${encodeURIComponent(user.id)}/`;
      const keys = await listKeys(store, prefix);
      const notifications = (await Promise.all(keys.map((key) => store.get(key, { type: "json" }) as Promise<DocumentNotice | null>)))
        .filter((item): item is DocumentNotice => Boolean(item))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ notifications });
    }
    return json({ documents: await listDocuments(store), isAdmin });
  }

  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Données invalides." }, 400);

  if (body.action === "dismiss-notification") {
    if (!validId(body.id)) return json({ error: "Notification invalide." }, 400);
    await store.delete(noticeKey(user.id, body.id));
    return json({ dismissed: true });
  }
  if (body.action !== "add-document") return json({ error: "Action inconnue." }, 400);
  if (!isAdmin) return json({ error: "Ajout réservé au compte administrateur." }, 403);

  let parsed: ReturnType<typeof parseDocument>;
  try {
    parsed = parseDocument(body);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Document invalide." }, 400);
  }
  const id = crypto.randomUUID();
  const document: StoredDocument = {
    id,
    title: parsed.title,
    folder: parsed.folder,
    format: parsed.format,
    contentType: parsed.format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filename: parsed.filename,
    createdAt: new Date().toISOString(),
  };
  try {
    await store.setJSON(fileKey(id), { contentBase64: parsed.bytes.toString("base64") });
    await store.setJSON(metadataKey(id), document);
  } catch (error) {
    await Promise.allSettled([store.delete(fileKey(id)), store.delete(metadataKey(id))]);
    console.error("Ajout de document impossible", error);
    return json({ error: "Le document n’a pas pu être enregistré." }, 500);
  }

  let announcement: null | {
    attempted: true; accounts: number; inAppAlerts: number; emailsSent: number; emailsFailed: number; directoryAvailable: boolean;
  } = null;
  if (body.notifyGuests === true) {
    try {
      const guests = await guestAccounts(adminEmail || "");
      const notice: DocumentNotice = { id: crypto.randomUUID(), documentId: id, title: document.title, folderTitle: folders[document.folder], createdAt: document.createdAt };
      const alertResults = await Promise.allSettled(guests.map((guest) => store.setJSON(noticeKey(guest.id, notice.id), notice)));
      const emailResults = await Promise.allSettled(guests.map((guest) => sendDocumentAnnouncementEmail(guest.email, document.title, folders[document.folder])));
      announcement = {
        attempted: true,
        accounts: guests.length,
        inAppAlerts: alertResults.filter((result) => result.status === "fulfilled").length,
        emailsSent: emailResults.filter((result) => result.status === "fulfilled").length,
        emailsFailed: emailResults.filter((result) => result.status === "rejected").length,
        directoryAvailable: true,
      };
    } catch (error) {
      console.error("Diffusion du nouveau document impossible", error);
      announcement = { attempted: true, accounts: 0, inAppAlerts: 0, emailsSent: 0, emailsFailed: 0, directoryAvailable: false };
    }
  }
  const { contentType: _contentType, filename: _filename, ...publicDocument } = document;
  return json({ document: { ...publicDocument, href: `/api/useful-documents?file=${id}` }, announcement }, 201);
}

export const config = { path: "/api/useful-documents" };
