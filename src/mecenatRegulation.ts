/** Barème des manifestations au profit de tiers (mécénats), d'après le
 *  décret n° 2010-147 du 15 février 2010 et son arrêté d'application du
 *  18 mai 2010, modifié en 2018 puis en 2023. Le taux est le même pour toutes
 *  les catégories de personnels et ne dépend pas de la quotité. */
export type MecenatRates = {
  effectiveFrom: string;
  source: string;
  dayStartMinutes: number;
  /** Fin du taux de base : 22 h depuis 2024, minuit auparavant. */
  nightStartMinutes: number;
  dayRateCents: number;
  nightRateCents: number;
};

/** Du plus récent au plus ancien. */
export const MECENAT_RATE_HISTORY: readonly MecenatRates[] = [
  {
    // Arrêté du 15 décembre 2023, JO du 31 décembre 2023, en vigueur le 1er janvier 2024.
    effectiveFrom: "2024-01-01",
    source: "arrêté du 15 décembre 2023",
    dayStartMinutes: 7 * 60,
    nightStartMinutes: 22 * 60,
    dayRateCents: 2290,
    nightRateCents: 3500,
  },
  {
    // Arrêté du 21 décembre 2018, JO du 16 mars 2019 : en vigueur le lendemain.
    effectiveFrom: "2019-03-17",
    source: "arrêté du 21 décembre 2018",
    dayStartMinutes: 7 * 60,
    nightStartMinutes: 24 * 60,
    dayRateCents: 2290,
    nightRateCents: 3500,
  },
  {
    // Arrêté du 18 mai 2010 : de la fermeture au public à minuit, puis de minuit à 7 h.
    effectiveFrom: "2010-01-01",
    source: "arrêté du 18 mai 2010",
    dayStartMinutes: 7 * 60,
    nightStartMinutes: 24 * 60,
    dayRateCents: 2200,
    nightRateCents: 3360,
  },
];

/** Barème en vigueur aujourd'hui. */
export const MECENAT_REGULATORY_RATES = MECENAT_RATE_HISTORY[0];

/** Barème applicable à une vacation commencée ce jour-là ; sans date valide,
 *  le barème en vigueur. */
export function mecenatRatesFor(date?: string): MecenatRates {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return MECENAT_REGULATORY_RATES;
  return MECENAT_RATE_HISTORY.find((rates) => date >= rates.effectiveFrom)
    ?? MECENAT_RATE_HISTORY[MECENAT_RATE_HISTORY.length - 1];
}

function hourLabel(minutes: number) {
  return minutes % (24 * 60) === 0 ? "minuit" : `${minutes / 60} h`;
}

/** Libellés des deux plages, tels que l'arrêté les écrit : « De 7 h à 22 h ». */
export function mecenatRateLabels(rates: MecenatRates = MECENAT_REGULATORY_RATES) {
  const start = hourLabel(rates.dayStartMinutes);
  const night = hourLabel(rates.nightStartMinutes);
  return {
    day: `De ${start} à ${night}`,
    night: `De ${night} à ${start}`,
  };
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isDayMinute(minute: number, rates: MecenatRates) {
  const clock = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
  return clock >= rates.dayStartMinutes && clock < rates.nightStartMinutes;
}

/** Découpe une vacation entre le taux de base et le taux majoré, selon le
 *  barème du jour où elle commence ; une fin plus tôt que le début passe au
 *  lendemain. */
export function calculateRegulatoryMecenatVacation(start: string, end: string, date?: string) {
  const from = clockMinutes(start);
  const rawTo = clockMinutes(end);
  if (from === null || rawTo === null || rawTo === from) return null;
  const to = rawTo <= from ? rawTo + 24 * 60 : rawTo;
  if (to - from > 24 * 60) return null;

  const rates = mecenatRatesFor(date);
  let dayMinutes = 0;
  let nightMinutes = 0;
  for (let minute = from; minute < to; minute++) {
    if (isDayMinute(minute, rates)) dayMinutes++;
    else nightMinutes++;
  }
  return {
    minutes: to - from,
    dayMinutes,
    nightMinutes,
    grossAmountCents: Math.round(
      (dayMinutes / 60) * rates.dayRateCents +
        (nightMinutes / 60) * rates.nightRateCents,
    ),
  };
}
