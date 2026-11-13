import type { WorkQuota } from "./overtime";
import { MECENAT_NIGHT_REGULARISATION, calculateRegulatoryMecenatVacation, mecenatPayment } from "./mecenatRegulation";
import { matchEarlyPayment } from "./earlyPayment";
export { MECENAT_NIGHT_REGULARISATION, MECENAT_REGULATORY_RATES, mecenatPayment, mecenatRatesFor, mecenatRateLabels, pendingMajorationWord } from "./mecenatRegulation";

export type MecenatEntry = {
  id: string;
  date: string;
  start: string;
  end: string;
  dayMinutes: number;
  nightMinutes: number;
  grossAmountCents: number;
  payYear: number;
  payMonth: number;
  updatedAt: string;
};

/** Une date d'inscription à un mécénat, en attente : retenue, elle devient un
 *  mécénat déclaré ; sinon elle s'efface. */
export type MecenatSignup = {
  id: string;
  date: string;
  /** Les horaires prévus (« 19:00 »), ou vides si on ne les connaît pas encore. */
  start: string;
  end: string;
  updatedAt: string;
};

/** Découpe une vacation selon le barème du jour (7 h – 22 h depuis 2024). La
 * quotité est acceptée explicitement pour documenter que le résultat n'en
 * dépend jamais. */
export function calculateMecenatVacation(
  start: string,
  end: string,
  _quota: WorkQuota,
  date?: string,
) {
  return calculateRegulatoryMecenatVacation(start, end, date);
}

export function mecenatForPayMonth(
  entries: MecenatEntry[],
  year: number,
  month: number,
) {
  const lines = entries
    .filter((entry) => entry.payYear === year && entry.payMonth === month)
    .sort((a, b) => `${a.date}-${a.start}-${a.id}`.localeCompare(`${b.date}-${b.start}-${b.id}`));
  const payments = lines.map(mecenatPayment);
  return {
    lines,
    totalMinutes: lines.reduce(
      (total, entry) => total + entry.dayMinutes + entry.nightMinutes,
      0,
    ),
    /** Ce que le bulletin doit verser : le barème, moins la majoration de
     *  22 h à minuit tant qu'elle attend sa régularisation. */
    grossAmountCents: payments.reduce((total, payment) => total + payment.paidCents, 0),
    pendingCents: payments.reduce((total, payment) => total + payment.pendingCents, 0),
    pendingMinutes: payments.reduce((total, payment) => total + payment.pendingMinutes, 0),
  };
}

/** Ce que la paie verse pour ce mécénat (voir mecenatPayment). */
export function mecenatPaidCents(entry: MecenatEntry) {
  return mecenatPayment(entry).paidCents;
}

/** La majoration de 22 h à minuit des mécénats déjà faits, que la paie n'a
 *  pas encore versée : ce que la régularisation devra rattraper. Une fois
 *  versée, plus rien n'attend. */
export function pendingNightMajoration(entries: MecenatEntry[], todayKey: string) {
  const waiting = MECENAT_NIGHT_REGULARISATION.settledPayMonth ? [] : entries
    .filter((entry) => entry.date <= todayKey)
    .map((entry) => ({ entry, ...mecenatPayment(entry) }))
    .filter((item) => item.pendingCents > 0)
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  return {
    count: waiting.length,
    minutes: waiting.reduce((total, item) => total + item.pendingMinutes, 0),
    cents: waiting.reduce((total, item) => total + item.pendingCents, 0),
    firstDate: waiting.length ? waiting[0].entry.date : null as string | null,
  };
}

/**
 * Mécénats prévus sur la paie suivante qu'un bulletin a déjà payés.
 *
 * Un mécénat se paie normalement le mois d'après ; s'il tombe finalement sur
 * le bulletin du mois où il a été fait, la part de mécénat de ce bulletin
 * dépasse ce qui était attendu. On cherche alors, du plus ancien au plus
 * récent, les mécénats du mois qui expliquent ce surplus.
 */
export function mecenatsPaidEarly(
  entries: MecenatEntry[],
  year: number,
  month: number,
  bulletinCents: number,
) {
  const expectedCents = mecenatForPayMonth(entries, year, month).grossAmountCents;
  const surplusCents = bulletinCents - expectedCents;
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const candidates = entries
    .filter((entry) => entry.payYear === next.year && entry.payMonth === next.month && entry.date.slice(0, 7) <= monthKey)
    .sort((a, b) => `${a.date}-${a.start}-${a.id}`.localeCompare(`${b.date}-${b.start}-${b.id}`));
  return { surplusCents, ...matchEarlyPayment(candidates, mecenatPaidCents, surplusCents) };
}
