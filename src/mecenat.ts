import type { WorkQuota } from "./overtime";
import {
  MECENAT_REGULATORY_RATES,
  calculateRegulatoryMecenatVacation,
} from "./mecenatRegulation";
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
