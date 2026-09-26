import { EMPTY_MANUAL_ADJUSTMENTS } from "./payAllowances";
import {
  type FractionCategory,
  fractionAllowance,
  isOffSeasonDate,
  nextFractionStep,
  usesFractionRule,
} from "./fractionRules";
import type { BalanceType, LeavePeriod, ManualYearAdjustments } from "./appModel";
import {
  COUNTED_ONLY_TYPES,
  LEAVE_ALLOWANCES,
  addDays,
  dateKey,
  fromKey,
  getDayInfo,
  halfBalanceOf,
  type CountedOnlyType,
} from "./planningLogic";

export type LeaveStatsInput = {
  year: number;
  today: Date;
  periods: LeavePeriod[];
  group: number;
  manualAdjustments: Record<string, ManualYearAdjustments> | undefined;
  /** Catégorie de l'agent, qui fixe les seuils du fractionnement dès 2027. */
  fractionCategory?: FractionCategory;
};

/** Soldes de congés d'une année et suivis sans droit à consommer.
 *
 *  Les jours fériés et les jours non travaillés du cycle ne sont jamais
 *  déduits, et une même date ne peut être comptée deux fois pour un même
 *  type, même si deux périodes se recouvrent.
 */
export function computeLeaveStats({
  year,
  today,
  periods,
  group,
  manualAdjustments,
  fractionCategory,
}: LeaveStatsInput) {
  const todayKey = dateKey(today);
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  const counted = new Set<string>();
  const manual =
    manualAdjustments?.[String(year)] ??
    EMPTY_MANUAL_ADJUSTMENTS;
  const used: Record<BalanceType, number> = {
    annual: manual.annualUsed,
    rtt: manual.rttUsed,
    fraction: manual.fractionUsed,
  };
  const details: Record<
    BalanceType,
    Array<{ date: string; units: number; period: LeavePeriod }>
  > = {
    annual: [],
    rtt: [],
    fraction: [],
  };
  // Suivis à part : comptés, mais sans droit à consommer.
  const countedOnly: Record<
    CountedOnlyType,
    { used: number; details: Array<{ date: string; units: number; period: LeavePeriod }> }
  > = {
    sick: { used: 0, details: [] },
    strike: { used: 0, details: [] },
    childcare: { used: 0, details: [] },
    exceptional: { used: 0, details: [] },
    other: { used: 0, details: [] },
    cet: { used: 0, details: [] },
    work_accident: { used: 0, details: [] },
  };
  for (const period of periods) {
    if (
      !period.leaveType ||
      period.to < first ||
      period.from > last
    )
      continue;
    // Une récupération rend des heures déjà travaillées : rien n'est déduit,
    // et elle n'alimente aucun compteur non plus.
    if (period.leaveType === "recovery")
      continue;
    const countedType = COUNTED_ONLY_TYPES.includes(
      period.leaveType as CountedOnlyType,
    )
      ? (period.leaveType as CountedOnlyType)
      : null;
    // Une demi-journée est prise sur le solde choisi, CA par défaut.
    const category =
      period.leaveType === "half" ? halfBalanceOf(period) : period.leaveType;
    const units = period.leaveType === "half" ? 0.5 : 1;
    const from = period.from < first ? first : period.from;
    const to = period.to > last ? last : period.to;
    for (
      let date = fromKey(from);
      dateKey(date) <= to;
      date = addDays(date, 1)
    ) {
      const key = dateKey(date);
      const info = getDayInfo(date, period.group || group);
      if (info.holiday || info.kind === "off") continue;
      const countKey = `${category}:${key}:${units}`;
      if (counted.has(countKey)) continue;
      counted.add(countKey);
      if (countedType) {
        countedOnly[countedType].used += units;
        countedOnly[countedType].details.push({ date: key, units, period });
        continue;
      }
      used[category as BalanceType] += units;
      details[category as BalanceType].push({ date: key, units, period });
    }
  }
  // Dès 2027, le fractionnement se gagne avec les CA posés hors mai–octobre
  // (les demi-journées comptent pour moitié) ; les CA saisis sans date n'y
  // entrent pas, faute de savoir quand ils ont été pris.
  const offSeasonDays = details.annual
    .filter((detail) => isOffSeasonDate(detail.date))
    .reduce((sum, detail) => sum + detail.units, 0);
  const allowances: Record<BalanceType, number> = {
    annual: LEAVE_ALLOWANCES.annual,
    rtt: LEAVE_ALLOWANCES.rtt,
    fraction: fractionAllowance(year, fractionCategory, offSeasonDays),
  };
  return {
    fractionRule: usesFractionRule(year)
      ? { offSeasonDays, next: nextFractionStep(year, fractionCategory, offSeasonDays) }
      : null,
    balances: (["annual", "rtt", "fraction"] as const).map((type) => {
      const manualUsed = manual[`${type}Used` as "annualUsed" | "rttUsed" | "fractionUsed"];
      const sortedDetails = details[type].sort((a, b) => a.date.localeCompare(b.date));
      return {
        type,
        allowance: allowances[type],
        manualUsed,
        used: used[type],
        taken: manualUsed + sortedDetails.filter((detail) => detail.date <= todayKey).reduce((sum, detail) => sum + detail.units, 0),
        upcoming: sortedDetails.filter((detail) => detail.date > todayKey).reduce((sum, detail) => sum + detail.units, 0),
        remaining: allowances[type] - used[type],
        details: sortedDetails,
      };
    }),
    countedOnly,
  };
}
