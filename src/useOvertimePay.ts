import { useCallback, useMemo } from "react";
import type { FormProfile, PayProfile } from "./appModel";
import {
  calculatePaidOvertime,
  nextPayPeriod,
  paidOvertimeOnPayslip,
  splitOvertimeRange,
  type OvertimeEntry,
  type WorkQuota,
} from "./overtime";
import { RESIDENCE_ALLOWANCE_RATE, fromKey, getDayInfo } from "./planningLogic";
import type { OvertimeDraft } from "./useWorkTimeUiState";

type OvertimePayInput = {
  overtimeEntries: OvertimeEntry[];
  payProfiles: Record<string, PayProfile>;
  formProfile: FormProfile | null;
  workQuota: WorkQuota;
  group: number;
  /** Le mois de paie affiché dans Ma paie. */
  payView: Date;
  /** Les heures en cours de saisie, pour annoncer ce qu'elles rapporteront. */
  overtimeDraft: OvertimeDraft;
};

/**
 * Le paiement des heures supplémentaires : ce qu'un bulletin doit régler,
 * ce que des heures en cours de saisie rapporteront, et les heures qu'un
 * bulletin a pu payer en avance.
 *
 * Sorti d'App.tsx pour que chaque calcul déclare ses vraies dépendances : le
 * groupe, par exemple, décide des dimanches et fériés travaillés, donc du tarif.
 */
export function useOvertimePay({
  overtimeEntries,
  payProfiles,
  formProfile,
  workQuota,
  group,
  payView,
  overtimeDraft,
}: OvertimePayInput) {
  /** Traitement et indemnité de résidence de l'année où les heures sont faites. */
  const salaryFor = useCallback(
    (year: number) => {
      const profile = payProfiles[String(year)];
      const base = profile?.baseSalary ?? formProfile?.baseSalary ?? 0;
      const residence = profile?.residenceAllowance ?? formProfile?.residenceAllowance ?? base * RESIDENCE_ALLOWANCE_RATE;
      return { base, residence };
    },
    [payProfiles, formProfile?.baseSalary, formProfile?.residenceAllowance],
  );
  const isSundayOrHoliday = useCallback(
    (key: string) => {
      const date = fromKey(key);
      return date.getDay() === 0 || Boolean(getDayInfo(date, group).holiday);
    },
    [group],
  );

  const paidOvertimeForPayPeriod = useCallback(
    (payYear: number, payMonth: number, entries: OvertimeEntry[] = overtimeEntries) =>
      paidOvertimeOnPayslip(entries, payYear, payMonth, workQuota, salaryFor, isSundayOrHoliday),
    [overtimeEntries, workQuota, salaryFor, isSundayOrHoliday],
  );

  /** Les heures à payer du mois de ce bulletin que la paie suivante attend
   *  encore, avec ce qu'elles rapporteront : un bulletin qui en paie plus que
   *  prévu les a peut-être réglées en avance. */
  const overtimeEarlyCandidates = useCallback(
    (year: number, month: number) => {
      const usual = overtimeEntries.filter((entry) => !entry.paidEarly);
      const salary = salaryFor(year);
      const computed = calculatePaidOvertime(usual, year, month, workQuota, salary.base, salary.residence, isSundayOrHoliday);
      return computed.lines
        .map((line) => ({
          entry: usual.find((entry) => entry.id === line.entryId),
          cents: Math.round(line.amount * 100),
        }))
        .filter((item): item is { entry: OvertimeEntry; cents: number } => Boolean(item.entry));
    },
    [overtimeEntries, workQuota, salaryFor, isSundayOrHoliday],
  );

  const overtimeForPayMonth = useMemo(
    () => paidOvertimeForPayPeriod(payView.getFullYear(), payView.getMonth()),
    [paidOvertimeForPayPeriod, payView],
  );

  // « À payer » : ce que ces heures rapporteront, avant de les enregistrer.
  // L'écart avec et sans elles tient compte du seuil des 14 h et du plafond.
  const overtimePayPreview = useMemo(() => {
    if (overtimeDraft.disposition !== "paid" || !/^\d{4}-\d{2}-\d{2}$/.test(overtimeDraft.date)) return null;
    const split = splitOvertimeRange(overtimeDraft.start, overtimeDraft.end);
    if (!split) return null;
    const pay = nextPayPeriod(overtimeDraft.date);
    const draftEntry: OvertimeEntry = {
      id: "apercu", date: overtimeDraft.date, ...split, disposition: "paid", inputMode: "range",
      start: overtimeDraft.start, end: overtimeDraft.end, updatedAt: "",
    };
    const before = paidOvertimeForPayPeriod(pay.year, pay.month);
    const after = paidOvertimeForPayPeriod(pay.year, pay.month, [...overtimeEntries, draftEntry]);
    return {
      ready: after.ready,
      amount: after.amount - before.amount,
      payYear: pay.year,
      payMonth: pay.month,
      highRateMinutes: after.lines.find((line) => line.entryId === "apercu")?.highRateMinutes ?? 0,
      cappedMinutes: after.cappedMinutes - before.cappedMinutes,
      partTime: workQuota !== "full",
    };
  }, [overtimeDraft, overtimeEntries, paidOvertimeForPayPeriod, workQuota]);

  return { paidOvertimeForPayPeriod, overtimeEarlyCandidates, overtimeForPayMonth, overtimePayPreview };
}
