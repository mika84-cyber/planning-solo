/** Report des congés annuels, d'après la note « Demande de congé » : les CA
 *  (et jours spécifiques du ministère) d'une année se prennent jusqu'au
 *  30 avril de l'année suivante ; les ARTT, eux, s'arrêtent au 31 décembre.
 *
 *  Chaque jour de CA — et chaque demi-journée prise sur les CA — est rattaché
 *  à l'année dont il consomme le solde. Du 1er janvier au 30 avril, le reste
 *  de l'année précédente part en premier, puis le solde de l'année en cours.
 *  Le report ne vaut qu'à partir de 2026, première année suivie par
 *  l'application : avant, les restes sont inconnus.
 *
 *  Partagé par l'application et le serveur. */
import { addDays, dateKey, fromKey, getDayInfo, isStoredHalfBalance } from "./planningLogic";

export const FIRST_CARRY_YEAR = 2026;
/** Dernier jour (mois-jour) où les CA de l'année précédente se prennent. */
export const CARRY_DEADLINE = "04-30";

export type CarryPeriod = {
  from: string;
  to: string;
  leaveType?: string;
  halfBalance?: string;
  group: number;
};

export type AnnualCharge<P extends CarryPeriod = CarryPeriod> = {
  date: string;
  units: number;
  /** Année dont le solde de CA est décompté. */
  year: number;
  period: P;
};

function chargesAnnual(period: CarryPeriod) {
  if (period.leaveType === "annual") return true;
  return period.leaveType === "half" && !isStoredHalfBalance(period.halfBalance);
}

/** Rattache chaque jour de CA à son année de solde. `available(year)` donne
 *  les CA d'une année encore libres avant tout jour daté (droits moins les
 *  jours saisis sans date). */
export function annualCharges<P extends CarryPeriod>(periods: readonly P[], available: (year: number) => number) {
  const days: Array<{ date: string; units: number; period: P }> = [];
  const seen = new Set<string>();
  for (const period of periods) {
    if (!chargesAnnual(period) || !period.from || !period.to) continue;
    const units = period.leaveType === "half" ? 0.5 : 1;
    for (let date = fromKey(period.from); dateKey(date) <= period.to; date = addDays(date, 1)) {
      const key = dateKey(date);
      const info = getDayInfo(date, period.group);
      if (info.holiday || info.kind === "off") continue;
      const unique = `${key}:${units}`;
      if (seen.has(unique)) continue;
      seen.add(unique);
      days.push({ date: key, units, period });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  const charged = new Map<number, number>();
  const remaining = (year: number) => available(year) - (charged.get(year) || 0);
  const charges: AnnualCharge<P>[] = [];
  const charge = (day: (typeof days)[number], year: number, units: number) => {
    charged.set(year, (charged.get(year) || 0) + units);
    charges.push({ date: day.date, units, year, period: day.period });
  };
  for (const day of days) {
    const year = Number(day.date.slice(0, 4));
    const previous = year - 1;
    const carry = previous >= FIRST_CARRY_YEAR && day.date.slice(5) <= CARRY_DEADLINE
      ? Math.max(0, remaining(previous))
      : 0;
    const fromCarry = Math.min(carry, day.units);
    if (fromCarry > 0) charge(day, previous, fromCarry);
    if (day.units - fromCarry > 0) charge(day, year, day.units - fromCarry);
  }
  return { charges, charged };
}
