import type { WorkQuota, RecoveryRequestType } from "./overtime";
import type { LeaveType } from "./planningLogic";

type DemoRequestBase = {
  requestId: string;
  group: number;
  profile: { workQuota: WorkQuota };
};

type DemoLeaveRequest = DemoRequestBase & {
  requestKind: "leave";
  periods: Array<{ from: string; to: string; type: LeaveType }>;
  timed: Array<{ date: string; type: "half"; start: string; end: string }>;
};

type DemoRecoveryRequest = DemoRequestBase & {
  requestKind: "recovery";
  periods: Array<{ from: string; to: string; type: "recovery_day" }>;
  timed: Array<{
    date: string;
    type: Exclude<RecoveryRequestType, "recovery_day">;
    start: string;
    end: string;
  }>;
};

export type DemoCompletedRequest = DemoLeaveRequest | DemoRecoveryRequest;

type JsonRecord = Record<string, unknown>;

const leaveTypes = new Set<string>([
  "annual", "rtt", "fraction", "half", "recovery", "sick", "strike",
  "cet", "other", "childcare", "exceptional",
]);
const recoveryTimedTypes = new Set<string>([
  "recovery_half", "recovery_hours", "recovery_holiday", "recovery_training",
]);

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Lit le transfert local créé par le formulaire autonome. Même si ce
 * stockage est local, il peut être modifié depuis les outils du navigateur :
 * aucune propriété n'est donc utilisée avant validation. */
export function parseDemoCompletedRequestJson(rawJson: string | null): DemoCompletedRequest | null {
  if (!rawJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    return null;
  }
  const raw = record(parsed);
  if (!raw) return null;
  const requestId = text(raw.requestId);
  const group = Number(raw.group);
  const requestKind = raw.requestKind;
  if (!requestId || ![1, 2, 3].includes(group) ||
      (requestKind !== "leave" && requestKind !== "recovery")) return null;

  const rawProfile = record(raw.profile);
  const candidateQuota = rawProfile?.workQuota;
  const workQuota: WorkQuota =
    candidateQuota === "half" || candidateQuota === "three_quarters"
      ? candidateQuota
      : "full";
  const base = { requestId, group, profile: { workQuota } };
  const rawPeriods = Array.isArray(raw.periods) ? raw.periods : [];
  const rawTimed = Array.isArray(raw.timed) ? raw.timed : [];

  if (requestKind === "recovery") {
    const periods: DemoRecoveryRequest["periods"] = [];
    for (const candidate of rawPeriods) {
      const item = record(candidate);
      if (!item || item.type !== "recovery_day" || !validDate(item.from)) continue;
      const to = validDate(item.to) ? item.to : item.from;
      if (to < item.from) continue;
      periods.push({ from: item.from, to, type: "recovery_day" });
    }
    const timed: DemoRecoveryRequest["timed"] = [];
    for (const candidate of rawTimed) {
      const item = record(candidate);
      if (!item || !validDate(item.date) ||
          typeof item.type !== "string" || !recoveryTimedTypes.has(item.type)) continue;
      timed.push({
        date: item.date,
        type: item.type as DemoRecoveryRequest["timed"][number]["type"],
        start: text(item.start),
        end: text(item.end),
      });
    }
    return { ...base, requestKind, periods, timed };
  }

  const periods: DemoLeaveRequest["periods"] = [];
  for (const candidate of rawPeriods) {
    const item = record(candidate);
    if (!item || !validDate(item.from) ||
        typeof item.type !== "string" || !leaveTypes.has(item.type)) continue;
    const to = validDate(item.to) ? item.to : item.from;
    if (to < item.from) continue;
    periods.push({ from: item.from, to, type: item.type as LeaveType });
  }
  const timed: DemoLeaveRequest["timed"] = [];
  for (const candidate of rawTimed) {
    const item = record(candidate);
    if (!item || item.type !== "half" || !validDate(item.date)) continue;
    timed.push({
      date: item.date,
      type: "half",
      start: text(item.start),
      end: text(item.end),
    });
  }
  return { ...base, requestKind, periods, timed };
}
