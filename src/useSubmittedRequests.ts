import { useEffect, useState } from "react";

export type SubmittedRequestPeriod = {
  from: string;
  to: string;
  type: string;
};

export type SubmittedRequest = {
  id: string;
  createdAt: string;
  kind: string;
  periods: SubmittedRequestPeriod[];
};

const STORAGE_KEY = "planning:submitted-requests:v1";

function readSubmittedRequests(): SubmittedRequest[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item): item is SubmittedRequest =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.createdAt === "string" &&
          Array.isArray(item.periods),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/** Consigne une demande au moment où elle part vers le formulaire.
 *
 *  Ce journal est indépendant du planning : effacer une ligne retire la trace
 *  de la demande, jamais le congé posé. Il est aussi propre à l'appareil,
 *  comme l'archive des PDF.
 */
export function recordSubmittedRequest(
  request: Omit<SubmittedRequest, "id">,
): void {
  try {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next = [{ ...request, id }, ...readSubmittedRequests()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Le journal est un confort : son échec ne doit pas bloquer la demande.
  }
}

export function useSubmittedRequests() {
  const [submittedRequests, setSubmittedRequests] = useState<
    SubmittedRequest[]
  >(() => readSubmittedRequests());

  useEffect(() => {
    const reload = () => setSubmittedRequests(readSubmittedRequests());
    window.addEventListener("focus", reload);
    window.addEventListener("pageshow", reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("pageshow", reload);
    };
  }, []);

  function deleteSubmittedRequest(request: SubmittedRequest) {
    const next = readSubmittedRequests().filter(
      (item) => item.id !== request.id,
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Rien à faire : la liste affichée reste alignée sur ce qui a pu être écrit.
    }
    setSubmittedRequests(next);
  }

  return { submittedRequests, deleteSubmittedRequest };
}
