import { Suspense } from "react";
import { DeferredSection } from "./DeferredSection";
import { PayEstimateDetails, PayslipCheckSection } from "./appSections";
import type { PayslipCheckSectionProps } from "./PayslipCheckSection";
import type { PayCalculationBreakdown } from "./PayEstimateDetails";
import type { PayDashboardVariable } from "./PayDashboard";
import type { usePayUiState } from "./usePayUiState";
import type { usePayActions } from "./usePayActions";
import type { monthGross } from "./payMonth";
import type { calculatePaidOvertime, WorkQuota } from "./overtime";
import { minutesLabel } from "./overtime";
import type { mecenatForPayMonth } from "./mecenat";
import type { StrikePayEstimate } from "./strike";
import type { sickLeaveSummaryForYear } from "./sickLeaveSummary";
import type { inspectNetRatioCalibration } from "./payslip";
import {
  isUnplannedPayslipCarence,
  summarizePayslipReview,
} from "./payslipReview";
import { euros, type PayCalibrationRegime, type PayProfile } from "./appModel";
import { MONTHS, SUNDAY_ALLOWANCE, s } from "./planningLogic";

/** Les primes de l'année affichée, réduites à ce que la paie du mois en lit. */
type PayAllowancesSummary = {
  year: number;
  compensatedYear: number;
  monthly: Array<{
    index: number;
    sunday: number;
    sundayCount: number;
    holiday: number;
    holidayCount: number;
    compensated: number;
    compensatedCount: number;
    carryover: number;
    reported: number;
    total: number;
  }>;
};

/** La paie du mois affiché, telle que l'assemble l'écran de paie. */
type MonthPaySummary = {
  index: number;
  flat: number;
  sunday: number;
  sundayCount: number;
  carryover: number;
  reported: number;
  holiday: number;
  holidayCount: number;
  compensated: number;
  compensatedCount: number;
  sick: number;
  sickDays: number;
  strike: number;
  strikeDays: number;
  strikeDeductedDays: number;
  strikeAutomaticDays: number;
  strikePotentialDays: number;
  cia: number;
} & ReturnType<typeof monthGross>;

type PaidOvertimeSummary = { performedMonth: number; performedYear: number } & ReturnType<
  typeof calculatePaidOvertime
>;

/** Le net estimé du mois, ou `null` tant que les taux manquent. */
type NetCalculation = {
  netFromGross: number;
  estimatedContributions: number;
  mealVouchers: number;
  netBeforeTax: number;
  incomeTax: number;
  net: number;
};

export type PayContentInput = {
  payUi: ReturnType<typeof usePayUiState>;
  payActions: ReturnType<typeof usePayActions>;
  allowances: PayAllowancesSummary | null;
  monthPay: MonthPaySummary | null;
  sickLeaves: ReturnType<typeof sickLeaveSummaryForYear> | null;
  overtimeForPayMonth: PaidOvertimeSummary;
  mecenatForCurrentPayMonth: ReturnType<typeof mecenatForPayMonth>;
  strikeForCurrentPayMonth: StrikePayEstimate;
  netCalculation: NetCalculation | null;
  monthNet: number | null;
  grossEstimateComplete: boolean;
  netEstimateMissing: string[];
  payProfiles: Record<string, PayProfile>;
  payYear: string;
  hasPayValue: (field: keyof PayProfile) => boolean;
  viewedPayRegime: PayCalibrationRegime;
  payslipRateCalibration: ReturnType<typeof inspectNetRatioCalibration>;
  isContractuel: boolean;
  workQuota: WorkQuota;
  baseSalary: number;
  residenceAllowance: number | undefined;
  ifse: number;
  otherFixed: number;
  cia: number;
  ciaMonth: number | undefined;
  carenceDay: number;
  navigo: number;
  mealVoucherDeduction: number;
  pasRate: number;
  netRatioFixed: number;
  netRatioVariable: number;
  sundayCarryover: number;
  sundayCarryoverMonth: number | undefined;
  sundayCarryoverYear: number | undefined;
  demoMode: boolean;
  userEmail: string;
  changePayMonth: (delta: 1 | -1) => void;
  goPayToday: () => void;
};

/** Assemble l'écran de paie du mois : estimation, vérification, réglages. */
export function buildPayContent({
  payUi,
  payActions,
  allowances,
  monthPay,
  sickLeaves,
  overtimeForPayMonth,
  mecenatForCurrentPayMonth,
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
  sundayCarryover,
  sundayCarryoverMonth,
  sundayCarryoverYear,
  demoMode,
  userEmail,
  changePayMonth,
  goPayToday,
}: PayContentInput) {
  const {
    payView,
    payslipCheck,
    payslipError,
    payslipHelpOpen,
    setPayslipHelpOpen,
    payslipImportBusy,
    payslipImportMode,
    payslipImportError,
    payslipImportResult,
    payslipNeedsPeriod,
    payslipFallbackMonth,
    setPayslipFallbackMonth,
    payslipFallbackYear,
    setPayslipFallbackYear,
    payslipResultDetailsOpen,
    setPayslipResultDetailsOpen,
    payslipRateSamples,
    paySettingsOpen,
    setPaySettingsOpen,
    payDrafts,
    setPayDrafts,
    savingPay,
  } = payUi;
  const {
    importPayslips,
    applyPayslipFallbackPeriod,
    grossForMonth,
    reportMissingSundays,
    nextSundayPayoutSlot,
    clearSundayCarryover,
    savePayAmount,
    saveAnnualPayProfile,
    saveCiaMonth,
  } = payActions;

  if (!allowances || !monthPay || !sickLeaves) return null;
  const missing = netEstimateMissing.length > 0;
  const showPayslipHelp = payslipHelpOpen;
  /* Seules les primes qui varient d'un mois à l'autre sont détaillées : le
     traitement, l'IFSE et les éléments fixes se retrouvent dans le brut sans
     qu'il soit utile de les répéter chaque mois. */
  const monthPayRows = [
    monthPay.sundayCount || monthPay.reported
      ? {
          key: "sundays",
          label: `Dimanches (${monthPay.sundayCount})`,
          detail: monthPay.carryover
            ? `dont ${monthPay.carryover} reporté${s(monthPay.carryover)} du bulletin précédent`
            : monthPay.reported
              ? `${monthPay.reported} pas encore payé${s(monthPay.reported)}, en attente sur un prochain bulletin`
              : `${monthPay.sundayCount} × ${euros(SUNDAY_ALLOWANCE.perSunday)}`,
          amount: monthPay.sunday,
        }
      : null,
    monthPay.holidayCount
      ? {
          key: "holidays",
          label: `Jours fériés (${monthPay.holidayCount})`,
          detail: monthPay.holiday
            ? "travaillés le mois précédent"
            : "compensation à décider",
          amount: monthPay.holiday,
        }
      : null,
    monthPay.compensatedCount
      ? {
          key: "compensated",
          label: `Fériés compensés (${monthPay.compensatedCount})`,
          detail: monthPay.compensated
            ? `non travaillés en ${allowances.compensatedYear}`
            : `non travaillés en ${allowances.compensatedYear}, compensation à décider`,
          amount: monthPay.compensated,
        }
      : null,
    monthPay.cia
      ? {
          key: "cia",
          label: "CIA",
          detail: "complément indemnitaire annuel",
          amount: monthPay.cia,
        }
      : null,
    overtimeForPayMonth.totalMinutes
      ? {
          key: "overtime",
          label: `Heures supplémentaires (${minutesLabel(
            overtimeForPayMonth.totalMinutes,
          )})`,
          detail: overtimeForPayMonth.ready
            ? `effectuées en ${MONTHS[overtimeForPayMonth.performedMonth]} · base ${euros(
                overtimeForPayMonth.hourlyBase,
              )}/h${workQuota === "full" ? " · majorations appliquées" : " · règle temps partiel"}`
            : "traitement de base à compléter pour calculer le montant",
          amount: overtimeForPayMonth.ready
            ? overtimeForPayMonth.amount
            : null,
        }
      : null,
    mecenatForCurrentPayMonth.lines.length
      ? {
          key: "mecenat",
          label: `Mécénats (${mecenatForCurrentPayMonth.lines.length})`,
          detail: `${minutesLabel(mecenatForCurrentPayMonth.totalMinutes)} · tarifs réglementaires fixes`,
          amount: mecenatForCurrentPayMonth.grossAmountCents / 100,
        }
      : null,
    monthPay.sickDays
      ? {
          key: "sick",
          label: `Arrêt maladie (${monthPay.sickDays} j)`,
          detail: "carence et retenue de 10 %",
          amount: -monthPay.sick,
        }
      : null,
    monthPay.strikeDeductedDays || monthPay.strikePotentialDays
      ? {
          key: "strike",
          label: `Grève (${monthPay.strikeDeductedDays} journée${s(monthPay.strikeDeductedDays)} retenue${s(monthPay.strikeDeductedDays)})`,
          detail:
            strikeForCurrentPayMonth.dailyDeduction === null
                ? "traitement et indemnité de résidence antérieurs à compléter"
                : strikeForCurrentPayMonth.potentialAdditionalDays.length
                  ? `Attention : ${strikeForCurrentPayMonth.potentialAdditionalDays.length} jour${s(strikeForCurrentPayMonth.potentialAdditionalDays.length)} intermédiaire${s(strikeForCurrentPayMonth.potentialAdditionalDays.length)} à vérifier. Les repos noirs encadrés sont inclus automatiquement ; les autres absences restent hors retenue tant qu’elles ne sont pas confirmées. ${strikeForCurrentPayMonth.exactMonthValues ? "Valeurs exactes du mois." : strikeForCurrentPayMonth.sourcePeriod ? `Dernières valeurs connues : ${strikeForCurrentPayMonth.sourcePeriod}.` : ""}`
                  : `retenue au 1/30 · ${euros(strikeForCurrentPayMonth.dailyDeduction)} brut par jour${strikeForCurrentPayMonth.automaticAdditionalDays.length ? ` · ${strikeForCurrentPayMonth.automaticAdditionalDays.length} repos noir${s(strikeForCurrentPayMonth.automaticAdditionalDays.length)} encadré${s(strikeForCurrentPayMonth.automaticAdditionalDays.length)} inclus` : ""} · ${strikeForCurrentPayMonth.exactMonthValues ? "valeurs exactes du mois" : "dernières valeurs antérieures connues"}`,
          amount:
            strikeForCurrentPayMonth.totalDeduction !== null
              ? -strikeForCurrentPayMonth.totalDeduction
              : null,
        }
      : null,
    // Jamais prélevés en décembre (confirmé sur les bulletins de 2024 et
    // 2025) : signalé ici comme les autres lignes qui varient d'un mois
    // sur l'autre, plutôt que de laisser deviner pourquoi le net grimpe.
    monthPay.index === 11 && mealVoucherDeduction
      ? {
          key: "mealVoucher",
          label: "Titres repas",
          detail: "jamais prélevés en décembre",
          amount: mealVoucherDeduction,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  const comparablePayslip =
    payslipCheck?.reading.month !== undefined &&
    payslipCheck.reading.year === allowances.year &&
    payslipCheck.reading.month === payView.getMonth();
  const payslipMonth = comparablePayslip
    ? (payslipCheck.reading.month as number)
    : payView.getMonth();
  const unplannedPayslipCarence = comparablePayslip && isUnplannedPayslipCarence(
    payslipCheck.reading.carenceDay,
    sickLeaves.byMonth[payslipMonth]?.days || 0,
  );
  const payslipExpectedSundays = comparablePayslip
    ? allowances.monthly.find(
        (slot) => slot.index === payslipMonth,
      )?.sundayCount || 0
    : 0;
  const payslipReview = comparablePayslip
    ? summarizePayslipReview([
        {
          key: "gross",
          label: "Cumul brut",
          found: payslipCheck.reading.gross,
          expected: grossForMonth(payslipMonth),
        },
        ...(netCalculation?.netBeforeTax !== undefined
          ? [{
              key: "net-before-tax",
              label: "Net avant impôt",
              found: payslipCheck.reading.netBeforeTax,
              expected: netCalculation.netBeforeTax,
              tolerance: 0.5,
            }]
          : []),
        {
          key: "base",
          label: "Traitement de base",
          found: payslipCheck.reading.baseSalary,
          expected: baseSalary,
        },
        ...(residenceAllowance !== undefined
          ? [{
              key: "residence",
              label: "Indemnité de résidence",
              found: payslipCheck.reading.residenceAllowance,
              expected: residenceAllowance,
            }]
          : []),
        ...(!isContractuel
          ? [
              {
                key: "ifse",
                label: "IFSE",
                found: payslipCheck.reading.ifse,
                expected: ifse,
              },
            ]
          : []),
        ...(otherFixed || payslipCheck.reading.otherFixed !== undefined
          ? [{
              key: "other-fixed",
              label: "Autres éléments fixes",
              found: payslipCheck.reading.otherFixed,
              expected: otherFixed,
            }]
          : []),
        ...(monthPay.cia || payslipCheck.reading.cia !== undefined
          ? [{
              key: "cia",
              label: "CIA",
              found: payslipCheck.reading.cia,
              expected: monthPay.cia,
            }]
          : []),
        ...(navigo || payslipCheck.reading.navigo !== undefined
          ? [{
              key: "navigo",
              label: "Remboursement Navigo",
              found: payslipCheck.reading.navigo,
              expected: navigo,
            }]
          : []),
        ...((netCalculation?.mealVouchers || 0) || payslipCheck.reading.mealVoucherDeduction !== undefined
          ? [{
              key: "meal-vouchers",
              label: "Titres repas",
              found: payslipCheck.reading.mealVoucherDeduction,
              expected: netCalculation?.mealVouchers || 0,
            }]
          : []),
        ...(pasRate || payslipCheck.reading.pasRate !== undefined
          ? [{
              key: "pas-rate",
              label: "Taux d’imposition (PAS)",
              found: payslipCheck.reading.pasRate,
              expected: pasRate,
              tolerance: 0.01,
            }]
          : []),
        {
          key: "sundays",
          label: "Dimanches payés",
          found: payslipCheck.reading.sundaysBeyondTen,
          expected: payslipExpectedSundays,
          tolerance: 1,
        },
        ...(unplannedPayslipCarence
          ? [
              {
                key: "carence",
                label: "Jour de carence non prévu",
                found: payslipCheck.reading.carenceDay,
                expected: 0,
              },
            ]
          : []),
        ...(overtimeForPayMonth.totalMinutes
          ? [
              {
                key: "overtime",
                label: "Heures supplémentaires",
                found: undefined,
                expected: overtimeForPayMonth.amount,
              },
            ]
          : []),
        ...(mecenatForCurrentPayMonth.totalMinutes
          ? [
              {
                key: "mecenat",
                label: "Mécénats",
                found: undefined,
                expected:
                  mecenatForCurrentPayMonth.grossAmountCents / 100,
              },
            ]
          : []),
      ])
    : null;
  const payReliability = !grossEstimateComplete
    ? {
        tone: "incomplete" as const,
        label: "Données à compléter",
        detail: "Certaines valeurs nécessaires au calcul de la paie sont encore manquantes.",
      }
    : payslipReview?.tone === "ok"
      ? {
          tone: "exact" as const,
          label: "Valeurs vérifiées avec le bulletin",
          detail: `Les lignes lisibles du bulletin de ${MONTHS[monthPay.index]} ${allowances.year} correspondent à l’estimation.`,
        }
      : payslipReview?.tone === "partial"
        ? {
            tone: "estimated" as const,
            label: "Vérification partielle",
            detail: `${payslipReview.verified.length} ligne${s(payslipReview.verified.length)} vérifiée${s(payslipReview.verified.length)} ; des lignes restent non comparables et le net estimé n’est donc pas présenté comme confirmé.`,
          }
      : payProfiles[payYear]
        ? {
            tone: "estimated" as const,
            label: "Valeurs enregistrées pour cette année",
            detail: `Estimation calculée avec le profil de paie ${payYear}.`,
          }
        : {
            tone: "estimated" as const,
            label: "Estimation avec les dernières valeurs connues",
            detail: "Le montant sera recalculé lorsqu’un bulletin plus récent sera renseigné.",
          };

  const otherFixedWithoutResidence =
    residenceAllowance === undefined ? otherFixed : otherFixed - residenceAllowance;
  const grossDeductionRows = monthPayRows
    .filter((row) => row.key === "sick" || row.key === "strike")
    .map((row) => ({
      ...row,
      amount: row.amount === null ? null : Math.abs(row.amount),
    }));
  const payCalculation: PayCalculationBreakdown = {
    grossComposition: [
      {
        key: "base",
        label: isContractuel ? "Traitement de base" : "Traitement indiciaire",
        detail: "montant mensuel enregistré",
        amount: hasPayValue("baseSalary") ? baseSalary : null,
      },
      residenceAllowance !== undefined
        ? {
            key: "residence",
            label: "Indemnité de résidence",
            detail: isContractuel && !hasPayValue("residenceAllowance")
              ? "3 % du traitement de base"
              : "valeur enregistrée",
            amount: residenceAllowance,
          }
        : null,
      !isContractuel && (ifse || hasPayValue("ifse"))
        ? { key: "ifse", label: "IFSE", detail: "indemnité mensuelle", amount: ifse }
        : null,
      otherFixedWithoutResidence
        ? {
            key: "other-fixed",
            label: "Autres éléments fixes",
            detail: residenceAllowance === undefined ? "total enregistré" : "hors indemnité de résidence",
            amount: otherFixedWithoutResidence,
          }
        : null,
      {
        key: "sunday-flat",
        label: "Forfait mensuel de dimanches",
        detail: "montant fixe déjà inclus dans l’estimation",
        amount: SUNDAY_ALLOWANCE.monthlyFlat,
      },
      monthPay.cia
        ? { key: "cia", label: "CIA", detail: "complément indemnitaire annuel", amount: monthPay.cia }
        : null,
      monthPay.sundayCount
        ? { key: "sundays", label: `Dimanches (${monthPay.sundayCount})`, detail: monthPay.carryover ? `dont ${monthPay.carryover} reporté${s(monthPay.carryover)}` : "prime calculée", amount: monthPay.sunday }
        : null,
      monthPay.holidayCount
        ? { key: "holidays", label: `Jours fériés (${monthPay.holidayCount})`, detail: monthPay.holiday ? "compensation choisie" : "compensation à décider", amount: monthPay.holiday || null }
        : null,
      monthPay.compensatedCount
        ? { key: "compensated", label: `Fériés compensés (${monthPay.compensatedCount})`, detail: monthPay.compensated ? "compensation choisie" : "compensation à décider", amount: monthPay.compensated || null }
        : null,
      overtimeForPayMonth.totalMinutes
        ? { key: "overtime", label: "Heures supplémentaires payées", detail: minutesLabel(overtimeForPayMonth.totalMinutes), amount: overtimeForPayMonth.ready ? overtimeForPayMonth.amount : null }
        : null,
      mecenatForCurrentPayMonth.lines.length
        ? { key: "mecenat", label: "Mécénats", detail: minutesLabel(mecenatForCurrentPayMonth.totalMinutes), amount: mecenatForCurrentPayMonth.grossAmountCents / 100 }
        : null,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    grossDeductions: grossDeductionRows,
    grossBeforeDeductions: monthPay.gross + monthPay.sick + monthPay.strike,
    variableAdditions: monthPay.grossVariable,
    netRatioFixed,
    netRatioVariable,
    estimatedContributions: netCalculation?.estimatedContributions ?? null,
    navigo,
    mealVoucherDeduction: netCalculation?.mealVouchers ?? 0,
    netBeforeTax: netCalculation?.netBeforeTax ?? null,
    pasRate,
    incomeTax: netCalculation?.incomeTax ?? null,
    totalDeductions: netCalculation
      ? monthPay.sick + monthPay.strike + netCalculation.estimatedContributions + netCalculation.mealVouchers + netCalculation.incomeTax
      : null,
  };

  const payEstimateDetails = (
    <Suspense fallback={<DeferredSection label="la paie" />}>
    <PayEstimateDetails
      monthIndex={monthPay.index}
      year={allowances.year}
      gross={monthPay.gross}
      grossEstimateComplete={grossEstimateComplete}
      net={monthNet}
      calculation={payCalculation}
      overtime={overtimeForPayMonth}
      workQuota={workQuota}
      mecenat={mecenatForCurrentPayMonth}
      reliability={payReliability}
      onPreviousMonth={() => changePayMonth(-1)}
      onNextMonth={() => changePayMonth(1)}
      onToday={goPayToday}
    />
    </Suspense>
  );
  const payslipSectionProps: Omit<PayslipCheckSectionProps, "part"> = {
    accountId: demoMode ? "demo" : userEmail,
    payYear,
    hasPayProfile: Boolean(payProfiles[payYear]),
    helpOpen: showPayslipHelp,
    setHelpOpen: setPayslipHelpOpen,
    missing,
    isContractuel,
    importBusy: payslipImportBusy,
    importMode: payslipImportMode,
    importError: payslipImportError,
    importResult: payslipImportResult,
    onImport: (files, importMode) => void importPayslips(files, importMode),
    check: payslipCheck,
    checkError: payslipError,
    needsPeriod: payslipNeedsPeriod,
    fallbackMonth: payslipFallbackMonth,
    setFallbackMonth: setPayslipFallbackMonth,
    fallbackYear: payslipFallbackYear,
    setFallbackYear: setPayslipFallbackYear,
    onApplyFallbackPeriod: applyPayslipFallbackPeriod,
    allowances,
    displayedMonth: payView.getMonth(),
    review: payslipReview,
    unplannedCarence: unplannedPayslipCarence,
    resultDetailsOpen: payslipResultDetailsOpen,
    setResultDetailsOpen: setPayslipResultDetailsOpen,
    grossForMonth,
    baseSalary,
    ifse,
    overtime: overtimeForPayMonth,
    mecenat: mecenatForCurrentPayMonth,
    onReportMissingSundays: (year, month, missingSundays) =>
      void reportMissingSundays(year, month, missingSundays),
    nextSundayPayout: nextSundayPayoutSlot,
    sundayCarryover,
    sundayCarryoverMonth,
    sundayCarryoverYear,
    onClearSundayCarryover: () => void clearSundayCarryover(),
    rateSamples: payslipRateSamples,
    rateCalibration: payslipRateCalibration,
    sickLeaves,
    paySettingsOpen,
    setPaySettingsOpen,
    missingFields: netEstimateMissing,
    carenceDay,
    otherFixed,
    cia,
    netRatioFixed,
    netRatioVariable,
    navigo,
    mealVoucherDeduction,
    pasRate,
    payDrafts,
    setPayDrafts,
    savingPay,
    onSavePayAmount: (field) => void savePayAmount(field),
    onCreatePayProfile: () => saveAnnualPayProfile({
      baseSalary,
      residenceAllowance,
      ifse,
      carenceDay,
      otherFixed,
      cia,
      ciaMonth,
      netRatioFixed,
      netRatioVariable,
      netRatioRegime: viewedPayRegime,
      navigo,
      mealVoucherDeduction,
      pasRate,
    }),
    ciaMonth,
    onSaveCiaMonth: (month) => void saveCiaMonth(month),
  };

  const variables: PayDashboardVariable[] = monthPayRows.map((row) => ({
    key: row.key,
    label: row.label,
    quantity: row.detail,
    amount: row.amount,
  }));

  return {
    gross: monthPay.gross,
    grossComplete: grossEstimateComplete,
    net: monthNet,
    profileLabel: payProfiles[payYear]
      ? `Estimation réalisée avec votre profil de paie ${payYear}.`
      : "Estimation réalisée avec les dernières valeurs connues.",
    reliability: payReliability,
    variables,
    estimateContent: payEstimateDetails,
    verificationContent: <PayslipCheckSection {...payslipSectionProps} part="verification" />,
    settingsContent: <PayslipCheckSection {...payslipSectionProps} part="settings" />,
  };}
