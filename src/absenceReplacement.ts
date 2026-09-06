import type { LeavePeriod } from "./appModel";
import { rangeKeys } from "./appModel";
import { createClientId } from "./clientId";
import { groupConsecutive, type LeaveType } from "./planningLogic";

export type AbsenceReplacementInput = {
  id: string;
  from: string;
  to: string;
  leaveType: "sick" | "work_accident";
  group: number;
};

const AUTOMATICALLY_REFUNDED_TYPES = new Set<LeaveType>([
  "annual",
  "half",
]);

/** Ces congés peuvent rester enregistrés sous une maladie ou un accident.
 * Leur éventuelle restitution reste une décision manuelle tant que la règle
 * RH n'est pas confirmée. */
const COEXISTING_LEAVE_TYPES = new Set<LeaveType>([
  "annual",
  "rtt",
  "fraction",
  "half",
  "cet",
  "childcare",
  "exceptional",
]);

type PrepareOptions = {
  periods: LeavePeriod[];
  replacements: AbsenceReplacementInput[];
  nowIso?: string;
  createId?: (prefix: string) => string;
};

/**
 * Prépare un remplacement atomique : seuls les CA entiers ou en demi-journée
 * qui recouvrent une maladie ou un accident du travail sont découpés autour
 * des dates concernées.
 * Leur disparition du planning recrédite naturellement les compteurs calculés
 * à partir des périodes restantes.
 */
export function prepareAbsenceReplacement({
  periods,
  replacements,
  nowIso = new Date().toISOString(),
  createId = createClientId,
}: PrepareOptions) {
  const replacedDates = new Set(
    replacements.flatMap((replacement) => rangeKeys(replacement.from, replacement.to)),
  );
  const overlaps = (period: LeavePeriod) =>
    rangeKeys(period.from, period.to).some((date) => replacedDates.has(date));
  const conflict = periods.find(
    (period) => overlaps(period) && !COEXISTING_LEAVE_TYPES.has(period.leaveType as LeaveType),
  );
  if (conflict) {
    return { conflict, refunded: false, operations: [], nextPeriods: periods };
  }

  const operations: Array<Record<string, unknown>> = [];
  const nextPeriods: LeavePeriod[] = [];
  let refunded = false;

  for (const period of periods) {
    const dates = rangeKeys(period.from, period.to);
    const removed = dates.filter((date) => replacedDates.has(date));
    if (!removed.length || !AUTOMATICALLY_REFUNDED_TYPES.has(period.leaveType as LeaveType)) {
      nextPeriods.push(period);
      continue;
    }
    refunded = true;
    if (period.legacy) {
      for (const segment of groupConsecutive(removed)) {
        operations.push({
          action: "clear-legacy-period",
          from: segment.from,
          to: segment.to,
        });
      }
    } else {
      operations.push({
        action: "delete-period",
        id: period.id,
        expectedUpdatedAt: period.updatedAt,
      });
    }
    const remaining = dates.filter((date) => !replacedDates.has(date));
    for (const segment of groupConsecutive(remaining)) {
      const saved: LeavePeriod = {
        ...period,
        id: createId("period"),
        from: segment.from,
        to: segment.to,
        updatedAt: nowIso,
      };
      nextPeriods.push(saved);
      if (!period.legacy) {
        operations.push({
          action: "save-period",
          id: saved.id,
          from: saved.from,
          to: saved.to,
          leaveType: saved.leaveType || "annual",
          halfMoment: saved.leaveType === "half" ? saved.halfMoment || "" : "",
          group: saved.group,
        });
      }
    }
  }

  for (const replacement of replacements) {
    operations.push({ action: "save-period", ...replacement });
    nextPeriods.push({
      ...replacement,
      halfMoment: "",
      updatedAt: nowIso,
    });
  }

  nextPeriods.sort((left, right) => left.from.localeCompare(right.from));
  return { conflict: undefined, refunded, operations, nextPeriods };
}

/** L'absence médicale doit rester visible même lorsqu'un autre congé demeure
 * enregistré sur la même date. */
export function visibleAbsencePeriod(periods: LeavePeriod[], date: string) {
  return periods.find(
    (period) =>
      date >= period.from &&
      date <= period.to &&
      (period.leaveType === "work_accident" || period.leaveType === "sick"),
  ) || periods.find((period) => date >= period.from && date <= period.to);
}
