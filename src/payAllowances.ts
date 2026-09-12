import type { Entries, LeavePeriod, ManualYearAdjustments } from "./appModel";
import {
  SUNDAY_ALLOWANCE,
  applyManualSundayLeave,
  dateKey,
  getDayInfo,
  holidayAllowance,
  holidayPayslip,
  localDate,
  monthDays,
  sundayAllowance,
  sundayPayslip,
  sundayTierFor,
  wasPompidouHolidayWorked,
  type HolidayPay,
} from "./planningLogic";

/** Reprise sans dates : des jours déjà posés, saisis en nombre. */
export const EMPTY_MANUAL_ADJUSTMENTS: ManualYearAdjustments = {
  annualUsed: 0,
  rttUsed: 0,
  fractionUsed: 0,
  sundayLeaveJanJun: 0,
  sundayLeaveJulSep: 0,
  sundayLeaveOctNov: 0,
  sundayLeaveDec: 0,
};

/** Première année de mise à disposition au Grand Palais, où le jour de
 *  fermeture est le lundi et non le mardi comme à Pompidou — tout est
 *  décalé d'un jour, et les fériés compensés (voir plus bas) s'appliquent.
 *  En cours depuis, sans fin prévue : pas de borne de fin. */
export const SECONDMENT_START_YEAR = 2026;

type CalendarContext = {
  today: Date;
  entries: Entries;
  periods: LeavePeriod[];
  group: number;
  manualAdjustments: Record<string, ManualYearAdjustments> | undefined;
};

/** Dimanches, fériés et fériés compensés d'une année, congés déduits. */
export function collectWorkedDays({
  year,
  today,
  entries,
  periods,
  group,
  manualAdjustments,
}: CalendarContext & { year: number }) {
  const todayKey = dateKey(today);
  const onLeave = (key: string) =>
    Boolean(entries[key]?.leave) ||
    periods.some(
      (period) =>
        key >= period.from &&
        key <= period.to,
    );
  const sundays: Array<{ key: string; rank: number; past: boolean }> = [];
  const holidays: Array<{
    key: string;
    name: string;
    choice: HolidayPay | "";
    past: boolean;
  }> = [];
  const compensated: Array<{
    key: string;
    name: string;
    choice: HolidayPay | "";
  }> = [];
  const cancelledHolidays: Array<{ key: string; name: string }> = [];
  // Dimanches que le cycle programme jusqu'à aujourd'hui, sans tenir compte
  // des congés ni des arrêts maladie : le repère pour « combien j'en aurais
  // fait sans rien avoir posé », à comparer à `sundayDone` plus bas, qui lui
  // exclut les dimanches couverts par un congé.
  let sundaysScheduledPast = 0;
  for (let month = 0; month < 12; month++)
    for (let day = 1; day <= monthDays(year, month); day++) {
      const date = localDate(year, month, day);
      const info = getDayInfo(date, group);
      const key = dateKey(date);
      if (info.kind !== "work") {
        if (info.holiday && wasPompidouHolidayWorked(date, group))
          compensated.push({
            key,
            name: info.holiday,
            choice: entries[key]?.holidayPay || "",
          });
        continue;
      }
      if (!info.holiday && date.getDay() === 0 && key <= todayKey)
        sundaysScheduledPast++;
      if (onLeave(key)) {
        if (info.holiday)
          cancelledHolidays.push({ key, name: info.holiday });
        continue;
      }
      if (info.holiday) {
        holidays.push({
          key,
          name: info.holiday,
          choice: entries[key]?.holidayPay || "",
          past: key <= todayKey,
        });
        continue;
      }
      if (date.getDay() === 0)
        sundays.push({ key, rank: sundays.length + 1, past: key <= todayKey });
    }
  // Les personnes qui commencent à utiliser l'application en cours d'année
  // peuvent reprendre uniquement un nombre de dimanches déjà posés, sans
  // ressaisir toutes les dates. On retire ces dimanches des périodes de paie
  // correspondantes ; les congés datés enregistrés ensuite ont déjà été
  // écartés par `onLeave` et continuent donc de s'ajouter naturellement.
  const manual =
    manualAdjustments?.[String(year)] ??
    EMPTY_MANUAL_ADJUSTMENTS;
  const adjustedSundays = applyManualSundayLeave(sundays, {
    janJun: manual.sundayLeaveJanJun,
    julSep: manual.sundayLeaveJulSep,
    octNov: manual.sundayLeaveOctNov,
    dec: manual.sundayLeaveDec,
  });
  const worked = adjustedSundays.length;
  const decided = holidays.filter((item) => item.choice);
  return {
    year,
    sundays: adjustedSundays,
    sundayCount: worked,
    sundayTotal: sundayAllowance(worked),
    sundaysScheduledPast,
    holidays,
    holidayPending: holidays.length - decided.length,
    cancelledHolidays,
    compensated,
    recoveryDaysEarned: holidays.filter(
      (item) => item.choice === "recovery",
    ).length,
  };
}

export type PayAllowancesInput = CalendarContext & {
  year: number;
  baseSalary: number;
  sundayCarryover: number;
  sundayCarryoverYear: number | undefined;
  sundayCarryoverMonth: number | undefined;
  sundayCarryoverFromYear: number | undefined;
  sundayCarryoverFromMonth: number | undefined;
};

/** Ce qui tombera sur chacune des douze paies de l'année affichée.
 *
 *  Deux décalages à respecter : les dimanches de décembre sont payés en
 *  janvier de l'année suivante, et un férié est payé le mois suivant. La
 *  paie de janvier porte donc du décembre de l'année précédente, qu'il faut
 *  aller chercher.
 */
export function computePayAllowances({
  year,
  today,
  entries,
  periods,
  group,
  baseSalary,
  manualAdjustments,
  sundayCarryover,
  sundayCarryoverYear,
  sundayCarryoverMonth,
  sundayCarryoverFromYear,
  sundayCarryoverFromMonth,
}: PayAllowancesInput) {
  const current = collectWorkedDays({ year, today, entries, periods, group, manualAdjustments });
  const previous = collectWorkedDays({ year: year - 1, today, entries, periods, group, manualAdjustments });
  // Le versement mensuel du forfait n'entre pas ici : il tombe tous les mois
  // quoi qu'il arrive, ce ne sont pas les primes à suivre de près.
  const monthly = Array.from({ length: 12 }, () => ({
    sunday: 0,
    sundayCount: 0,
    holiday: 0,
    holidayCount: 0,
    compensated: 0,
    compensatedCount: 0,
    carryover: 0,
    reported: 0,
  }));
  // Seuls les dimanches du onzième au trente-et-unième se versent ; les
  // suivants ne sont pas majorés, ils n'apparaissent donc sur aucune paie.
  const payoutMonth = [6, 9, 11, 0];
  for (const sunday of current.sundays.slice(
    SUNDAY_ALLOWANCE.flatUntil,
    SUNDAY_ALLOWANCE.paidUntil,
  )) {
    const order = sundayPayslip(sunday.key).order;
    // Décembre relève de la paie de janvier de l'année suivante : hors de
    // l'année affichée, il n'est pas montré ici.
    if (order === 3) continue;
    const slot = monthly[payoutMonth[order]];
    slot.sunday += SUNDAY_ALLOWANCE.perSunday;
    slot.sundayCount++;
  }
  for (const sunday of previous.sundays.slice(
    SUNDAY_ALLOWANCE.flatUntil,
    SUNDAY_ALLOWANCE.paidUntil,
  )) {
    if (sundayPayslip(sunday.key).order !== 3) continue;
    monthly[0].sunday += SUNDAY_ALLOWANCE.perSunday;
    monthly[0].sundayCount++;
  }
  // Un dimanche manqué sur un bulletin, reporté depuis « Vérifier mon
  // bulletin » : la paie a un délai de traitement, il n'apparaît qu'au
  // rappel suivant plutôt que d'être perdu.
  if (
    sundayCarryover &&
    sundayCarryoverYear === year &&
    sundayCarryoverMonth !== undefined
  ) {
    const slot = monthly[sundayCarryoverMonth];
    slot.sunday += sundayCarryover * SUNDAY_ALLOWANCE.perSunday;
    slot.sundayCount += sundayCarryover;
    slot.carryover = sundayCarryover;
  }
  // Le bulletin d'où vient le report n'a, lui, pas payé ces dimanches : sa
  // propre case doit le montrer plutôt que d'afficher ce que le cycle
  // laissait attendre.
  if (
    sundayCarryover &&
    sundayCarryoverFromYear === year &&
    sundayCarryoverFromMonth !== undefined
  ) {
    const slot = monthly[sundayCarryoverFromMonth];
    slot.sunday = Math.max(
      0,
      slot.sunday - sundayCarryover * SUNDAY_ALLOWANCE.perSunday,
    );
    slot.sundayCount = Math.max(0, slot.sundayCount - sundayCarryover);
    slot.reported = sundayCarryover;
  }
  const addHoliday = (
    item: { key: string; choice: HolidayPay | "" },
    monthIndex: number,
  ) => {
    const slot = monthly[monthIndex];
    slot.holidayCount++;
    if (item.choice)
      slot.holiday += holidayAllowance(baseSalary, item.choice);
  };
  for (const item of current.holidays) {
    // Un férié de décembre est payé en janvier de l'année suivante.
    if (Number(item.key.slice(5, 7)) === 12) continue;
    addHoliday(item, holidayPayslip(item.key).monthIndex);
  }
  for (const item of previous.holidays)
    if (Number(item.key.slice(5, 7)) === 12) addHoliday(item, 0);
  /* Les fériés compensés de l'année précédente tombent sur la paie de
     février, en prime seule — ligne « Compens. Indem jf ac public n-1 » du
     bulletin. Seules les années de mise à disposition comptent : avant
     elle, le jour de fermeture était le mardi et non le lundi, si bien que
     le décalage d'un jour ne s'appliquait pas. */
  const compensatedYear = year - 1;
  const compensatedCount =
    compensatedYear >= SECONDMENT_START_YEAR
      ? previous.compensated.length
      : 0;
  if (compensatedCount) {
    monthly[1].compensatedCount = compensatedCount;
    // Comme un férié travaillé : la prime seule et la prime + récup ne
    // valent pas le même montant, donc rien n'est compté tant que le choix
    // n'a pas été fait, plutôt que de supposer la prime seule par défaut.
    monthly[1].compensated = previous.compensated.reduce(
      (total, item) =>
        item.choice
          ? total + holidayAllowance(baseSalary, item.choice)
          : total,
      0,
    );
  }
  const done = current.sundays.filter((item) => item.past).length;
  const months = monthly
    .map((slot, index) => ({
      ...slot,
      index,
      total: slot.sunday + slot.holiday + slot.compensated,
    }))
    // Seuls les mois qui portent une prime méritent une ligne : les autres
    // ne reçoivent que le forfait, identique toute l'année.
    .filter(
      (slot) =>
        slot.sundayCount > 0 ||
        slot.holidayCount > 0 ||
        slot.compensatedCount > 0,
    );
  return {
    ...current,
    sundayDone: done,
    sundayLeft: current.sundays.length - done,
    // Le socle se lit sur les dimanches déjà faits. Tant qu'aucun n'est
    // travaillé, on annonce le premier socle plutôt que rien.
    tier: sundayTierFor(Math.max(1, done)),
    // Ceux de l'année précédente, ceux qui se paient en février : la carte
    // les liste, l'année affichée ne les verra qu'un an plus tard.
    compensatedPrevious: previous.compensated,
    compensatedYear,
    compensatedPaid: compensatedCount > 0,
    monthly: months,
    monthlyTotal: months.reduce((total, slot) => total + slot.total, 0),
    sundayMonthsTotal: months.reduce((total, slot) => total + slot.sunday, 0),
  };
}
