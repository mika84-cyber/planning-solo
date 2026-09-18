import type { LeavePeriod } from "./appModel";
import { rangeKeys } from "./appModel";
import {
  deductionSlices,
  type DeductionPayMonths,
  type DeductionSlice,
} from "./deductionPayMonth";
import { groupConsecutive, sickLeaveDeduction } from "./planningLogic";

/** Une tranche d'arrêt et ce qu'elle retient sur la paie qui la porte. */
export type SickDeductionSource = {
  slice: DeductionSlice;
  amount: number;
};

export type SickPayMonth = {
  days: number;
  total: number;
  sources: SickDeductionSource[];
};

/** Tous les jours d'arrêt maladie enregistrés, sans doublon. */
export function sickLeaveDates(periods: LeavePeriod[]) {
  const sickDays = new Set<string>();
  for (const period of periods) {
    if (period.leaveType !== "sick") continue;
    for (const key of rangeKeys(period.from, period.to)) sickDays.add(key);
  }
  return sickDays;
}

/** Arrêts d'une année et retenues de chacune de ses paies.
 *
 *  Les arrêts (`arrets`, `days`, `total`) restent comptés à leurs dates : ils
 *  décrivent l'année vécue. Les paies (`byMonth`) suivent la règle du 10 (voir
 *  deductionPayMonth.ts) : la paie de janvier peut donc porter un arrêt de
 *  décembre, et celle de décembre en laisser un à janvier suivant. */
export function sickLeaveSummaryForYear(
  periods: LeavePeriod[],
  year: number,
  baseSalary: number,
  ifse: number,
  carenceDay: number,
  payMonths: DeductionPayMonths = {},
) {
  const yearText = String(year);
  const sickDays = sickLeaveDates(periods);
  const episodes = groupConsecutive([...sickDays]);
  const perDay = sickLeaveDeduction(2, baseSalary, ifse, carenceDay).perDay;
  // La carence tombe sur le premier jour de l'arrêt, les autres jours
  // retiennent le montant journalier.
  const amountByDate = new Map<string, number>();
  for (const episode of episodes)
    for (const key of rangeKeys(episode.from, episode.to))
      amountByDate.set(key, key === episode.from ? carenceDay : perDay);

  const byMonth: SickPayMonth[] = Array.from({ length: 12 }, () => ({ days: 0, total: 0, sources: [] }));
  for (const slice of deductionSlices("sick", sickDays, payMonths)) {
    if (!slice.payMonth.startsWith(`${yearText}-`)) continue;
    const slot = byMonth[Number(slice.payMonth.slice(5, 7)) - 1];
    const amount = slice.dates.reduce((sum, key) => sum + (amountByDate.get(key) || 0), 0);
    slot.days += slice.dates.length;
    slot.total += amount;
    slot.sources.push({ slice, amount });
  }

  const arrets = episodes.flatMap((episode) => {
    const allDays = rangeKeys(episode.from, episode.to);
    const displayedDays = allDays.filter((key) => key.startsWith(`${yearText}-`));
    if (!displayedDays.length) return [];
    let carence = 0;
    let reducedDays = 0;
    let reduction = 0;
    for (const key of displayedDays) {
      if (key === episode.from) {
        carence += carenceDay;
      } else {
        reducedDays += 1;
        reduction += perDay;
      }
    }
    return [{
      id: episode.from,
      from: episode.from,
      to: episode.to,
      days: displayedDays.length,
      carence,
      reducedDays,
      perDay,
      reduction,
      total: carence + reduction,
    }];
  }).sort((a, b) => a.from.localeCompare(b.from));

  return {
    arrets,
    byMonth,
    days: arrets.reduce((total, episode) => total + episode.days, 0),
    total: arrets.reduce((total, episode) => total + episode.total, 0),
  };
}
