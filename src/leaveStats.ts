import { EMPTY_MANUAL_ADJUSTMENTS } from "./payAllowances";
import { annualCharges, CARRY_DEADLINE, FIRST_CARRY_YEAR } from "./annualCarryOver";
import { fractionAllowance, isOffSeasonDate } from "./fractionRules";
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
    // Les CA suivent le report jusqu'au 30 avril : décomptés plus bas.
    if (category === "annual") continue;
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
  // Congés annuels : les restes d'une année se prennent jusqu'au 30 avril
  // suivant, avant ceux de l'année en cours. Chaque jour est décompté sur
  // l'année dont il consomme le solde.
  const annualAvailable = (target: number) =>
    LEAVE_ALLOWANCES.annual -
    (manualAdjustments?.[String(target)] ?? EMPTY_MANUAL_ADJUSTMENTS).annualUsed;
  const { charges, charged } = annualCharges(
    periods.map((period) => ({ ...period, group: period.group || group })),
    annualAvailable,
  );
  for (const charge of charges) {
    if (charge.year !== year) continue;
    used.annual += charge.units;
    details.annual.push({ date: charge.date, units: charge.units, period: charge.period });
  }
  const unitsOf = (target: number, dateYear: number) =>
    charges
      .filter((charge) => charge.year === target && charge.date.startsWith(`${dateYear}-`))
      .reduce((sum, charge) => sum + charge.units, 0);
  const annualCarry = {
    /** Reste des CA de l'année précédente, à prendre avant le 30 avril. */
    fromPrevious: year - 1 >= FIRST_CARRY_YEAR
      ? {
          year: year - 1,
          used: unitsOf(year - 1, year),
          remaining: Math.max(0, annualAvailable(year - 1) - (charged.get(year - 1) || 0)),
          deadline: `${year}-${CARRY_DEADLINE}`,
        }
      : null,
    /** CA de l'année déjà posés du 1er janvier au 30 avril suivant. */
    intoNext: year >= FIRST_CARRY_YEAR ? unitsOf(year, year + 1) : 0,
    deadline: `${year + 1}-${CARRY_DEADLINE}`,
  };
  // Dès 2027, le fractionnement se gagne avec les CA posés hors mai–octobre
  // (les demi-journées comptent pour moitié) ; les CA saisis sans date n'y
  // entrent pas, faute de savoir quand ils ont été pris.
  const offSeasonDays = details.annual
    .filter((detail) => isOffSeasonDate(detail.date))
    .reduce((sum, detail) => sum + detail.units, 0);
  const allowances: Record<BalanceType, number> = {
    annual: LEAVE_ALLOWANCES.annual,
    rtt: LEAVE_ALLOWANCES.rtt,
    fraction: fractionAllowance(year, offSeasonDays),
  };
  return {
    annualCarry,
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
