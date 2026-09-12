export type WorkQuota = "full" | "three_quarters" | "half";
export type WorkSchedule = {
  start: string;
  end: string;
};

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  start: "09:15",
  end: "17:30",
};

export function workScheduleHalfTimes(
  schedule: WorkSchedule,
  moment: "morning" | "afternoon",
) {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const fromMinutes = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  const midpoint = Math.round(((start + end) / 2) / 15) * 15;
  return moment === "morning"
    ? { start: schedule.start, end: fromMinutes(midpoint) }
    : { start: fromMinutes(midpoint), end: schedule.end };
}
export type OvertimeDisposition = "paid" | "recovery";
export type OvertimeInputMode = "range" | "duration";
export type OvertimePeriod = "day" | "night";
export type RecoveryRequestType =
  | "recovery_day"
  | "recovery_half"
  | "recovery_hours"
  | "recovery_holiday"
  | "recovery_training";

export type OvertimeEntry = {
  id: string;
  date: string;
  minutes: number;
  dayMinutes: number;
  nightMinutes: number;
  disposition: OvertimeDisposition;
  inputMode: OvertimeInputMode;
  start?: string;
  end?: string;
  updatedAt: string;
};

export type RecoveryUse = {
  id: string;
  date: string;
  minutes: number;
  start?: string;
  end?: string;
  kind?: "training";
  updatedAt: string;
};

export const WORK_QUOTA_OPTIONS: Array<{
  value: WorkQuota;
  label: string;
  dailyMinutes: number;
}> = [
  { value: "full", label: "Temps plein", dailyMinutes: 8 * 60 },
  { value: "three_quarters", label: "Trois-quarts temps", dailyMinutes: 6 * 60 },
  { value: "half", label: "Mi-temps", dailyMinutes: 3 * 60 + 45 },
];

export function dailyMinutesForQuota(quota: WorkQuota) {
  return (
    WORK_QUOTA_OPTIONS.find((option) => option.value === quota)?.dailyMinutes ??
    8 * 60
  );
}

/** Durée proposée par défaut pour une formation ; la fenêtre permet ensuite
 * de choisir explicitement entre 3 h et 6 h. */
export function trainingRecoveryMinutes(quota: WorkQuota): 180 | 360 {
  return quota === "half" ? 180 : 360;
}

export function trainingRecoveryTimes(
  quota: WorkQuota,
  moment: "morning" | "afternoon" = "morning",
  durationMinutes: 180 | 360 = trainingRecoveryMinutes(quota),
) {
  if (quota !== "half" && durationMinutes === 360) return { start: "10:00", end: "16:00" };
  return moment === "afternoon"
    ? { start: "13:00", end: "16:00" }
    : { start: "10:00", end: "13:00" };
}

/** Crédit attaché au choix « prime + récupération » d'un jour férié :
 * 8 h 15 à temps plein, 6 h 30 à trois-quarts temps et 4 h à mi-temps.
 * Les dates sont dédupliquées : une resynchronisation du même jour ne peut
 * jamais créditer le solde une seconde fois. */
export function holidayRecoveryMinutesForQuota(quota: WorkQuota) {
  if (quota === "full") return 8 * 60 + 15;
  if (quota === "three_quarters") return 6 * 60 + 30;
  return 4 * 60;
}

export function holidayRecoveryCreditMinutes(
  dates: string[],
  quota: WorkQuota,
) {
  return new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))).size *
    holidayRecoveryMinutesForQuota(quota);
}

export function holidayRecoveryEntries(
  sources: Array<string | { date: string; minutes?: number }>,
  quota?: WorkQuota,
): OvertimeEntry[] {
  const byDate = new Map<string, number>();
  for (const source of sources) {
    const date = typeof source === "string" ? source : source.date;
    const minutes = typeof source === "string"
      ? quota ? holidayRecoveryMinutesForQuota(quota) : undefined
      : source.minutes;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(minutes) && (minutes as number) > 0)
      byDate.set(date, minutes as number);
  }
  return [...byDate]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, minutes]) => ({
      id: `holiday-recovery-${date}`,
      date,
      minutes,
      dayMinutes: minutes,
      nightMinutes: 0,
      disposition: "recovery",
      inputMode: "duration",
      updatedAt: date,
  }));
}

/** Additionne uniquement les crédits dont la durée acquise est enregistrée.
 * Les anciens choix sans durée restent volontairement à reprendre : leur
 * quotité historique ne peut pas être déduite de la quotité actuelle. */
export function storedHolidayRecoveryCreditMinutes(
  entries: Array<{ holiday_recovery_minutes?: number }>,
) {
  return entries.reduce((total, entry) =>
    total + (Number.isInteger(entry.holiday_recovery_minutes) && (entry.holiday_recovery_minutes as number) > 0
      ? entry.holiday_recovery_minutes as number
      : 0), 0);
}

export function minutesLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!rest) return `${hours} h`;
  if (!hours) return `${rest} min`;
  return `${hours} h ${String(rest).padStart(2, "0")}`;
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Découpe une plage aux bornes officielles de nuit (22 h à 7 h), y compris
 * lorsqu'elle passe minuit. Une heure de fin antérieure au début désigne le
 * lendemain ; deux heures identiques restent invalides. */
export function splitOvertimeRange(start: string, end: string) {
  const from = clockMinutes(start);
  const rawTo = clockMinutes(end);
  if (from === null || rawTo === null || rawTo === from) return null;
  const to = rawTo < from ? rawTo + 24 * 60 : rawTo;
  if (to - from <= 0 || to - from > 24 * 60) return null;
  let dayMinutes = 0;
  let nightMinutes = 0;
  for (let minute = from; minute < to; minute++) {
    const clock = minute % (24 * 60);
    if (clock >= 7 * 60 && clock < 22 * 60) dayMinutes++;
    else nightMinutes++;
  }
  return { minutes: to - from, dayMinutes, nightMinutes };
}

/** Convertit chaque ligne du formulaire complet de récupération en minutes
 * débitées du même solde d'heures. Les journées et jours fériés suivent la
 * quotité, la demi-journée en vaut exactement la moitié et la saisie libre
 * conserve sa durée réelle. */
export function recoveryRequestMinutes(
  type: RecoveryRequestType,
  quota: WorkQuota,
  start = "",
  end = "",
) {
  const dailyMinutes = dailyMinutesForQuota(quota);
  if (start !== "" || end !== "") return splitOvertimeRange(start, end)?.minutes ?? 0;
  if (type === "recovery_training") return trainingRecoveryMinutes(quota);
  if (type === "recovery_holiday") return holidayRecoveryMinutesForQuota(quota);
  if (type === "recovery_day") return dailyMinutes;
  if (type === "recovery_half") return quota === "half" ? dailyMinutes : dailyMinutes / 2;
  return splitOvertimeRange(start, end)?.minutes ?? 0;
}

export function overtimeFromDuration(
  hours: number,
  minutes: number,
  period: OvertimePeriod,
) {
  const total = Math.round(hours * 60 + minutes);
  if (!Number.isFinite(total) || total <= 0 || total > 24 * 60) return null;
  return {
    minutes: total,
    dayMinutes: period === "day" ? total : 0,
    nightMinutes: period === "night" ? total : 0,
  };
}

export function nextPayPeriod(date: string) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  const nextMonth = (month + 1) % 12;
  return { year: year + (month === 11 ? 1 : 0), month: nextMonth };
}

export function monthlyRecoveryBalance(
  overtime: OvertimeEntry[],
  recoveryUses: RecoveryUse[],
  isSundayOrHoliday?: (date: string) => boolean,
) {
  const earned = overtime
    .filter((entry) => entry.disposition === "recovery")
    .reduce((total, entry) => total + overtimeRecoveryCreditMinutes(entry, isSundayOrHoliday), 0);
  const used = recoveryUses.reduce((total, entry) => total + entry.minutes, 0);
  return { earned, used, remaining: earned - used };
}

/** Affecte les récupérations utilisées aux gains les plus anciens (FIFO),
 * uniquement pour afficher un état compréhensible dans l'historique. */
export function allocateRecoveryUses(
  overtime: OvertimeEntry[],
  recoveryUses: RecoveryUse[],
  isSundayOrHoliday?: (date: string) => boolean,
) {
  let minutesToAllocate = recoveryUses.reduce(
    (total, entry) => total + entry.minutes,
    0,
  );
  return overtime
    .filter((entry) => entry.disposition === "recovery")
    .sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`))
    .map((entry) => {
      const earnedMinutes = overtimeRecoveryCreditMinutes(entry, isSundayOrHoliday);
      const usedMinutes = Math.min(earnedMinutes, minutesToAllocate);
      minutesToAllocate -= usedMinutes;
      return {
        entryId: entry.id,
        earnedMinutes,
        usedMinutes,
        remainingMinutes: earnedMinutes - usedMinutes,
      };
    });
}

export type PaidOvertimeLine = {
  entryId: string;
  date: string;
  minutes: number;
  dayMinutes: number;
  sundayHolidayMinutes: number;
  nightMinutes: number;
  lowRateMinutes: number;
  highRateMinutes: number;
  amount: number;
};

export type OvertimeCalendarSplit = {
  minutes: number;
  dayMinutes: number;
  sundayHolidayMinutes: number;
  nightMinutes: number;
};

function shiftedDateKey(date: string, dayOffset: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return "";
  const shifted = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + dayOffset),
  );
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function defaultRecoveryMinutes(
  kind: "hours" | "half" | "day" | "holiday" | "training",
  quota: WorkQuota,
) {
  if (kind === "holiday") return holidayRecoveryMinutesForQuota(quota);
  if (kind === "day") return dailyMinutesForQuota(quota);
  if (kind === "half") return quota === "half" ? dailyMinutesForQuota(quota) : dailyMinutesForQuota(quota) / 2;
  if (kind === "training") return trainingRecoveryMinutes(quota);
  return dailyMinutesForQuota(quota);
}

/** Classe une plage selon la date réellement parcourue. La nuit conserve son
 * tarif propre ; les minutes de jour effectuées un dimanche ou un jour férié
 * reçoivent la majoration dédiée, y compris après un passage à minuit. */
export function splitOvertimeRangeByCalendar(
  date: string,
  start: string,
  end: string,
  isSundayOrHoliday: (date: string) => boolean,
): OvertimeCalendarSplit | null {
  const from = clockMinutes(start);
  const rawTo = clockMinutes(end);
  if (from === null || rawTo === null || rawTo === from || !shiftedDateKey(date, 0))
    return null;
  const to = rawTo < from ? rawTo + 24 * 60 : rawTo;
  if (to - from <= 0 || to - from > 24 * 60) return null;
  let dayMinutes = 0;
  let sundayHolidayMinutes = 0;
  let nightMinutes = 0;
  for (let minute = from; minute < to; minute++) {
    const clock = minute % (24 * 60);
    if (clock < 7 * 60 || clock >= 22 * 60) {
      nightMinutes++;
      continue;
    }
    const currentDate = shiftedDateKey(date, Math.floor(minute / (24 * 60)));
    if (isSundayOrHoliday(currentDate)) sundayHolidayMinutes++;
    else dayMinutes++;
  }
  return {
    minutes: to - from,
    dayMinutes,
    sundayHolidayMinutes,
    nightMinutes,
  };
}

export const OVERTIME_RECOVERY_FACTORS = {
  day: 1.25,
  /** Les deux tiers de majoration, à l'identique du calcul de paie : 1,66
   *  était la même règle arrondie, et s'en écartait de 2,4 minutes sur six
   *  heures. */
  sundayHoliday: 5 / 3,
  night: 2,
} as const;

/** Plafond mensuel d'heures supplémentaires indemnisables. Au-delà, les heures
 *  restent déclarées et visibles, mais ne sont plus payées : les compter
 *  gonflerait l'estimation. */
export const PAID_OVERTIME_MONTHLY_CAP_MINUTES = 25 * 60;

/** Crédit généré par des heures supplémentaires choisies en récupération.
 * Les ajouts manuels et crédits de férié sont déjà exprimés en minutes
 * créditées. Seules les déclarations par plage horaire sont majorées. */
export function overtimeRecoveryCreditMinutes(
  entry: OvertimeEntry,
  isSundayOrHoliday: (date: string) => boolean = (date) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    return Boolean(match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay() === 0);
  },
) {
  if (entry.inputMode !== "range" || !entry.start || !entry.end) return entry.minutes;
  const split = splitOvertimeRangeByCalendar(entry.date, entry.start, entry.end, isSundayOrHoliday);
  if (!split) return entry.minutes;
  return recoveryCreditFromSplit(split);
}

/** L'unique endroit où la majoration s'applique : le crédit enregistré et
 *  celui annoncé au moment de la saisie passent tous deux par ici, pour qu'ils
 *  ne puissent pas diverger. */
function recoveryCreditFromSplit(split: OvertimeCalendarSplit) {
  return Math.round(
    split.dayMinutes * OVERTIME_RECOVERY_FACTORS.day +
    split.sundayHolidayMinutes * OVERTIME_RECOVERY_FACTORS.sundayHoliday +
    split.nightMinutes * OVERTIME_RECOVERY_FACTORS.night,
  );
}

/**
 * Ce qu'une plage horaire donnera si elle est prise en récupération, avant
 * tout enregistrement.
 *
 * Sert à l'annoncer pendant la saisie : sans cette annonce, quelqu'un qui
 * connaît la règle applique la majoration lui-même et l'application la
 * réapplique par-dessus. C'est arrivé — 3 h travaillées saisies en 3 h 45,
 * créditées 4 h 41.
 */
export function overtimeRangeRecoveryPreview(
  date: string,
  start: string,
  end: string,
  isSundayOrHoliday: (date: string) => boolean,
) {
  const split = splitOvertimeRangeByCalendar(date, start, end, isSundayOrHoliday);
  if (!split) return null;
  return { workedMinutes: split.minutes, creditedMinutes: recoveryCreditFromSplit(split) };
}

/** Calcule les IHTS des seules heures « À payer » du mois d'exécution.
 * Les minutes récupérées n'avancent jamais le seuil des quatorze heures. */
export function calculatePaidOvertime(
  entries: OvertimeEntry[],
  year: number,
  month: number,
  quota: WorkQuota,
  monthlyBaseSalary: number,
  monthlyResidenceAllowance: number,
  isSundayOrHoliday: (date: string) => boolean = (date) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    return Boolean(
      match &&
        new Date(
          Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
        ).getUTCDay() === 0,
    );
  },
) {
  const paid = entries
    .filter(
      (entry) =>
        entry.disposition === "paid" &&
        Number(entry.date.slice(0, 4)) === year &&
        Number(entry.date.slice(5, 7)) - 1 === month,
    )
    .sort((a, b) =>
      `${a.date}-${a.start || "00:00"}-${a.id}`.localeCompare(
        `${b.date}-${b.start || "00:00"}-${b.id}`,
      ),
    );
  const hourlyBase =
    ((monthlyBaseSalary + monthlyResidenceAllowance) * 12) / 1820;
  if (!monthlyBaseSalary || !Number.isFinite(hourlyBase) || hourlyBase <= 0)
    return {
      ready: false as const,
      hourlyBase: 0,
      totalMinutes: paid.reduce((sum, entry) => sum + entry.minutes, 0),
      cappedMinutes: 0,
      amount: 0,
      lines: [] as PaidOvertimeLine[],
    };

  let paidRankMinutes = 0;
  let cappedMinutes = 0;
  const threshold = 14 * 60;
  const lines: PaidOvertimeLine[] = [];
  for (const entry of paid) {
    let lowRateMinutes = 0;
    let highRateMinutes = 0;
    let amount = 0;
    const calendarSplit =
      entry.inputMode === "range" && entry.start && entry.end
        ? splitOvertimeRangeByCalendar(
            entry.date,
            entry.start,
            entry.end,
            isSundayOrHoliday,
          )
        : null;
    const sundayHolidayMinutes = calendarSplit
      ? calendarSplit.sundayHolidayMinutes
      : isSundayOrHoliday(entry.date)
        ? entry.dayMinutes
        : 0;
    const dayMinutes = calendarSplit
      ? calendarSplit.dayMinutes
      : entry.dayMinutes - sundayHolidayMinutes;
    const nightMinutes = calendarSplit?.nightMinutes ?? entry.nightMinutes;
    const segments = [
      { minutes: dayMinutes, factor: 1 },
      { minutes: sundayHolidayMinutes, factor: 5 / 3 },
      { minutes: nightMinutes, factor: 2 },
    ];
    for (const segment of segments) {
      if (!segment.minutes) continue;
      /* Les minutes au-delà du plafond mensuel restent comptées dans le total
         déclaré, mais n'entrent ni dans le montant ni dans les tranches. */
      const payable = Math.max(
        0,
        Math.min(
          segment.minutes,
          PAID_OVERTIME_MONTHLY_CAP_MINUTES - paidRankMinutes,
        ),
      );
      cappedMinutes += segment.minutes - payable;
      if (quota !== "full") {
        amount += (payable / 60) * hourlyBase;
        paidRankMinutes += segment.minutes;
        continue;
      }
      const firstBand = Math.max(
        0,
        Math.min(payable, threshold - paidRankMinutes),
      );
      const secondBand = payable - firstBand;
      amount +=
        (firstBand / 60) * hourlyBase * 1.25 * segment.factor +
        (secondBand / 60) * hourlyBase * 1.27 * segment.factor;
      lowRateMinutes += firstBand;
      highRateMinutes += secondBand;
      paidRankMinutes += segment.minutes;
    }
    lines.push({
      entryId: entry.id,
      date: entry.date,
      minutes: entry.minutes,
      dayMinutes,
      sundayHolidayMinutes,
      nightMinutes,
      lowRateMinutes,
      highRateMinutes,
      amount,
    });
  }
  return {
    ready: true as const,
    hourlyBase,
    totalMinutes: paidRankMinutes,
    /** Les minutes déclarées au-delà des vingt-cinq heures du mois : l'écran
     *  le dit plutôt que de les passer sous silence. */
    cappedMinutes,
    amount: lines.reduce((total, line) => total + line.amount, 0),
    lines,
  };
}
