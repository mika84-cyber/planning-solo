/** Tarifs réglementaires des manifestations au profit de tiers. */
export const MECENAT_REGULATORY_RATES = {
  effectiveFrom: "2024-01-01",
  dayStartMinutes: 7 * 60,
  nightStartMinutes: 22 * 60,
  dayRateCents: 2290,
  nightRateCents: 3500,
} as const;

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isDayMinute(minute: number) {
  const clock = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
  return (
    clock >= MECENAT_REGULATORY_RATES.dayStartMinutes &&
    clock < MECENAT_REGULATORY_RATES.nightStartMinutes
  );
}

/** Découpe une vacation aux bornes de 7 h, 22 h et minuit. */
export function calculateRegulatoryMecenatVacation(start: string, end: string) {
  const from = clockMinutes(start);
  const rawTo = clockMinutes(end);
  if (from === null || rawTo === null || rawTo === from) return null;
  const to = rawTo <= from ? rawTo + 24 * 60 : rawTo;
  if (to - from > 24 * 60) return null;

  let dayMinutes = 0;
  let nightMinutes = 0;
  for (let minute = from; minute < to; minute++) {
    if (isDayMinute(minute)) dayMinutes++;
    else nightMinutes++;
  }
  return {
    minutes: to - from,
    dayMinutes,
    nightMinutes,
    grossAmountCents: Math.round(
      (dayMinutes / 60) * MECENAT_REGULATORY_RATES.dayRateCents +
        (nightMinutes / 60) * MECENAT_REGULATORY_RATES.nightRateCents,
    ),
  };
}
