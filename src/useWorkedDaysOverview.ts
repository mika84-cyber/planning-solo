import { useMemo } from "react";
import {
  workedDayCount,
  workedDayCountBetween,
  type Entries,
  type FormProfile,
  type LeavePeriod,
  type SelectedDay,
} from "./appModel";
import type { MecenatEntry } from "./mecenat";
import { dailyMinutesForQuota, usableWorkSchedule, type OvertimeEntry, type RecoveryUse } from "./overtime";
import { dateKey, localDate } from "./planningLogic";
import { computeTodayOverview } from "./todayOverview";

type WorkedDaysOverviewInput = {
  /** Le mois affiché dans le calendrier. */
  view: Date;
  now: Date;
  group: number;
  periods: LeavePeriod[];
  entries: Entries;
  recoveryUses: RecoveryUse[];
  formProfile: FormProfile | null;
  mecenatEntries: MecenatEntry[];
  overtimeEntries: OvertimeEntry[];
  /** Les dates choisies dans la demande en cours. */
  selections: Record<string, SelectedDay>;
  workDayMinutes: number;
  /** La fermeture exceptionnelle d'un jour, s'il y en a une (stable entre deux rendus). */
  exceptionalClosureFor: (key: string) => unknown;
};

/** Ce que la case du calendrier et l'accueil annoncent : les jours travaillés
 *  du mois et d'ici la fin de l'année, le prochain mécénat ou les prochaines
 *  heures sup, et l'aperçu du jour. */
export function useWorkedDaysOverview({
  view,
  now,
  group,
  periods,
  entries,
  recoveryUses,
  formProfile,
  mecenatEntries,
  overtimeEntries,
  selections,
  workDayMinutes,
  exceptionalClosureFor,
}: WorkedDaysOverviewInput) {
  // Les jours réellement travaillés du mois affiché : c'est le compte de la
  // case du calendrier.
  const monthWorkedDays = useMemo(
    () =>
      workedDayCount(
        view.getFullYear(),
        view.getMonth(),
        view.getMonth(),
        group,
        periods,
        entries,
        recoveryUses,
        dailyMinutesForQuota(formProfile?.workQuota || "full"),
        (key) => Boolean(exceptionalClosureFor(key)),
        (key) => entries[key]?.exchangeRole || "",
      ),
    [view, group, periods, entries, recoveryUses, formProfile?.workQuota, exceptionalClosureFor],
  );
  // Les jours réellement travaillés de l'année affichée dans le calendrier,
  // congés, fermetures et échanges déduits : d'aujourd'hui au 31 décembre
  // pour l'année en cours, l'année entière pour une autre, à venir ou passée.
  const shownYear = view.getFullYear();
  const remainingWorkedDays = useMemo(
    () =>
      workedDayCountBetween(
        shownYear === now.getFullYear() ? now : localDate(shownYear, 0, 1),
        localDate(shownYear, 11, 31),
        group,
        periods,
        entries,
        recoveryUses,
        dailyMinutesForQuota(formProfile?.workQuota || "full"),
        (key) => Boolean(exceptionalClosureFor(key)),
        (key) => entries[key]?.exchangeRole || "",
      ),
    [now, shownYear, group, periods, entries, recoveryUses, formProfile?.workQuota, exceptionalClosureFor],
  );
  // Le prochain mécénat ou les prochaines heures sup déclarées, à partir
  // d'aujourd'hui : ce qui vient s'ajouter au planning habituel.
  const nextExtraWork = useMemo(() => {
    const todayKey = dateKey(now);
    const upcoming = [
      ...mecenatEntries.map((entry) => ({ kind: "mecenat" as const, date: entry.date, start: entry.start, end: entry.end })),
      ...overtimeEntries
        .filter((entry) => entry.inputMode === "range" && entry.start && entry.end)
        .map((entry) => ({ kind: "overtime" as const, date: entry.date, start: entry.start ?? "", end: entry.end ?? "" })),
    ]
      .filter((item) => item.date >= todayKey)
      .sort((left, right) => `${left.date}-${left.start}`.localeCompare(`${right.date}-${right.start}`));
    return upcoming[0] ?? null;
  }, [now, mecenatEntries, overtimeEntries]);

  const todayOverview = useMemo(
    () =>
      computeTodayOverview({
        today: now,
        group,
        periods,
        entries,
        recoveryUses,
        selections,
        workDayMinutes,
        isExceptionallyClosed: (key) => Boolean(exceptionalClosureFor(key)),
        workSchedule: usableWorkSchedule(formProfile?.workSchedule),
      }),
    [now, group, periods, entries, recoveryUses, selections, workDayMinutes, exceptionalClosureFor, formProfile?.workSchedule],
  );

  return { monthWorkedDays, remainingWorkedDays, nextExtraWork, todayOverview };
}
