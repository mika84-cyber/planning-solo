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
