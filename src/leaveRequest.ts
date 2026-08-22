export type NormalizedRequestPeriod = {
  id: string;
  from: string;
  to: string;
  leaveType:
    | "annual"
    | "rtt"
    | "fraction"
    | "half"
    | "recovery"
    | "childcare"
    | "exceptional";
  halfMoment?: "morning" | "afternoon";
  group: number;
};

export type NormalizedRecoverySelection = {
  id: string;
  date: string;
  type:
    | "recovery_day"
    | "recovery_half"
    | "recovery_hours"
    | "recovery_holiday"
    | "recovery_training";
  start?: string;
  end?: string;
};

export class LeaveRequestValidationError extends Error {}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function span(from: string, to: string) {
  return Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1;
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  for (
    let cursor = Date.parse(`${from}T12:00:00Z`);
    cursor <= Date.parse(`${to}T12:00:00Z`);
    cursor += 86400000
  )
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  return dates;
}

function validTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60);
}

export function normalizeLeaveRequest(body: Record<string, unknown>) {
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const requestKind = body.requestKind === "leave" || body.requestKind === "recovery" ? body.requestKind : "";
  const group = [1, 2, 3].includes(Number(body.group)) ? Number(body.group) : 0;
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(requestId) || !requestKind || !group)
    throw new LeaveRequestValidationError("Demande de congé invalide");

  const periods: Omit<NormalizedRequestPeriod, "id" | "group">[] = [];
  const recoverySelections: Omit<NormalizedRecoverySelection, "id">[] = [];
  const typeMap: Record<string, NormalizedRequestPeriod["leaveType"]> = {
    annual: "annual",
    rtt: "rtt",
    fraction: "fraction",
    childcare: "childcare",
    exceptional: "exceptional",
    recovery_day: "recovery",
  };
  for (const raw of Array.isArray(body.periods) ? body.periods : []) {
    if (!raw || typeof raw !== "object")
      throw new LeaveRequestValidationError("Une période de la demande est invalide");
    const item = raw as Record<string, unknown>;
    const from = item.from;
    const to = item.to || from;
    const leaveType = typeMap[String(item.type || "")];
    const rawType = String(item.type || "");
    if (
      !leaveType ||
      !validDate(from) ||
      !validDate(to) ||
      to < from ||
      span(from, to) > 366 ||
      (requestKind === "leave" && rawType === "recovery_day") ||
      (requestKind === "recovery" && rawType !== "recovery_day")
    )
      throw new LeaveRequestValidationError("Une période de la demande est invalide");
    if (requestKind === "recovery")
      for (const date of datesBetween(from, to))
        recoverySelections.push({ date, type: "recovery_day" });
    else periods.push({ from, to, leaveType });
  }
  for (const raw of Array.isArray(body.timed) ? body.timed : []) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const type = String(item.type || "");
    const allowed =
      requestKind === "leave"
        ? type === "half"
        : type === "recovery_half" ||
          type === "recovery_hours" ||
          type === "recovery_holiday" ||
          type === "recovery_training";
    if (!allowed) continue;
    if (!validDate(item.date))
      throw new LeaveRequestValidationError("Une date de la demande est invalide");
    const start = typeof item.start === "string" ? item.start : "";
    const end = typeof item.end === "string" ? item.end : "";
    if (
      !validTime(start) ||
      (requestKind === "recovery" && (!validTime(end) || start === end))
    )
      throw new LeaveRequestValidationError("Les horaires de la récupération sont invalides");
    if (requestKind === "recovery")
      recoverySelections.push({
        date: item.date,
        type: type as NormalizedRecoverySelection["type"],
        start,
        end,
      });
    else
      periods.push({
        from: item.date,
        to: item.date,
        leaveType: "half",
        halfMoment: start < "13:30" ? "morning" : "afternoon",
      });
  }
  if (
    (!periods.length && !recoverySelections.length) ||
    periods.length + recoverySelections.length > 40
  )
    throw new LeaveRequestValidationError("La demande ne contient aucune période enregistrable");
  return {
    requestId,
    requestKind,
    group,
    periods: periods.map((period, index) => ({
      ...period,
      id: `${requestId}-${index + 1}`,
      group,
    })),
    recoverySelections: recoverySelections.map((selection, index) => ({
      ...selection,
      id: `${requestId}-recovery-${index + 1}`,
    })),
  };
}
