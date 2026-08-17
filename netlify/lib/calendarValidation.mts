export const MAX_CALENDAR_BODY_BYTES = 5_000_000;

/** Vérifie à la fois le format ISO et l'existence réelle de la date. */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

export async function readCalendarBody(request: Request) {
  const announcedLength = Number(request.headers.get("content-length") || 0);
  if (
    Number.isFinite(announcedLength) &&
    announcedLength > MAX_CALENDAR_BODY_BYTES
  )
    return { error: "Requête trop volumineuse" as const };

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_CALENDAR_BODY_BYTES)
    return { error: "Requête trop volumineuse" as const };
  try {
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return { error: "Requête invalide" as const };
    return { body: body as Record<string, unknown> };
  } catch {
    return { error: "Requête invalide" as const };
  }
}
