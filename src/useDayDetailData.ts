import { useMemo } from "react";
import type { Entries, LeavePeriod } from "./appModel";
import type { OvertimeEntry, RecoveryUse } from "./overtime";
import { fromKey, getDayInfo } from "./planningLogic";
import { workExchangeForDate } from "./workExchange";
import { canChooseWorkPost } from "./workPost";

type DayDetailDataInput = {
  /** La date de la fiche ouverte, ou null. */
  dayDate: string | null;
  /** Le congé personnel du jour, s'il est posé depuis la fiche. */
  dayPersonalLeave: unknown;
  group: number;
  periods: LeavePeriod[];
  entries: Entries;
  recoveryUses: RecoveryUse[];
  overtimeEntries: OvertimeEntry[];
  exceptionalClosureFor: (key: string) => { date: string; label: string } | undefined;
};

/** Ce que la fiche du jour montre de la date ouverte : périodes, récupérations,
 *  heures, fermeture, échange, choix du férié et du poste. */
export function useDayDetailData({
  dayDate,
  dayPersonalLeave,
  group,
  periods,
  entries,
  recoveryUses,
  overtimeEntries,
  exceptionalClosureFor,
}: DayDetailDataInput) {
  /* Le choix ne s'affiche que sur un férié effectivement travaillé : ni posé
     en congé, ni tombé sur un repos ou une formation — `getDayInfo` a déjà
     écarté ces deux cas en renvoyant « off ». */
  const dayHolidayChoiceVisible = useMemo(() => {
    if (!dayDate) return false;
    const info = getDayInfo(fromKey(dayDate), group);
    if (!info.holiday || info.kind !== "work") return false;
    if (dayPersonalLeave) return false;
    return !periods.some(
      (period) => dayDate >= period.from && dayDate <= period.to,
    );
  }, [dayDate, group, dayPersonalLeave, periods]);

  const dayStoredPeriods = dayDate
    ? periods.filter((period) => dayDate >= period.from && dayDate <= period.to)
    : [];
  const dayRecoveryUses = dayDate
    ? recoveryUses.filter((entry) => entry.date === dayDate)
    : [];
  const dayOvertime = overtimeEntries.filter(
    (entry) => entry.date === dayDate && entry.disposition === "recovery",
  );
  const dayExceptionalClosure = dayDate
    ? exceptionalClosureFor(dayDate)
    : undefined;
  const dayExchange = dayDate ? workExchangeForDate(entries, dayDate) : null;
  // Salles, accueil ou billetterie : seulement sur un jour travaillé.
  const dayWorkPostVisible = dayDate
    ? canChooseWorkPost({ date: dayDate, group, entries, periods, recoveryUses, closed: Boolean(dayExceptionalClosure) })
    : false;

  return {
    dayHolidayChoiceVisible,
    dayStoredPeriods,
    dayRecoveryUses,
    dayOvertime,
    dayExceptionalClosure,
    dayExchange,
    dayWorkPostVisible,
  };
}
