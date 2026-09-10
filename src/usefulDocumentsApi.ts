export type UsefulDocumentFolderKey = "expo" | "sap" | "brantome";
export type UsefulDocumentEdit = { id: string; title?: string; deleted?: boolean; href?: string };
export type UsefulDocumentVersion = { id: string; savedAt: string; filename: string };

export async function getUsefulDocumentVersions(id: string) {
  return parse<{ versions: UsefulDocumentVersion[] }>(await fetch(`/api/useful-documents?versions=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' }));
}

export async function replaceUsefulDocument(id: string, file: File) {
  if (file.size > 3 * 1024 * 1024) throw new Error('Le document dépasse la taille maximale de 3 Mo.');
  return parse(await fetch('/api/useful-documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'replace-document', documentId: id, filename: file.name, contentBase64: await fileToBase64(file) }),
  }));
}

export async function restoreUsefulDocumentVersion(id: string, versionId: string) {
  return parse(await fetch('/api/useful-documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'restore-document-version', documentId: id, versionId }),
  }));
}

export type SharedUsefulDocument = {
  id: string;
  title: string;
  folder: UsefulDocumentFolderKey;
  format: "PDF" | "DOCX";
  createdAt: string;
  href: string;
  publishAt?: string;
};

export type UsefulDocumentAnnouncement = {
  message?: string;
  format?: "PDF" | "DOCX";
  id: string;
  documentId: string;
  title: string;
  folderTitle: string;
  createdAt: string;
};

async function parse<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!response.ok) throw new Error(body?.error || "Les documents sont momentanément indisponibles.");
  return (body || {}) as T;
}

export async function getSharedUsefulDocuments() {
  return parse<{ documents: SharedUsefulDocument[]; catalogEdits?: UsefulDocumentEdit[] }>(await fetch("/api/useful-documents", {
    cache: "no-store",
    credentials: "same-origin",
  }));
}

export async function getUsefulDocumentRecipients() {
  return parse<{ recipients: Array<{ id: string; name: string }> }>(await fetch("/api/useful-documents?recipients=1", { cache: "no-store", credentials: "same-origin" }));
}

export async function shareUsefulDocument(input: { documentId: string; audience: "all" | "selected"; recipientIds: string[]; message: string; publishAt?: string; reminderId?: string }) {
  return parse<{ accounts: number; inAppAlerts: number; emailsSent: number; scheduled?: boolean }>(await fetch("/api/useful-documents", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "share-document", ...input }),
  }));
}

export async function editUsefulDocument(documentId: string, action: "rename-document" | "delete-document", title?: string) {
  return parse<{ title?: string; deleted?: boolean }>(await fetch("/api/useful-documents", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, documentId, title }),
  }));
}

export async function getUsefulDocumentAnnouncements() {
  return parse<{ notifications: UsefulDocumentAnnouncement[] }>(await fetch("/api/useful-documents?notifications=1", {
    cache: "no-store",
    credentials: "same-origin",
  }));
}

export async function dismissUsefulDocumentAnnouncement(id: string) {
  return parse<{ dismissed: true }>(await fetch("/api/useful-documents", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "dismiss-notification", id }),
  }));
}

export async function markDocumentAnnouncementSeen(id: string) {
  return parse(await fetch('/api/useful-documents', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'seen-notification', id }) }));
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Le document n’a pas pu être lu."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export async function addSharedUsefulDocument(input: {
  title: string;
  folder: UsefulDocumentFolderKey;
  file: File;
  notifyGuests: boolean;
  publishAt?: string;
  message?: string;
  recipientIds?: string[];
}) {
  if (input.file.size > 3 * 1024 * 1024)
    throw new Error("Le document dépasse la taille maximale de 3 Mo.");
  const contentBase64 = await fileToBase64(input.file);
  return parse<{
    document: SharedUsefulDocument;
    announcement: null | {
      attempted: true;
      accounts: number;
      inAppAlerts: number;
      emailsSent: number;
      emailsFailed: number;
      directoryAvailable: boolean;
    };
  }>(await fetch("/api/useful-documents", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "add-document",
      title: input.title,
      folder: input.folder,
      filename: input.file.name,
      contentType: input.file.type,
      contentBase64,
      notifyGuests: input.notifyGuests,
      publishAt: input.publishAt,
      message: input.message,
      recipientIds: input.recipientIds,
    }),
  }));
}
