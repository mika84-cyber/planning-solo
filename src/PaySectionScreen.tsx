import { PayScreen } from "./PayScreen";
import { useState } from "react";
import { PayYearOverview } from "./PayYearOverview";
import { useYearPayOverview } from "./useYearPayOverview";
import { localDate } from "./planningLogic";
import { scrollWhenReady } from "./scrollWhenReady";
import type { useCalendarDataState } from "./useCalendarDataState";
import type { useMonthPayEstimate } from "./useMonthPayEstimate";
import type { usePayActions } from "./usePayActions";
import type { usePayMonthNavigation } from "./usePayMonthNavigation";
import type { usePayProfileValues } from "./usePayProfileValues";
import type { usePayslipVerifications } from "./usePayslipVerifications";
import type { usePayUiState } from "./usePayUiState";
import type { useWorkExchangeActions } from "./useWorkExchangeActions";
import type { useWorkProfileActions } from "./useWorkProfileActions";
import type { useWorkTimeActions } from "./useWorkTimeActions";

type MonthPayEstimate = ReturnType<typeof useMonthPayEstimate>;

type Props = {
  now: Date;
  group: number;
  payUi: ReturnType<typeof usePayUiState>;
  payActions: ReturnType<typeof usePayActions>;
  /** Valeurs du profil de paie du mois affiché. */
  profile: ReturnType<typeof usePayProfileValues>;
  /** L'estimation du mois ; ses primes, déjà calculées, arrivent à part. */
  estimate: Omit<MonthPayEstimate, "allowances">;
  allowances: NonNullable<MonthPayEstimate["allowances"]>;
  calendar: Pick<ReturnType<typeof useCalendarDataState>, "formProfile" | "payProfiles" | "mecenatEntries" | "entries" | "periods" | "recoveryUses">;
  payslipVerifications: ReturnType<typeof usePayslipVerifications>;
  /** Mois affiché et glissement de la carte des primes. */
  navigation: ReturnType<typeof usePayMonthNavigation>;
  /** Férié dont le choix prime ou récupération est en cours de modification. */
  holidayChoiceEditing: string | null;
  onEditHolidayChoice: (key: string | null) => void;
  actions: Pick<ReturnType<typeof useWorkTimeActions>, "markMecenatsPaidEarly" | "deferMecenats" | "markOvertimePaidEarly">
    & Pick<ReturnType<typeof useWorkProfileActions>, "changeWorkQuota" | "changeWorkSchedule" | "changeStatus" | "saveCalculationProfile">
    & { openWorkExchange: ReturnType<typeof useWorkExchangeActions>["openNew"] };
};

/**
 * La rubrique Ma paie : relie les états et les calculs d'App.tsx à PayScreen,
 * qui construit le contenu du mois. Livrée avec les écrans différés, montée
 * seulement à l'ouverture de la rubrique, une fois les primes calculées.
 */
export function PaySectionScreen({
  now, group, payUi, payActions, profile, estimate, allowances, calendar, payslipVerifications, navigation,
  holidayChoiceEditing, onEditHolidayChoice, actions,
}: Props) {
  const { formProfile, payProfiles, mecenatEntries, entries, periods, recoveryUses } = calendar;
  const {
    isContractuel, confirmedContractuel, workQuota, payYear, hasPayValue,
    baseSalary, ifse, carenceDay, otherFixed, cia, ciaMonth, residenceAllowance,
    viewedPayRegime, netRatioFixed, netRatioVariable, payslipRateCalibration,
    navigo, mealVoucherDeduction, pasRate, pasBaseAdjustment,
    sundayCarryover, sundayCarryoverYear, sundayCarryoverMonth,
  } = profile;
  const {
    sickLeaves, overtimeForPayMonth, overtimeEarlyCandidates, mecenatForCurrentPayMonth, paidOvertimeForPayPeriod,
    strikeForCurrentPayMonth, monthPay, grossEstimateComplete, netEstimateMissing, netEstimateComplete,
    netCalculation, monthNet,
  } = estimate;
  const {
    payScreen, setPayScreen, setPayView, payProfileOpen, setPayProfileOpen,
    payProfileFocusRequested, setPayProfileFocusRequested,
    payVerificationRequested, setPayVerificationRequested,
    payMonthSlide, setPaySettingsOpen, payAdvancedOpen, setPayAdvancedOpen,
  } = payUi;
  const { changePayMonth, goPayToday, slideAllowancesMonth, startAllowancesSwipe, endAllowancesSwipe } = navigation;
  const {
    markMecenatsPaidEarly, deferMecenats, markOvertimePaidEarly,
    changeWorkQuota, changeWorkSchedule, changeStatus, saveCalculationProfile, openWorkExchange,
  } = actions;
  const { chooseHolidayPay } = payActions;
  // L'année en un coup d'œil : celle du mois affiché, changeable sur place.
  const [yearView, setYearView] = useState(() => payUi.payView.getFullYear());
  const yearOverview = useYearPayOverview({
    year: yearView,
    now,
    group,
    periods,
    entries,
    recoveryUses,
    mecenatEntries,
    formProfile,
    payProfiles,
    values: profile,
    paidOvertimeForPayPeriod,
  });
  return (
        <PayScreen
          content={{
            payUi,
            payActions,
            allowances,
            monthPay,
            sickLeaves,
            overtimeForPayMonth,
            mecenatForCurrentPayMonth,
            mecenatEntries,
            onMarkMecenatsPaidEarly: (entries, year, month) => void markMecenatsPaidEarly(entries, year, month),
            onDeferMecenats: (entries, year, month) => void deferMecenats(entries, year, month),
            overtimeEarlyCandidates,
            onMarkOvertimePaidEarly: (entries) => void markOvertimePaidEarly(entries),
            // Devant un écart du bulletin : le statut, ou les choix de
            // compensation des fériés, se corrigent sans quitter la paie.
            onChangeStatus: changeStatus,
            onOpenHolidayChoices: () => {
              setPayScreen("allowances");
              scrollWhenReady("holiday-choices");
            },
            strikeForCurrentPayMonth,
            netCalculation,
            monthNet,
            grossEstimateComplete,
            netEstimateMissing,
            payProfiles,
            payYear,
            hasPayValue,
            viewedPayRegime,
            payslipRateCalibration,
            isContractuel,
            confirmedContractuel,
            workQuota,
            baseSalary,
            residenceAllowance,
            ifse,
            otherFixed,
            cia,
            ciaMonth,
            carenceDay,
            navigo,
            mealVoucherDeduction,
            pasRate,
            netRatioFixed,
            netRatioVariable,
            pasBaseAdjustment,
            sundayCarryover,
            sundayCarryoverMonth,
            sundayCarryoverYear,
            payslipVerifications,
            fullName: formProfile?.fullName,
            signature: formProfile?.signature,
            changePayMonth,
            goPayToday,
          }}
          allowances={allowances}
          holidayChoiceEditing={holidayChoiceEditing}
          onEditHolidayChoice={onEditHolidayChoice}
          onChooseHolidayPay={chooseHolidayPay}
          onExchangeHoliday={(key) => openWorkExchange(key)}
          yearContent={
            <PayYearOverview
              overview={yearOverview}
              onYearChange={setYearView}
              onOpenMonth={(month) => {
                // Un mois s'ouvre sur son détail du calcul.
                setPayView(localDate(yearView, month, 1));
                setPayScreen("payslip");
              }}
            />
          }
          page={{
            screen: payScreen,
            profileOpen: payProfileOpen,
            profileFocusRequested: payProfileFocusRequested,
            settingsOpen: payAdvancedOpen,
            workQuota: formProfile?.workQuota,
            workSchedule: formProfile?.workSchedule,
            status: formProfile?.status,
            netEstimateComplete: netEstimateComplete,
            missingFields: netEstimateMissing,
            onCompleteEstimate: () => { setPaySettingsOpen(true); setPayAdvancedOpen(true); },
            verificationRequested: payVerificationRequested,
            onVerificationShown: () => setPayVerificationRequested(false),
            monthSlide: payMonthSlide,
            onScreenChange: setPayScreen,
            onToggleProfile: () => setPayProfileOpen((current) => !current),
            onProfileFocused: () => setPayProfileFocusRequested(false),
            onToggleSettings: () => {
              // Les éléments de paie s'affichent d'emblée : un niveau de moins à ouvrir.
              setPaySettingsOpen(true);
              setPayAdvancedOpen((current) => !current);
            },
            onWorkQuotaChange: changeWorkQuota,
            onWorkScheduleChange: changeWorkSchedule,
            onStatusChange: changeStatus,
            onSaveProfile: () => void saveCalculationProfile(),
            onPreviousMonth: () => slideAllowancesMonth(-1),
            onNextMonth: () => slideAllowancesMonth(1),
            onToday: goPayToday,
            onTouchStart: startAllowancesSwipe,
            onTouchEnd: endAllowancesSwipe,
          }}
        />
  );
}
