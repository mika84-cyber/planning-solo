export const MAX_CALENDAR_BODY_BYTES = 5_000_000;

const BULK_LEAVE_TYPES = new Set([
  "annual",
  "rtt",
  "fraction",
  "half",
  "recovery",
  "sick",
  "cet",
  "other",
  "childcare",
  "exceptional",
]);

export type NormalizedBulkPeriod = {
  id: string;
  from: string;
  to: string;
  leave_type:
    | "annual"
    | "rtt"
    | "fraction"
    | "half"
    | "recovery"
    | "sick"
    | "cet"
    | "other"
    | "childcare"
    | "exceptional";
  half_moment: "morning" | "afternoon" | "";
  group?: number;
  updated_at: string;
};

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

/** Valide en une passe les périodes indépendantes créées par la sélection de
 * plusieurs dates. Les identifiants viennent du client afin qu'une requête
 * réessayée après une coupure réseau écrive les mêmes clés, sans doublon. */
export function normalizeBulkPeriods(
  value: unknown,
  updatedAt = new Date().toISOString(),
): { periods: NormalizedBulkPeriod[] } | { error: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 400)
    return { error: "Lot de congés invalide" };

  const ids = new Set<string>();
  const periods: NormalizedBulkPeriod[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return { error: "Congé invalide dans le lot" };
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const from = typeof item.from === "string" ? item.from : "";
    const to = typeof item.to === "string" ? item.to : "";
    const leaveType =
      typeof item.leaveType === "string" ? item.leaveType : "";
    const group = Number(item.group);
    const halfMoment =
      item.halfMoment === "morning" || item.halfMoment === "afternoon"
        ? item.halfMoment
        : "";
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || ids.has(id))
      return { error: "Identifiant de congé invalide dans le lot" };
    if (!isValidDateKey(from) || !isValidDateKey(to) || to < from)
      return { error: "Date de congé invalide dans le lot" };
    const span =
      Math.floor(
        (Date.parse(`${to}T12:00:00Z`) -
          Date.parse(`${from}T12:00:00Z`)) /
          86400000,
      ) + 1;
    if (span < 1 || span > 366 || !BULK_LEAVE_TYPES.has(leaveType))
      return { error: "Congé invalide dans le lot" };
    if (![1, 2, 3].includes(group))
      return { error: "Groupe invalide dans le lot" };
    ids.add(id);
    periods.push({
      id,
      from,
      to,
      leave_type: leaveType as NormalizedBulkPeriod["leave_type"],
      half_moment: leaveType === "half" ? halfMoment : "",
      group,
      updated_at: updatedAt,
    });
  }
  return { periods };
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
