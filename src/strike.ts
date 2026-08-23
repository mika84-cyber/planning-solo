import {
  rangeKeys,
  type Entries,
  type LeavePeriod,
  type PayProfile,
} from "./appModel";
import type { RecoveryUse } from "./overtime";
import { dateKey, fromKey, getDayInfo } from "./planningLogic";

export type StrikeIntermediateKind =
  | "annual"
  | "rtt"
  | "recovery"
  | "cycle-rest"
  | "weekend-rest"
  | "holiday"
  | "other-leave"
  | "training"
  | "work";

export type StrikeIntermediateDay = {
  date: string;
  kind: StrikeIntermediateKind;
  label: string;
};

export type StrikeContinuityInterval = {
  fromStrike: string;
  toStrike: string;
  status:
    | "protected-annual"
    | "confirmed-cycle-rest"
    | "ambiguous"
    | "service-break";
  days: StrikeIntermediateDay[];
};

export type StrikePayEstimate = {
  /** Journées que l'utilisatrice a explicitement enregistrées comme grève. */
  days: string[];
  dailyDeduction: number | null;
  /** Retenue intégrée à la paie : grèves explicites et repos noirs encadrés. */
  totalDeduction: number | null;
  /** Repos noirs compris entre deux grèves, automatiquement retenus au 1/30. */
  automaticAdditionalDays: string[];
  /** Jours intermédiaires non déduits automatiquement, à faire vérifier. */
  potentialAdditionalDays: string[];
  potentialAdditionalDeduction: number | null;
  maximumDeductionIfContinuous: number | null;
  continuityIntervals: StrikeContinuityInterval[];
  sourcePeriod: string | null;
  exactMonthValues: boolean;
};

export type StrikeContinuityContext = {
  entries?: Entries;
  recoveryUses?: RecoveryUse[];
};

function profilePeriod(key: string) {
  if (/^\d{4}-\d{2}$/.test(key)) return key;
  if (/^\d{4}$/.test(key)) return `${key}-01`;
  return null;
}

/** Dernières valeurs connues à la date du mois visé. Les champs sont cherchés
 * séparément afin qu'une indemnité de résidence inchangée puisse venir d'un
 * bulletin antérieur au dernier changement de traitement. */
export function latestStrikePayValues(
  profiles: Record<string, PayProfile>,
  year: number,
  month: number,
) {
  const target = `${year}-${String(month + 1).padStart(2, "0")}`;
  const candidates = Object.entries(profiles)
    .map(([key, profile]) => ({ period: profilePeriod(key), profile }))
    .filter((item): item is { period: string; profile: PayProfile } =>
      Boolean(item.period && item.period <= target),
    )
    .sort((a, b) => b.period.localeCompare(a.period));
  const base = candidates.find((item) => item.profile.baseSalary !== undefined);
  const residence = candidates.find(
    (item) => item.profile.residenceAllowance !== undefined,
  );
  return {
    baseSalary: base?.profile.baseSalary,
    residenceAllowance: residence?.profile.residenceAllowance,
    baseSourcePeriod: base?.period || null,
    residenceSourcePeriod: residence?.period || null,
    sourcePeriod:
      base && residence
        ? base.period > residence.period
          ? base.period
          : residence.period
        : null,
    exactMonthValues: base?.period === target && residence?.period === target,
  };
}

export function strikeDates(
  periods: LeavePeriod[],
  group: number,
) {
  const dates = new Set<string>();
  for (const period of periods) {
    if (period.leaveType !== "strike") continue;
    for (const key of rangeKeys(period.from, period.to)) {
      if (getDayInfo(fromKey(key), period.group || group).kind !== "work")
        continue;
      dates.add(dateKey(fromKey(key)));
    }
  }
  return [...dates].sort();
}

export function strikeDatesForMonth(
  periods: LeavePeriod[],
  group: number,
  year: number,
  month: number,
) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  return strikeDates(periods, group).filter((date) => date.startsWith(prefix));
}

function periodLabel(type: LeavePeriod["leaveType"]) {
  if (type === "fraction") return "Jour de fractionnement";
  if (type === "childcare") return "Congé garde d’enfant";
  if (type === "exceptional") return "Jour exceptionnel";
  if (type === "sick") return "Arrêt maladie";
  if (type === "cet") return "Congé CET";
  if (type === "other") return "Divers";
  if (type === "half") return "Demi-journée de congé";
  return "Autre absence";
}

export function strikeIntermediateDay(
  key: string,
  periods: LeavePeriod[],
  group: number,
  context: StrikeContinuityContext = {},
): StrikeIntermediateDay {
  const leave = periods.find(
    (period) =>
      period.leaveType !== "strike" && key >= period.from && key <= period.to,
  );
  if (leave?.leaveType === "annual")
    return { date: key, kind: "annual", label: "CA validé" };
  if (leave?.leaveType === "rtt")
    return { date: key, kind: "rtt", label: "RTT — à vérifier" };
  if (leave)
    return {
      date: key,
      kind: "other-leave",
      label: `${periodLabel(leave.leaveType)} — à vérifier`,
    };
  if (context.recoveryUses?.some((item) => item.date === key))
    return { date: key, kind: "recovery", label: "Récupération — à vérifier" };
  if (context.entries?.[key]?.leave)
    return { date: key, kind: "other-leave", label: "Autre absence — à vérifier" };

  const date = fromKey(key);
  const info = getDayInfo(date, group);
  if (info.holiday)
    return {
      date: key,
      kind: "holiday",
      label: `${info.holiday} — à vérifier`,
    };
  if (info.kind === "off")
    return date.getDay() === 0 || date.getDay() === 6
      ? { date: key, kind: "weekend-rest", label: "Repos du cycle (week-end)" }
      : { date: key, kind: "cycle-rest", label: "Repos du cycle" };
  if (info.kind === "training")
    return { date: key, kind: "training", label: "Formation effectuée" };
  return { date: key, kind: "work", label: "Travail effectué" };
}

export function strikeContinuityIntervals(
  periods: LeavePeriod[],
  group: number,
  context: StrikeContinuityContext = {},
) {
  const dates = strikeDates(periods, group);
  const intervals: StrikeContinuityInterval[] = [];
  for (let index = 1; index < dates.length; index += 1) {
    const fromStrike = dates[index - 1];
    const toStrike = dates[index];
    const between = rangeKeys(fromStrike, toStrike).slice(1, -1);
    if (!between.length) continue;
    const days = between.map((key) =>
      strikeIntermediateDay(key, periods, group, context),
    );
    const status = days.some((day) => day.kind === "annual")
      ? "protected-annual"
      : days.some((day) => day.kind === "work" || day.kind === "training")
        ? "service-break"
        : days.every(
              (day) =>
                day.kind === "cycle-rest" || day.kind === "weekend-rest",
            )
          ? "confirmed-cycle-rest"
          : "ambiguous";
    intervals.push({ fromStrike, toStrike, status, days });
  }
  return intervals;
}

export function strikePayEstimate(
  periods: LeavePeriod[],
  group: number,
  profiles: Record<string, PayProfile>,
  year: number,
  month: number,
  context: StrikeContinuityContext = {},
): StrikePayEstimate {
  const days = strikeDatesForMonth(periods, group, year, month);
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const continuityIntervals = strikeContinuityIntervals(
    periods,
    group,
    context,
  ).filter((interval) =>
    interval.days.some((day) => day.date.startsWith(prefix)) ||
    interval.fromStrike.startsWith(prefix) ||
    interval.toStrike.startsWith(prefix),
  );
  const potentialAdditionalDays = [
    ...new Set(
      continuityIntervals
        .filter((interval) => interval.status === "ambiguous")
        .flatMap((interval) => interval.days)
        .map((day) => day.date)
        .filter((date) => date.startsWith(prefix)),
    ),
  ].sort();
  const automaticAdditionalDays = [
    ...new Set(
      continuityIntervals
        .filter((interval) => interval.status === "confirmed-cycle-rest")
        .flatMap((interval) => interval.days)
        .map((day) => day.date)
        .filter((date) => date.startsWith(prefix)),
    ),
  ].sort();
  const values = latestStrikePayValues(profiles, year, month);
  if (
    values.baseSalary === undefined ||
    values.residenceAllowance === undefined
  )
    return {
      days,
      dailyDeduction: null,
      totalDeduction: null,
      automaticAdditionalDays,
      potentialAdditionalDays,
      potentialAdditionalDeduction: null,
      maximumDeductionIfContinuous: null,
      continuityIntervals,
      sourcePeriod: null,
      exactMonthValues: false,
    };
  const dailyDeduction =
    Math.round(((values.baseSalary + values.residenceAllowance) / 30) * 100) /
    100;
  return {
    days,
    dailyDeduction,
    totalDeduction:
      Math.round(
        dailyDeduction * (days.length + automaticAdditionalDays.length) * 100,
      ) / 100,
    automaticAdditionalDays,
    potentialAdditionalDays,
    potentialAdditionalDeduction:
      Math.round(dailyDeduction * potentialAdditionalDays.length * 100) / 100,
    maximumDeductionIfContinuous:
      Math.round(
        dailyDeduction *
          (days.length +
            automaticAdditionalDays.length +
            potentialAdditionalDays.length) *
          100,
      ) / 100,
    continuityIntervals,
    sourcePeriod: values.sourcePeriod,
    exactMonthValues: values.exactMonthValues,
  };
}
