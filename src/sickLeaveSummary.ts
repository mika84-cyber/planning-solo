import type { LeavePeriod } from "./appModel";
import { rangeKeys } from "./appModel";
import {
  deductionSlices,
  type DeductionPayMonths,
  type DeductionSlice,
} from "./deductionPayMonth";
import {
  SICK_FULL_PAY_DAYS,
  SICK_HALF_PAY_RATE,
  groupConsecutive,
  sickLeaveDeduction,
} from "./planningLogic";

/** Une tranche d'arrêt et ce qu'elle retient sur la paie qui la porte. */
export type SickDeductionSource = {
  slice: DeductionSlice;
  amount: number;
};

export type SickPayMonth = {
  days: number;
  /** Jours retenus à demi-traitement, au-delà des trois premiers mois. */
  halfPayDays: number;
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

/** Le même jour un an plus tôt (« AAAA-MM-JJ ») ; un 29 février devient le
 *  28. */
function oneYearBefore(key: string) {
  const monthDay = key.slice(5) === "02-29" ? "02-28" : key.slice(5);
  return `${Number(key.slice(0, 4)) - 1}-${monthDay}`;
}

/** Les jours d'arrêt payés à demi-traitement : ceux qui suivent déjà trois
 *  mois (90 jours) d'arrêt dans les douze mois qui les précèdent. Le compte
 *  glisse jour après jour, arrêts précédents compris. */
export function sickHalfPayDates(sickDays: Set<string>) {
  const dates = [...sickDays].sort();
  const halfPay = new Set<string>();
  let windowStart = 0;
  dates.forEach((date, index) => {
    const limit = oneYearBefore(date);
    while (dates[windowStart] <= limit) windowStart += 1;
    if (index - windowStart >= SICK_FULL_PAY_DAYS) halfPay.add(date);
  });
  return halfPay;
}

/** Arrêts d'une année et retenues de chacune de ses paies.
 *
 *  Les arrêts (`arrets`, `days`, `total`) restent comptés à leurs dates : ils
 *  décrivent l'année vécue. Les paies (`byMonth`) suivent la règle du 10 (voir
 *  deductionPayMonth.ts) : la paie de janvier peut donc porter un arrêt de
 *  décembre, et celle de décembre en laisser un à janvier suivant.
 *
 *  Chaque jour suivant la carence retient 10 % de sa valeur, puis 50 % une
 *  fois trois mois d'arrêt atteints sur douze mois glissants. */
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
  const halfPayDates = sickHalfPayDates(sickDays);
  const perDay = sickLeaveDeduction(2, baseSalary, ifse, carenceDay).perDay;
  const halfPayPerDay = ((baseSalary + ifse) * SICK_HALF_PAY_RATE) / 30;
  // La carence tombe sur le premier jour de l'arrêt, les autres jours
  // retiennent le montant journalier.
  const amountByDate = new Map<string, number>();
  const halfPaid = new Set<string>();
  for (const episode of episodes)
    for (const key of rangeKeys(episode.from, episode.to)) {
      if (key === episode.from) amountByDate.set(key, carenceDay);
      else if (halfPayDates.has(key)) {
        amountByDate.set(key, halfPayPerDay);
        halfPaid.add(key);
      } else amountByDate.set(key, perDay);
    }

  const byMonth: SickPayMonth[] = Array.from({ length: 12 }, () => ({ days: 0, halfPayDays: 0, total: 0, sources: [] }));
  for (const slice of deductionSlices("sick", sickDays, payMonths)) {
    if (!slice.payMonth.startsWith(`${yearText}-`)) continue;
    const slot = byMonth[Number(slice.payMonth.slice(5, 7)) - 1];
    const amount = slice.dates.reduce((sum, key) => sum + (amountByDate.get(key) || 0), 0);
    slot.days += slice.dates.length;
    slot.halfPayDays += slice.dates.filter((key) => halfPaid.has(key)).length;
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
    let halfPayDays = 0;
    let halfPayReduction = 0;
    for (const key of displayedDays) {
      if (key === episode.from) {
        carence += carenceDay;
      } else if (halfPaid.has(key)) {
        halfPayDays += 1;
        halfPayReduction += halfPayPerDay;
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
      halfPayDays,
      halfPayPerDay,
      halfPayReduction,
      total: carence + reduction + halfPayReduction,
    }];
  }).sort((a, b) => a.from.localeCompare(b.from));

  return {
    arrets,
    byMonth,
    days: arrets.reduce((total, episode) => total + episode.days, 0),
    total: arrets.reduce((total, episode) => total + episode.total, 0),
  };
}
