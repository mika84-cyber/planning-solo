export type WorkQuota = "full" | "three_quarters" | "half";
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
  { value: "half", label: "Mi-temps", dailyMinutes: 4 * 60 },
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

export function trainingRecoveryTimes(quota: WorkQuota) {
  return {
    start: "09:00",
    end: quota === "half" ? "12:00" : "15:00",
  };
}

/** Crédit attaché au choix « prime + récupération » d'un jour férié.
 * Les dates sont dédupliquées : une resynchronisation du même jour ne peut
 * jamais créditer le solde une seconde fois. */
export function holidayRecoveryCreditMinutes(
  dates: string[],
  quota: WorkQuota,
) {
  return new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))).size *
    dailyMinutesForQuota(quota);
}

export function holidayRecoveryEntries(
  dates: string[],
  quota: WorkQuota,
): OvertimeEntry[] {
  const minutes = dailyMinutesForQuota(quota);
  return [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))]
    .sort()
    .map((date) => ({
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
  if (type === "recovery_training") {
    const selected = splitOvertimeRange(start, end)?.minutes ?? 0;
    return selected === 3 * 60 || selected === 6 * 60 ? selected : 0;
  }
  if (type === "recovery_day" || type === "recovery_holiday")
    return dailyMinutes;
  if (type === "recovery_half") return dailyMinutes / 2;
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
) {
  const earned = overtime
    .filter((entry) => entry.disposition === "recovery")
    .reduce((total, entry) => total + entry.minutes, 0);
  const used = recoveryUses.reduce((total, entry) => total + entry.minutes, 0);
  return { earned, used, remaining: earned - used };
}

/** Affecte les récupérations utilisées aux gains les plus anciens (FIFO),
 * uniquement pour afficher un état compréhensible dans l'historique. */
export function allocateRecoveryUses(
  overtime: OvertimeEntry[],
  recoveryUses: RecoveryUse[],
) {
  let minutesToAllocate = recoveryUses.reduce(
    (total, entry) => total + entry.minutes,
    0,
  );
  return overtime
    .filter((entry) => entry.disposition === "recovery")
    .sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`))
    .map((entry) => {
      const usedMinutes = Math.min(entry.minutes, minutesToAllocate);
      minutesToAllocate -= usedMinutes;
      return {
        entryId: entry.id,
        usedMinutes,
        remainingMinutes: entry.minutes - usedMinutes,
      };
    });
}

export type PaidOvertimeLine = {
  entryId: string;
  date: string;
  minutes: number;
  dayMinutes: number;
  nightMinutes: number;
  lowRateMinutes: number;
  highRateMinutes: number;
  amount: number;
};

/** Calcule les IHTS des seules heures « À payer » du mois d'exécution.
 * Les minutes récupérées n'avancent jamais le seuil des quatorze heures. */
export function calculatePaidOvertime(
  entries: OvertimeEntry[],
  year: number,
  month: number,
  quota: WorkQuota,
  monthlyBaseSalary: number,
  monthlyResidenceAllowance: number,
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
      amount: 0,
      lines: [] as PaidOvertimeLine[],
    };

  let paidRankMinutes = 0;
  const threshold = 14 * 60;
  const lines: PaidOvertimeLine[] = [];
  for (const entry of paid) {
    let lowRateMinutes = 0;
    let highRateMinutes = 0;
    let amount = 0;
    const segments = [
      { minutes: entry.dayMinutes, night: false },
      { minutes: entry.nightMinutes, night: true },
    ];
    for (const segment of segments) {
      if (!segment.minutes) continue;
      if (quota !== "full") {
        amount += (segment.minutes / 60) * hourlyBase;
        paidRankMinutes += segment.minutes;
        continue;
      }
      const firstBand = Math.max(
        0,
        Math.min(segment.minutes, threshold - paidRankMinutes),
      );
      const secondBand = segment.minutes - firstBand;
      const nightFactor = segment.night ? 2 : 1;
      amount +=
        (firstBand / 60) * hourlyBase * 1.25 * nightFactor +
        (secondBand / 60) * hourlyBase * 1.27 * nightFactor;
      lowRateMinutes += firstBand;
      highRateMinutes += secondBand;
      paidRankMinutes += segment.minutes;
    }
    lines.push({
      entryId: entry.id,
      date: entry.date,
      minutes: entry.minutes,
      dayMinutes: entry.dayMinutes,
      nightMinutes: entry.nightMinutes,
      lowRateMinutes,
      highRateMinutes,
      amount,
    });
  }
  return {
    ready: true as const,
    hourlyBase,
    totalMinutes: paidRankMinutes,
    amount: lines.reduce((total, line) => total + line.amount, 0),
    lines,
  };
}
