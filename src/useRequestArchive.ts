import { useEffect, useState } from "react";

export type ArchivedRequest = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  blob: Blob;
};

const REQUEST_ARCHIVE_DB = "planning-request-archive";
const REQUEST_ARCHIVE_STORE = "requests";

function openRequestArchiveDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(REQUEST_ARCHIVE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(REQUEST_ARCHIVE_STORE))
        request.result.createObjectStore(REQUEST_ARCHIVE_STORE, {
          keyPath: "id",
        });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readArchivedRequests() {
  const db = await openRequestArchiveDb();
  return new Promise<ArchivedRequest[]>((resolve, reject) => {
    const transaction = db.transaction(REQUEST_ARCHIVE_STORE, "readonly");
    const request = transaction.objectStore(REQUEST_ARCHIVE_STORE).getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as ArchivedRequest[]).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function removeArchivedRequest(id: string) {
  const db = await openRequestArchiveDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(REQUEST_ARCHIVE_STORE, "readwrite");
    transaction.objectStore(REQUEST_ARCHIVE_STORE).delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function archivedRequestDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function useRequestArchive(
  authStatus: "loading" | "guest" | "invite" | "ready",
  profile: "mika" | "agnes" | null | undefined,
  notify: (text: string) => void,
) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedRequests, setArchivedRequests] = useState<ArchivedRequest[]>(
    [],
  );

  async function loadRequestArchive() {
    try {
      setArchivedRequests(await readArchivedRequests());
    } catch {
      setArchivedRequests([]);
    }
  }

  useEffect(() => {
    if (authStatus !== "ready" || profile !== "mika") return;
    const reloadArchive = () => void loadRequestArchive();
    reloadArchive();
    window.addEventListener("focus", reloadArchive);
    window.addEventListener("pageshow", reloadArchive);
    return () => {
      window.removeEventListener("focus", reloadArchive);
      window.removeEventListener("pageshow", reloadArchive);
    };
  }, [authStatus, profile]);

  function openArchivedRequest(request: ArchivedRequest) {
    const url = URL.createObjectURL(request.blob);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function deleteArchivedRequest(request: ArchivedRequest) {
    if (!window.confirm(`Supprimer définitivement « ${request.name} » ?`))
      return;
    try {
      await removeArchivedRequest(request.id);
      setArchivedRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
    } catch {
      notify("La demande n’a pas pu être supprimée de l’archive.");
    }
  }

  return {
    archiveOpen,
    setArchiveOpen,
    archivedRequests,
    openArchivedRequest,
    deleteArchivedRequest,
  };
}
