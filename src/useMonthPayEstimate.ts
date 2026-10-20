import { useMemo } from "react";
import type { Entries, FormProfile, LeavePeriod, PayProfile } from "./appModel";
import { roundCurrency } from "./appModel";
import { mecenatForPayMonth, type MecenatEntry } from "./mecenat";
import {
  allocateRecoveryUses,
  holidayRecoveryEntries,
  monthlyRecoveryBalance,
  type OvertimeEntry,
  type RecoveryUse,
} from "./overtime";
import { computePayAllowances, holidayRecoverySources } from "./payAllowances";
import { payEstimateReadiness, type PayEstimateField } from "./payEstimate";
import { monthGross, strikeDeduction } from "./payMonth";
import { SUNDAY_ALLOWANCE, dateKey, fromKey, getDayInfo } from "./planningLogic";
import { sickLeaveSummaryForYear } from "./sickLeaveSummary";
import { strikePayEstimate } from "./strike";
import { useOvertimePay } from "./useOvertimePay";
import type { PayProfileValues } from "./usePayProfileValues";
import type { OvertimeDraft } from "./useWorkTimeUiState";

type MonthPayEstimateInput = {
  periods: LeavePeriod[];
  entries: Entries;
  group: number;
  /** La date du jour : décide des dimanches déjà passés et des reports. */
  now: Date;
  /** Le mois de paie affiché dans Ma paie. */
  payView: Date;
  formProfile: FormProfile | null;
  payProfiles: Record<string, PayProfile>;
  recoveryUses: RecoveryUse[];
  overtimeEntries: OvertimeEntry[];
  mecenatEntries: MecenatEntry[];
  overtimeDraft: OvertimeDraft;
  /** Les valeurs du profil pour ce mois (voir src/usePayProfileValues.ts). */
  values: PayProfileValues;
};

/**
 * La paie estimée du mois affiché : primes de dimanches et de fériés,
 * maladie, grève, heures supplémentaires, mécénats, puis le brut, le net et
 * ce qui manque encore à l'estimation. Les crédits de récupération y sont
 * aussi, puisqu'ils naissent des mêmes heures et fériés.
 */
export function useMonthPayEstimate({
  periods,
  entries,
  group,
  now,
  payView,
  formProfile,
  payProfiles,
  recoveryUses,
  overtimeEntries,
  mecenatEntries,
  overtimeDraft,
  values,
}: MonthPayEstimateInput) {
  const {
    isContractuel,
    workQuota,
    hasPayValue,
    baseSalary,
    ifse,
    carenceDay,
    otherFixed,
    cia,
    ciaMonth,
    netRatioFixed,
    netRatioVariable,
    navigo,
    mealVoucherDeduction,
    pasRate,
    pasBaseAdjustment,
    sundayCarryover,
    sundayCarryoverYear,
    sundayCarryoverMonth,
    sundayCarryoverFromYear,
    sundayCarryoverFromMonth,
    deductionPayMonths,
  } = values;

  /* Les arrêts maladie de l'année affichée.
   *
   *  Un arrêt vaut une carence, et un arrêt est une suite de jours consécutifs
   *  — pas une période enregistrée : poser douze jours depuis « Choisir
   *  plusieurs dates » crée douze périodes d'un jour, qui ne font pourtant
   *  qu'un seul arrêt. Deux arrêts séparés dans le mois donnent bien deux
   *  carences.
   */
  const sickLeaves = useMemo(() => {
    return sickLeaveSummaryForYear(
      periods,
      payView.getFullYear(),
      baseSalary,
      ifse,
      carenceDay,
      deductionPayMonths,
    );
  }, [payView, periods, baseSalary, ifse, carenceDay, deductionPayMonths]);

  /* Les dimanches et fériés réellement travaillés d'une année, plus les
   *  fériés compensés.
   *
   *  Un dimanche ne compte que s'il est prévu au cycle, non férié (les
   *  dimanches fériés relèvent de l'autre indemnité) et non posé en congé. Un
   *  férié ne compte que s'il est travaillé, ce que `getDayInfo` tranche déjà
   *  en renvoyant « off » pour les fériés toujours fermés et ceux qui tombent
   *  sur un repos ou une formation.
   *
   *  Un férié « compensé » est l'inverse : le cycle ne le fait pas travailler,
   *  mais la veille était travaillée — c'est le décalage d'un jour entre les
   *  deux maisons, Pompidou fermant le mardi et le Grand Palais le lundi. Ces
   *  fériés-là sont payés en prime seule, sur la paie de février de l'année
   *  suivante. C'est déjà la définition qui marque les fériés « offerts » sur
   *  les plannings PDF.
   */

  /* Ce qui tombera sur chacune des douze paies de l'année affichée.
   *
   *  Deux décalages à respecter : les dimanches de décembre sont payés en
   *  janvier de l'année suivante, et un férié est payé le mois suivant. La
   *  paie de janvier porte donc du décembre de l'année précédente, qu'il faut
   *  aller chercher.
   */
  const allowances = useMemo(
    () =>
      computePayAllowances({
        year: payView.getFullYear(),
        today: now,
        entries,
        periods,
        group,
        baseSalary,
        manualAdjustments: formProfile?.manualAdjustments,
        sundayCarryover,
        sundayCarryoverYear,
        sundayCarryoverMonth,
        sundayCarryoverFromYear,
        sundayCarryoverFromMonth,
        recoveryUses,
      }),
    [
    payView,
    group,
    entries,
    periods,
    baseSalary,
    now,
    sundayCarryover,
    sundayCarryoverYear,
    sundayCarryoverMonth,
    sundayCarryoverFromYear,
    sundayCarryoverFromMonth,
    formProfile?.manualAdjustments,
    recoveryUses,
  ]);

  const holidayRecoveryEarnings = useMemo(
    () => holidayRecoveryEntries(holidayRecoverySources(entries, group, dateKey(now))),
    [entries, group, now],
  );
  const unresolvedHolidayRecoveryCount = useMemo(
    () => Object.values(entries).filter((entry) =>
      entry.holidayPay === "recovery" && !entry.holidayRecoveryMinutes
    ).length,
    [entries],
  );
  const recoveryEarnings = useMemo(
    () => [...overtimeEntries, ...holidayRecoveryEarnings],
    [overtimeEntries, holidayRecoveryEarnings],
  );
  const recoveryBalance = useMemo(
    () => monthlyRecoveryBalance(recoveryEarnings, recoveryUses, (key) => {
      const date = fromKey(key);
      return date.getDay() === 0 || Boolean(getDayInfo(date, group).holiday);
    }),
    [recoveryEarnings, recoveryUses, group],
  );
  const recoveryEarningStates = useMemo(
    () =>
      new Map(
        allocateRecoveryUses(recoveryEarnings, recoveryUses, (key) => {
          const date = fromKey(key);
          return date.getDay() === 0 || Boolean(getDayInfo(date, group).holiday);
        }).map((item) => [
          item.entryId,
          item,
        ]),
      ),
    [recoveryEarnings, recoveryUses, group],
  );

  // Le paiement des heures supplémentaires vit dans son propre hook, avec
  // ses dépendances déclarées (voir src/useOvertimePay.ts).
  const { paidOvertimeForPayPeriod, overtimeEarlyCandidates, overtimeForPayMonth, overtimePayPreview } = useOvertimePay({
    overtimeEntries, payProfiles, formProfile, workQuota, group, payView, overtimeDraft,
  });

  const mecenatForCurrentPayMonth = useMemo(
    () => mecenatForPayMonth(mecenatEntries, payView.getFullYear(), payView.getMonth()),
    [mecenatEntries, payView],
  );
  const strikeForCurrentPayMonth = useMemo(
    () =>
      strikePayEstimate(
        periods,
        group,
        payProfiles,
        payView.getFullYear(),
        payView.getMonth(),
        { entries, recoveryUses },
        deductionPayMonths,
      ),
    [periods, group, payProfiles, payView, entries, recoveryUses, deductionPayMonths],
  );

  /* La paie du mois affiché : les primes de ce mois-là, retenues déduites.
     C'est la question qu'on se pose en ouvrant un mois. */
  const monthPay = useMemo(() => {
    if (!allowances || !sickLeaves) return null;
    const index = payView.getMonth();
    const month = allowances.monthly.find((slot) => slot.index === index);
    // Maladie et grève se retiennent à l'identique quel que soit le statut
    // (voir src/payMonth.ts) : seules l'IFSE et le CIA sont réservés aux
    // fonctionnaires.
    const sick = sickLeaves.byMonth[index];
    const strikeMonthDeduction = strikeDeduction(
      strikeForCurrentPayMonth.totalDeduction,
    );
    const sunday = month?.sunday || 0;
    const holiday = month?.holiday || 0;
    const compensated = month?.compensated || 0;
    return {
      index,
      flat: SUNDAY_ALLOWANCE.monthlyFlat,
      sunday,
      sundayCount: month?.sundayCount || 0,
      carryover: month?.carryover || 0,
      reported: month?.reported || 0,
      carriedFrom: month?.carriedFrom,
      reportedTo: month?.reportedTo,
      holiday,
      holidayCount: month?.holidayCount || 0,
      compensated,
      compensatedCount: month?.compensatedCount || 0,
      sick: sick.total,
      sickDays: sick.days,
      sickHalfPayDays: sick.halfPayDays,
      strike: strikeMonthDeduction,
      strikeDays: strikeForCurrentPayMonth.days.length,
      strikeDeductedDays:
        strikeForCurrentPayMonth.days.length +
        strikeForCurrentPayMonth.automaticAdditionalDays.length,
      strikeAutomaticDays: strikeForCurrentPayMonth.automaticAdditionalDays.length,
      strikePotentialDays: strikeForCurrentPayMonth.potentialAdditionalDays.length,
      cia: index === ciaMonth ? cia : 0,
      ...monthGross({
        baseSalary,
        ifse,
        otherFixed,
        cia: index === ciaMonth ? cia : 0,
        monthlyFlat: SUNDAY_ALLOWANCE.monthlyFlat,
        sunday,
        holiday,
        compensated,
        sickTotal: sick.total,
        strikeDeduction: strikeMonthDeduction,
        overtimeAmount: overtimeForPayMonth.amount,
        mecenatGross: mecenatForCurrentPayMonth.grossAmountCents / 100,
      }),
    };
  }, [
    allowances,
    sickLeaves,
    payView,
    baseSalary,
    ifse,
    otherFixed,
    cia,
    ciaMonth,
    overtimeForPayMonth,
    mecenatForCurrentPayMonth,
    strikeForCurrentPayMonth,
  ]);

  /* Le forfait dominical existe même lorsque le traitement n'a jamais été
   * renseigné. L'afficher seul comme « brut estimé » donnerait donc un
   * montant précis mais trompeur. Le calcul reste intact et n'est présenté
   * qu'une fois les éléments fixes indispensables connus. */
  const availablePayEstimateFields = new Set<PayEstimateField>(
    (["baseSalary", "ifse", "otherFixed", "carenceDay", "pasRate"] as const)
      .filter((field) => hasPayValue(field)),
  );
  const estimateReadiness = payEstimateReadiness({
    isContractuel,
    availableFields: availablePayEstimateFields,
    sickDays: monthPay?.sickDays || 0,
  });
  const strikeEstimateReady =
    !(strikeForCurrentPayMonth.days.length + strikeForCurrentPayMonth.automaticAdditionalDays.length) ||
    strikeForCurrentPayMonth.totalDeduction !== null;
  const strikeMissing =
    strikeForCurrentPayMonth.days.length + strikeForCurrentPayMonth.automaticAdditionalDays.length && !strikeEstimateReady
      ? ["traitement et indemnité de résidence connus avant la grève"]
      : [];
  const grossEstimateComplete = estimateReadiness.grossReady && strikeEstimateReady;
  const netEstimateMissing = [...estimateReadiness.netMissing, ...strikeMissing];
  const netEstimateComplete = estimateReadiness.netReady && strikeEstimateReady;

  /** Le net estimé du mois affiché : cotisations d'abord, avec deux taux —
   *  le traitement porte la pension civile, les primes non —, puis l'impôt à
   *  part, pour qu'un changement de taux se corrige sans tout recalibrer.
   *  `null` tant que les taux ne sont pas renseignés. */
  const netCalculation =
    netEstimateComplete &&
    monthPay &&
    netRatioFixed > 0 &&
    netRatioVariable > 0
      ? (() => {
          const netFromGross = roundCurrency(
            monthPay.grossFixed * (netRatioFixed / 100) +
            monthPay.grossVariable * (netRatioVariable / 100),
          );
          // Jamais prélevés en décembre, confirmé sur les bulletins de 2024
          // et 2025 : la ligne « Titres repas carte » y est absente.
          const mealVouchers = monthPay.index === 11 ? 0 : mealVoucherDeduction;
          const netBeforeTax = roundCurrency(netFromGross + navigo - mealVouchers);
          const incomeTax = roundCurrency(netBeforeTax * (pasRate / 100) * pasBaseAdjustment);
          return {
            netFromGross,
            estimatedContributions: roundCurrency(monthPay.gross - netFromGross),
            mealVouchers,
            netBeforeTax,
            incomeTax,
            net: roundCurrency(netBeforeTax - incomeTax),
          };
        })()
      : null;
  const monthNet = netCalculation?.net ?? null;

  return {
    sickLeaves,
    allowances,
    holidayRecoveryEarnings,
    unresolvedHolidayRecoveryCount,
    recoveryEarnings,
    recoveryBalance,
    recoveryEarningStates,
    paidOvertimeForPayPeriod,
    overtimeEarlyCandidates,
    overtimeForPayMonth,
    overtimePayPreview,
    mecenatForCurrentPayMonth,
    strikeForCurrentPayMonth,
    monthPay,
    grossEstimateComplete,
    netEstimateMissing,
    netEstimateComplete,
    netCalculation,
    monthNet,
  };
}
