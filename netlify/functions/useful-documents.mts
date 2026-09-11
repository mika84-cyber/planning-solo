import { Buffer } from "node:buffer";
import { getStore } from "@netlify/blobs";
import { admin, getUser } from "@netlify/identity";
import { sendDocumentAnnouncementEmail } from "../lib/documentAnnouncementEmail.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { archive, futureDate, rememberDelivery, receiptKey, type Job, type Delivery, deliveryKey } from '../lib/adminTools.mts';
import { currentReplacement, revisionPrefix, saveDocumentVersion, versionResponse, type DocumentFileVersion, type DocumentRevision } from '../lib/documentVersions.mts';

type DocumentFolder = "expo" | "sap" | "brantome";
type StoredDocument = {
  id: string;
  title: string;
  folder: DocumentFolder;
  format: "PDF" | "DOCX";
  contentType: string;
  filename: string;
  createdAt: string;
  recipientIds?: string[];
  publishAt?: string;
};
type StoredFile = { contentBase64: string };
type DocumentNotice = { id: string; documentId: string; title: string; folderTitle: string; createdAt: string; message?: string; format?: "PDF" | "DOCX" };

// Seuls les documents intégrés connus peuvent être annoncés, jamais une URL fournie par le client.
const builtInDocuments: Record<string, { title: string; folder: DocumentFolder }> = {
  "hilma-af-klint.pdf": { title: "Hilma Af Klint", folder: "expo" },
  "demande-conges.pdf": { title: "Demande de congés", folder: "sap" },
  "demande-recuperations.pdf": { title: "Demande de récupérations", folder: "sap" },
  "demande-annulation-conges.pdf": { title: "Demande d’annulation de congés", folder: "sap" },
  "formulaire-changement-coordonnees.pdf": { title: "Formulaire de changement de coordonnées", folder: "brantome" },
  "changement-coordonnees-bancaires.docx": { title: "Changement de coordonnées bancaires", folder: "brantome" },
  "demande-carte-restauration-bimpli.pdf": { title: "Demande de carte de restauration BIMPLI", folder: "brantome" },
  "procuration-retrait-titres-repas.pdf": { title: "Procuration pour le retrait des titres-restaurant", folder: "brantome" },
  "demande-carte-culture-a.pdf": { title: "Demande de Carte Culture A", folder: "brantome" },
  "cet-demande-ouverture.pdf": { title: "CET - Demande d’ouverture", folder: "brantome" },
  "cet-alimentation-indemnisation.pdf": { title: "CET - Alimentation et indemnisation", folder: "brantome" },
};

const folders: Record<DocumentFolder, string> = {
  expo: "Formulaire Expo",
  sap: "Formulaire SAP",
  brantome: "Formulaire Brantôme",
};
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store, max-age=0" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const metadataKey = (id: string) => `useful-documents/metadata/${id}`;
const catalogKey = (id: string) => `useful-documents/catalog/${id}`;
type CatalogEdit = { id: string; title?: string; deleted?: boolean };
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

async function listDocuments(store: ReturnType<typeof getStore>, userId: string, isAdmin: boolean) {
  const keys = await listKeys(store, "useful-documents/metadata/");
  const documents = (await Promise.all(keys.map((key) => store.get(key, { type: "json" }) as Promise<StoredDocument | null>)))
    .filter((item): item is StoredDocument => Boolean(item))
    .filter(item => isAdmin || !item.publishAt || Date.parse(item.publishAt) <= Date.now())
    .filter(item => isAdmin || !item.recipientIds || item.recipientIds.includes(userId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return documents.map(({ contentType: _contentType, filename: _filename, recipientIds: _recipientIds, ...document }) => ({
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
  const guests: Array<{ id: string; email: string; name: string }> = [];
  for (let page = 1; page <= 20; page += 1) {
    const users = await admin.listUsers({ page, perPage: 100 });
    guests.push(...users
      .filter((user) => Boolean(user.id && user.email) && normalizedEmail(user.email) !== normalizedEmail(adminEmail))
      .map((user) => {
        const metadataName = typeof user.userMetadata?.full_name === "string" ? user.userMetadata.full_name
          : typeof user.userMetadata?.name === "string" ? user.userMetadata.name : "";
        const name = (user.name || metadataName).replace(/\s+/g, " ").trim();
        return { id: user.id, email: user.email as string, name: name || "Nom non renseigné" };
      }));
    if (users.length < 100) break;
  }
  return guests.sort((first, second) => first.name.localeCompare(second.name, "fr", { sensitivity: "base" }));
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
    const versionsOf = url.searchParams.get('versions');
    if (versionsOf) {
      if (!isAdmin) return json({ error: 'Accès réservé à l’administrateur.' }, 403);
      if (!validId(versionsOf) && !Object.hasOwn(builtInDocuments, versionsOf)) return json({ error: 'Document invalide.' }, 400);
      const keys = await listKeys(store, revisionPrefix(versionsOf));
      const versions = (await Promise.all(keys.map(key => store.get(key, { type: 'json' }) as Promise<DocumentRevision | null>)))
        .filter((item): item is DocumentRevision => Boolean(item)).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .map(item => ({ id: item.id, savedAt: item.savedAt, filename: item.file?.filename || 'Document d’origine' }));
      return json({ versions });
    }
    if (url.searchParams.get("recipients") === "1") {
      if (!isAdmin) return json({ error: "Accès réservé à l’administrateur." }, 403);
      try {
        const recipients = (await guestAccounts(adminEmail || "")).map(({ id, name }) => ({ id, name }));
        return json({ recipients });
      }
      catch { return json({ error: "Impossible de charger les comptes invités. Réessayez." }, 503); }
    }
    const requestedFile = url.searchParams.get("file");
    if (requestedFile) {
      if (!validId(requestedFile)) return json({ error: "Document invalide." }, 400);
      const [document, storedFile] = await Promise.all([
        store.get(metadataKey(requestedFile), { type: "json" }) as Promise<StoredDocument | null>,
        store.get(fileKey(requestedFile), { type: "json" }) as Promise<StoredFile | null>,
      ]);
      if (!document || !storedFile) return json({ error: "Document introuvable." }, 404);
      if (!isAdmin && document.publishAt && Date.parse(document.publishAt) > Date.now()) return json({ error: 'Document introuvable.' }, 404);
      if (!isAdmin && document.recipientIds && !document.recipientIds.includes(user.id)) return json({ error: "Document introuvable." }, 404);
      const replacement = await currentReplacement(store, requestedFile);
      if (replacement) return versionResponse(replacement);
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
    const catalogKeys = await listKeys(store, "useful-documents/catalog/");
    const catalogEdits = (await Promise.all(catalogKeys.map(key => store.get(key, { type: "json" })))).filter(Boolean);
    return json({ documents: await listDocuments(store, user.id, isAdmin), catalogEdits, isAdmin });
  }

  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Données invalides." }, 400);

  if (body.action === 'replace-document' || body.action === 'restore-document-version') {
    if (!isAdmin) return json({ error: 'Modification réservée au compte administrateur.' }, 403);
    const id = typeof body.documentId === 'string' ? body.documentId : '';
    const builtIn = Object.hasOwn(builtInDocuments, id);
    const document = builtIn ? builtInDocuments[id] : validId(id) ? await store.get(metadataKey(id), { type: 'json' }) as StoredDocument | null : null;
    const edit = builtIn ? await store.get(catalogKey(id), { type: 'json' }) as CatalogEdit | null : null;
    if (!document || edit?.deleted) return json({ error: 'Document introuvable.' }, 404);
    try {
      let previous = await currentReplacement(store, id);
      if (!previous && !builtIn) {
        const original = await store.get(fileKey(id), { type: 'json' }) as StoredFile | null;
        if (!original) return json({ error: 'Fichier d’origine introuvable.' }, 404);
        const metadata = document as StoredDocument;
        previous = { ...original, filename: metadata.filename, contentType: metadata.contentType, updatedAt: metadata.createdAt };
      }
      let next: DocumentFileVersion | null;
      if (body.action === 'replace-document') {
        const parsed = parseDocument({ ...body, title: document.title, folder: document.folder });
        const format = builtIn ? id.endsWith('.docx') ? 'DOCX' : 'PDF' : (document as StoredDocument).format;
        if (parsed.format !== format) return json({ error: `Choisissez un fichier ${format} pour conserver le format du document.` }, 400);
        next = { contentBase64: parsed.bytes.toString('base64'), filename: parsed.filename, contentType: format === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', updatedAt: new Date().toISOString() };
      } else {
        if (!validId(body.versionId)) return json({ error: 'Version invalide.' }, 400);
        const revision = await store.get(`${revisionPrefix(id)}${body.versionId}`, { type: 'json' }) as DocumentRevision | null;
        if (!revision) return json({ error: 'Version introuvable.' }, 404);
        next = revision.file;
      }
      await saveDocumentVersion(store, id, previous, next);
      return json({ id, updated: true });
    } catch (error) { return json({ error: error instanceof Error ? error.message : 'Remplacement impossible.' }, 400); }
  }

  if (body.action === 'seen-notification') {
    if (!validId(body.id)) return json({ error: 'Notification invalide.' }, 400);
    const notice = await store.get(noticeKey(user.id, body.id), { type: 'json' });
    if (!notice) return json({ error: 'Notification introuvable.' }, 404);
    await store.setJSON(receiptKey(user.id, body.id), { seenAt: new Date().toISOString() }, { onlyIfNew: true });
    return json({ seen: true });
  }

  if (body.action === "dismiss-notification") {
    if (!validId(body.id)) return json({ error: "Notification invalide." }, 400);
    await store.delete(noticeKey(user.id, body.id));
    return json({ dismissed: true });
  }
  if (body.action === "rename-document" || body.action === "delete-document") {
    if (!isAdmin) return json({ error: "Modification réservée au compte administrateur." }, 403);
    const id = typeof body.documentId === "string" ? body.documentId : "";
    const builtIn = Object.hasOwn(builtInDocuments, id);
    const document = builtIn ? builtInDocuments[id] : validId(id) ? await store.get(metadataKey(id), { type: "json" }) as StoredDocument | null : null;
    const edit = builtIn ? await store.get(catalogKey(id), { type: "json" }) as CatalogEdit | null : null;
    if (!document || edit?.deleted) return json({ error: "Document introuvable." }, 404);
    if (body.action === "delete-document") {
      await archive(store, { kind: 'document', title: edit?.title || document.title, entries: builtIn
        ? [{ key: catalogKey(id), value: edit || null }]
        : [{ key: fileKey(id), value: await store.get(fileKey(id), { type: 'json' }) }, { key: metadataKey(id), value: document }] });
      if (builtIn) await store.setJSON(catalogKey(id), { id, deleted: true });
      else {
        await store.delete(metadataKey(id));
        await store.delete(fileKey(id));
      }
      return json({ deleted: true });
    }
    const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
    if (title.length < 3 || title.length > 120) return json({ error: "Le titre doit contenir entre 3 et 120 caractères." }, 400);
    if (builtIn) await store.setJSON(catalogKey(id), { id, title });
    else await store.setJSON(metadataKey(id), { ...document, title });
    return json({ title });
  }
  if (body.action === "share-document") {
    if (!isAdmin) return json({ error: "Partage réservé au compte administrateur." }, 403);
    const id = typeof body.documentId === "string" ? body.documentId : "";
    let document = Object.hasOwn(builtInDocuments, id) ? builtInDocuments[id]
      : validId(id) ? await store.get(metadataKey(id), { type: "json" }) as StoredDocument | null : null;
    if (Object.hasOwn(builtInDocuments, id)) {
      const edit = await store.get(catalogKey(id), { type: "json" }) as CatalogEdit | null;
      if (edit?.deleted) document = null;
      else if (edit?.title && document) document = { ...document, title: edit.title };
    }
    if (!document) return json({ error: "Document introuvable." }, 404);
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 1000)
      return json({ error: "Saisissez un message de 1 à 1 000 caractères." }, 400);
    if (body.audience !== "all" && body.audience !== "selected") return json({ error: "Choisissez les destinataires." }, 400);
    let guests: Array<{ id: string; email: string; name: string }>;
    try { guests = await guestAccounts(adminEmail || ""); }
    catch { return json({ error: "Annuaire indisponible : aucun partage envoyé. Réessayez." }, 503); }
    if (body.audience === "selected") {
      if (!Array.isArray(body.recipientIds) || !body.recipientIds.length || body.recipientIds.some(id => typeof id !== "string")) return json({ error: "Sélectionnez au moins un compte invité." }, 400);
      const ids = new Set(body.recipientIds);
      guests = guests.filter(guest => ids.has(guest.id));
      if (guests.length !== ids.size) return json({ error: "Un compte sélectionné n’est plus disponible." }, 400);
    }
    if (body.reminderId !== undefined) {
      if (!validId(body.reminderId)) return json({ error: 'Alerte invalide.' }, 400);
      const delivery = await store.get(deliveryKey(body.reminderId), { type: 'json' }) as Delivery | null;
      if (!delivery || delivery.notice.documentId !== id) return json({ error: 'Alerte introuvable.' }, 404);
      const receipts = await Promise.all(guests.map(guest => store.get(receiptKey(guest.id, body.reminderId as string), { type: 'json' })));
      guests = guests.filter((guest, index) => !receipts[index] && delivery.recipients.some(recipient => recipient.id === guest.id));
    }
    if (!guests.length) return json({ error: body.reminderId ? 'Tous les destinataires ont déjà vu cette alerte.' : "Aucun compte invité disponible." }, 400);
    let scheduledAt: string | undefined;
    try { scheduledAt = futureDate(body.publishAt); } catch (error) { return json({ error: (error as Error).message }, 400); }
    if ('publishAt' in document && typeof document.publishAt === 'string' && Date.parse(document.publishAt) > Date.now() && (!scheduledAt || Date.parse(scheduledAt) < Date.parse(document.publishAt))) return json({ error: 'Programmez l’alerte après la publication du document.' }, 400);
    if (scheduledAt) {
      const notice: DocumentNotice = { id: crypto.randomUUID(), documentId: id, title: document.title, folderTitle: folders[document.folder], createdAt: scheduledAt, message: body.message.trim(), format: (document as Partial<StoredDocument>).format ?? (id.endsWith('.docx') ? 'DOCX' : 'PDF') };
      const job: Job = { id: crypto.randomUUID(), documentId: id, title: document.title, at: scheduledAt, notice, recipients: guests, alertSent: [], emailSent: [], status: 'pending' };
      await store.setJSON(`admin-tools/jobs/${job.id}`, job);
      return json({ scheduled: true, at: scheduledAt, accounts: guests.length, inAppAlerts: 0, emailsSent: 0 });
    }
    // Un partage élargit les accès d’un document ciblé sans retirer ceux déjà accordés.
    if ("recipientIds" in document && Array.isArray(document.recipientIds)) {
      await store.setJSON(metadataKey(id), { ...document, recipientIds: [...new Set([...document.recipientIds, ...guests.map(guest => guest.id)])] });
    }
    const notice: DocumentNotice = { id: crypto.randomUUID(), documentId: id, title: document.title, folderTitle: folders[document.folder], createdAt: new Date().toISOString(), message: body.message.trim(), format: (document as Partial<StoredDocument>).format ?? (id.toLocaleLowerCase("fr").endsWith(".docx") ? "DOCX" : "PDF") };
    const alerts = await Promise.allSettled(guests.map(guest => store.setJSON(noticeKey(guest.id, notice.id), notice)));
    const emails = await Promise.allSettled(guests.map(guest => sendDocumentAnnouncementEmail(guest.email, document.title, folders[document.folder])));
    await rememberDelivery(store, notice, guests, guests.filter((_, index) => alerts[index].status === 'fulfilled').map(guest => guest.id), guests.filter((_, index) => emails[index].status === 'fulfilled').map(guest => guest.id));
    return json({ accounts: guests.length, inAppAlerts: alerts.filter(result => result.status === "fulfilled").length, emailsSent: emails.filter(result => result.status === "fulfilled").length });
  }
  if (body.action !== "add-document") return json({ error: "Action inconnue." }, 400);
  if (!isAdmin) return json({ error: "Ajout réservé au compte administrateur." }, 403);

  let parsed: ReturnType<typeof parseDocument>;
  try {
    parsed = parseDocument(body);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Document invalide." }, 400);
  }
  let selectedGuests: Array<{ id: string; email: string }> | undefined;
  if (body.recipientIds !== undefined) {
    if (!Array.isArray(body.recipientIds) || !body.recipientIds.length || body.recipientIds.some(id => typeof id !== "string")) return json({ error: "Sélectionnez au moins un compte invité." }, 400);
    let guests: Array<{ id: string; email: string }>;
    try { guests = await guestAccounts(adminEmail || ""); }
    catch { return json({ error: "Annuaire indisponible : aucun document envoyé. Réessayez." }, 503); }
    const ids = new Set(body.recipientIds);
    selectedGuests = guests.filter(guest => ids.has(guest.id));
    if (selectedGuests.length !== ids.size) return json({ error: "Un compte sélectionné n’est plus disponible. Actualisez la liste." }, 400);
  }
  const id = crypto.randomUUID();
  let publishAt: string | undefined;
  try { publishAt = futureDate(body.publishAt); } catch (error) { return json({ error: (error as Error).message }, 400); }
  let scheduledGuests: Array<{ id: string; email: string }> = [];
  if (publishAt && body.notifyGuests === true) {
    try { scheduledGuests = selectedGuests ?? await guestAccounts(adminEmail || ''); }
    catch { return json({ error: 'Annuaire indisponible : programmation non enregistrée.' }, 503); }
  }
  const document: StoredDocument = {
    id,
    title: parsed.title,
    folder: parsed.folder,
    format: parsed.format,
    contentType: parsed.format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filename: parsed.filename,
    createdAt: new Date().toISOString(),
    ...(publishAt ? { publishAt } : {}),
    ...(selectedGuests ? { recipientIds: selectedGuests.map(guest => guest.id) } : {}),
  };
  try {
    await store.setJSON(fileKey(id), { contentBase64: parsed.bytes.toString("base64") });
    await store.setJSON(metadataKey(id), document);
  } catch (error) {
    await Promise.allSettled([store.delete(fileKey(id)), store.delete(metadataKey(id))]);
    console.error("Ajout de document impossible", error);
    return json({ error: "Le document n’a pas pu être enregistré." }, 500);
  }

  if (publishAt) {
    const job: Job = { id: crypto.randomUUID(), at: publishAt, title: document.title, documentId: id, publishesDocument: true, recipients: scheduledGuests, alertSent: [], emailSent: [], status: 'pending',
      ...(body.notifyGuests === true ? { notice: { id: crypto.randomUUID(), documentId: id, title: document.title, folderTitle: folders[document.folder], createdAt: publishAt, format: document.format, message: typeof body.message === 'string' ? body.message.slice(0, 1000) : undefined } } : {}) };
    try { await store.setJSON(`admin-tools/jobs/${job.id}`, job); }
    catch { await Promise.allSettled([store.delete(fileKey(id)), store.delete(metadataKey(id))]); return json({ error: 'Programmation impossible, réessayez.' }, 500); }
  }

  let announcement: null | {
    attempted: true; accounts: number; inAppAlerts: number; emailsSent: number; emailsFailed: number; directoryAvailable: boolean;
  } = null;
  if (body.notifyGuests === true && !publishAt) {
    try {
      const guests = selectedGuests ?? await guestAccounts(adminEmail || "");
      const notice: DocumentNotice = { id: crypto.randomUUID(), documentId: id, title: document.title, folderTitle: folders[document.folder], createdAt: document.createdAt, format: document.format };
      const alertResults = await Promise.allSettled(guests.map((guest) => store.setJSON(noticeKey(guest.id, notice.id), notice)));
      const emailResults = await Promise.allSettled(guests.map((guest) => sendDocumentAnnouncementEmail(guest.email, document.title, folders[document.folder])));
      await rememberDelivery(store, notice, guests, guests.filter((_, index) => alertResults[index].status === 'fulfilled').map(guest => guest.id), guests.filter((_, index) => emailResults[index].status === 'fulfilled').map(guest => guest.id));
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
  const { contentType: _contentType, filename: _filename, recipientIds: _recipientIds, ...publicDocument } = document;
  return json({ document: { ...publicDocument, href: `/api/useful-documents?file=${id}` }, announcement }, 201);
}

export const config = { path: "/api/useful-documents" };
