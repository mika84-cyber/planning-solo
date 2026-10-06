import type { WorkQuota } from "./overtime";
import { calculateRegulatoryMecenatVacation } from "./mecenatRegulation";
import { matchEarlyPayment } from "./earlyPayment";
export { MECENAT_REGULATORY_RATES } from "./mecenatRegulation";

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

/** Découpe une vacation aux bornes de 7 h, 22 h et minuit. La quotité est
 * acceptée explicitement pour documenter que le résultat n'en dépend jamais. */
export function calculateMecenatVacation(
  start: string,
  end: string,
  _quota: WorkQuota,
) {
  return calculateRegulatoryMecenatVacation(start, end);
}

export function mecenatForPayMonth(
  entries: MecenatEntry[],
  year: number,
  month: number,
) {
  const lines = entries
    .filter((entry) => entry.payYear === year && entry.payMonth === month)
    .sort((a, b) => `${a.date}-${a.start}-${a.id}`.localeCompare(`${b.date}-${b.start}-${b.id}`));
  return {
    lines,
    totalMinutes: lines.reduce(
      (total, entry) => total + entry.dayMinutes + entry.nightMinutes,
      0,
    ),
    grossAmountCents: lines.reduce(
      (total, entry) => total + entry.grossAmountCents,
      0,
    ),
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
  return { surplusCents, ...matchEarlyPayment(candidates, (entry) => entry.grossAmountCents, surplusCents) };
}
