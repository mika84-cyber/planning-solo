export class CalendarApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CalendarApiError";
  }
}

function announceSync(status: "saving" | "saved" | "error") {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("calendar-sync", {
        detail: { status, at: new Date().toISOString() },
      }),
    );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | ({ error?: string } & T)
    | null;
  if (!response.ok)
    throw new CalendarApiError(
      payload?.error || "La synchronisation a échoué.",
      response.status,
    );
  return (payload || {}) as T;
}

export async function getCalendar<T>() {
  const response = await fetch("/api/calendar", {
    cache: "no-store",
    credentials: "same-origin",
  });
  return parseResponse<T>(response);
}

export async function postCalendar<T = { ok: true }>(
  payload: Record<string, unknown>,
) {
  announceSync("saving");
  try {
    const response = await fetch("/api/calendar", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<T>(response);
    announceSync("saved");
    return result;
  } catch (error) {
    announceSync("error");
    throw error;
  }
}

/** Signale au serveur qu’un compte authentifié utilise réellement
 * l’application. L’appel reste silencieux : une alerte indisponible ne doit
 * jamais empêcher le chargement du planning. */
export async function notifyGuestSession() {
  await fetch("/api/guest-session", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });
}

function retryableCalendarError(error: unknown) {
  return (
    !(error instanceof CalendarApiError) ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504
  );
}

/** Réservé aux écritures munies d'identifiants client stables. Une réponse
 * perdue peut ainsi être rejouée une fois sans créer de doublon. */
export async function postCalendarIdempotent<T = { ok: true }>(
  payload: Record<string, unknown>,
) {
  announceSync("saving");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await parseResponse<T>(response);
      announceSync("saved");
      return result;
    } catch (error) {
      if (attempt === 0 && retryableCalendarError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      announceSync("error");
      throw error;
    }
  }
  throw new Error("Écriture idempotente inachevée");
}

/** Sauvegarde un lot de périodes avec des identifiants stables. Si la réponse
 * d'écriture est perdue après que Netlify Blobs a accepté les données, une
 * lecture de contrôle confirme les identifiants avant de remonter une erreur.
 * Une vraie sauvegarde absente continue, elle, d'échouer. */
export async function postCalendarPeriodsVerified<
  TPeriod extends { id: string; from: string; to: string },
>(periods: Array<Record<string, unknown> & { id: string; from: string; to: string }>) {
  try {
    return await postCalendarIdempotent<{
      ok: true;
      periods: TPeriod[];
      recovered?: boolean;
    }>({ action: "save-periods", periods });
  } catch (writeError) {
    try {
      const snapshot = await getCalendar<{ periods?: TPeriod[] }>();
      const byId = new Map((snapshot.periods || []).map((period) => [period.id, period]));
      const confirmed = periods.map((period) => {
        const stored = byId.get(period.id);
        return stored?.from === period.from && stored?.to === period.to
          ? stored
          : undefined;
      });
      if (confirmed.every(Boolean)) {
        announceSync("saved");
        return {
          ok: true as const,
          periods: confirmed as TPeriod[],
          recovered: true,
        };
      }
    } catch {
      // L'erreur d'écriture initiale reste la plus utile. Une relecture en
      // panne ne doit pas la remplacer par un second message générique.
    }
    throw writeError;
  }
}

export function postCalendarBatch<T = unknown>(
  operations: Array<Record<string, unknown>>,
) {
  return postCalendar<{ ok: true; results: T[] }>({
    action: "batch",
    operations,
  });
}

export function calendarErrorMessage(error: unknown, fallback: string) {
  return error instanceof CalendarApiError ? error.message : fallback;
}
