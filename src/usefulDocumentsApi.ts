export type UsefulDocumentFolderKey = "expo" | "sap" | "brantome";

export type SharedUsefulDocument = {
  id: string;
  title: string;
  folder: UsefulDocumentFolderKey;
  format: "PDF" | "DOCX";
  createdAt: string;
  href: string;
};

export type UsefulDocumentAnnouncement = {
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
  return parse<{ documents: SharedUsefulDocument[] }>(await fetch("/api/useful-documents", {
    cache: "no-store",
    credentials: "same-origin",
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
    }),
  }));
}
