import { useMemo } from "react";
import type { Entries, FormProfile, LeavePeriod, PayProfile } from "./appModel";
import { mecenatForPayMonth, type MecenatEntry } from "./mecenat";
import type { RecoveryUse } from "./overtime";
import { computePayAllowances } from "./payAllowances";
import { monthGross, strikeDeduction } from "./payMonth";
import { defaultNetRatiosForPeriod, payCalibrationRegime } from "./payslip";
import { payslipPeriodKey } from "./payslipRateSamples";
import { RESIDENCE_ALLOWANCE_RATE, SUNDAY_ALLOWANCE } from "./planningLogic";
import { sickLeaveSummaryForYear } from "./sickLeaveSummary";
import { strikePayEstimate } from "./strike";
import { effectivePayProfile } from "./usePayActions";
import { yearPayOverview, type YearPayMonthInput } from "./yearPayOverview";

type Input = {
  year: number;
  now: Date;
  group: number;
  periods: LeavePeriod[];
  entries: Entries;
  recoveryUses: RecoveryUse[];
  mecenatEntries: MecenatEntry[];
  formProfile: FormProfile | null;
  payProfiles: Record<string, PayProfile>;
  /** Lu dans le profil de paie du mois affiché : ce qui ne change pas d'un mois à l'autre. */
  values: { isContractuel: boolean; confirmedContractuel: boolean; pasBaseAdjustment: number; deductionPayMonths?: Record<string, string> };
  /** Les heures sup payées sur une paie donnée (voir useOvertimePay). */
  paidOvertimeForPayPeriod: (year: number, month: number) => { amount: number };
};

/**
 * Les douze mois d'une année, construits avec les mêmes briques que la paie du
 * mois : le profil de paie effectif de chaque mois, les primes de l'année, la
 * maladie, la grève, les heures sup, les mécénats ; et, pour un mois dont le
 * bulletin a été vérifié, les montants réels gardés dans le compte.
 */
export function useYearPayOverview({
  year, now, group, periods, entries, recoveryUses, mecenatEntries, formProfile, payProfiles, values, paidOvertimeForPayPeriod,
}: Input) {
  return useMemo(() => {
    const { isContractuel, confirmedContractuel, pasBaseAdjustment, deductionPayMonths } = values;
    const profileFor = (month: number) => effectivePayProfile(payProfiles, year, month, formProfile || {});
    const yearProfile = profileFor(11);
    const yearBase = yearProfile.baseSalary ?? 0;
    const allowances = computePayAllowances({
      year,
      today: now,
      entries,
      periods,
      group,
      baseSalary: yearBase,
      manualAdjustments: formProfile?.manualAdjustments,
      sundayCarryover: formProfile?.sundayCarryover || 0,
      sundayCarryoverYear: formProfile?.sundayCarryoverYear,
      sundayCarryoverMonth: formProfile?.sundayCarryoverMonth,
      sundayCarryoverFromYear: formProfile?.sundayCarryoverFromYear,
      sundayCarryoverFromMonth: formProfile?.sundayCarryoverFromMonth,
      recoveryUses,
    });
    const sick = sickLeaveSummaryForYear(
      periods,
      year,
      yearBase,
      confirmedContractuel ? 0 : yearProfile.ifse ?? 0,
      yearProfile.carenceDay ?? 0,
      deductionPayMonths,
    ).byMonth;
    const samples = formProfile?.payslipRateSamples || {};
    const inputs: YearPayMonthInput[] = Array.from({ length: 12 }, (_, month) => {
      const profile = profileFor(month);
      const baseSalary = profile.baseSalary ?? 0;
      const ifse = confirmedContractuel ? 0 : profile.ifse ?? 0;
      const otherFixed = profile.otherFixed ?? (isContractuel ? baseSalary * RESIDENCE_ALLOWANCE_RATE : 0);
      const cia = confirmedContractuel ? 0 : profile.cia ?? 0;
      const slot = allowances.monthly.find((item) => item.index === month);
      const strike = strikePayEstimate(periods, group, payProfiles, year, month, { entries, recoveryUses }, deductionPayMonths);
      const sunday = slot?.sunday || 0;
      const holiday = slot?.holiday || 0;
      const compensated = slot?.compensated || 0;
      const mecenat = mecenatForPayMonth(mecenatEntries, year, month).grossAmountCents / 100;
      const gross = baseSalary > 0
        ? monthGross({
            baseSalary,
            ifse,
            otherFixed,
            cia: month === profile.ciaMonth ? cia : 0,
            monthlyFlat: SUNDAY_ALLOWANCE.monthlyFlat,
            sunday,
            holiday,
            compensated,
            sickTotal: sick[month].total,
            strikeDeduction: strikeDeduction(strike.totalDeduction),
            overtimeAmount: paidOvertimeForPayPeriod(year, month).amount,
            mecenatGross: mecenat,
          })
        : null;
      // Les taux du mois : ceux du profil s'ils sont du même régime, sinon ceux du statut.
      const regime = payCalibrationRegime(year, month);
      const defaults = defaultNetRatiosForPeriod(year, month, confirmedContractuel);
      const storedRegime = profile.netRatioRegime ?? "culture-psc";
      const stored = storedRegime === regime;
      const netRatioFixed = stored && profile.netRatioFixed && profile.netRatioFixed > 0 ? profile.netRatioFixed : defaults.netRatioFixed;
      const netRatioVariable = stored && profile.netRatioVariable && profile.netRatioVariable > 0 ? profile.netRatioVariable : defaults.netRatioVariable;
      const sample = samples[payslipPeriodKey(year, month)];
      return {
        index: month,
        estimate: gross
          ? { gross: gross.gross, grossFixed: gross.grossFixed, grossVariable: gross.grossVariable, premiums: SUNDAY_ALLOWANCE.monthlyFlat + sunday + holiday + compensated, mecenat }
          : null,
        ratios: netRatioFixed > 0 && netRatioVariable > 0
          ? {
              netRatioFixed,
              netRatioVariable,
              navigo: profile.navigo ?? 0,
              mealVoucherDeduction: profile.mealVoucherDeduction ?? 0,
              pasRate: profile.pasRate ?? 0,
              pasBaseAdjustment,
            }
          : null,
        ...(sample ? { real: { gross: sample.gross, netBeforeTax: sample.netBeforeTax } } : {}),
      };
    });
    return yearPayOverview(year, inputs, now);
  }, [year, now, group, periods, entries, recoveryUses, mecenatEntries, formProfile, payProfiles, values, paidOvertimeForPayPeriod]);
}
