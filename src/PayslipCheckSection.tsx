import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { NetRatioCalibration } from "./payslip";
import type { PayslipReviewSummary } from "./payslipReview";
import type {
  PayDraftKey,
  PayslipCheck,
  PayslipImportResult,
} from "./usePayUiState";
import { PayslipCalibrationCard } from "./PayslipCalibrationCard";
import { PayslipSettingsSections } from "./PayslipSettingsSections";
import { PayslipVerificationCard } from "./PayslipVerificationCard";

type AllowancesSummary = {
  year: number;
  monthly: Array<{ index: number; sundayCount: number }>;
};

type OvertimeSummary = { totalMinutes: number; amount: number };
type MecenatSummary = { totalMinutes: number; grossAmountCents: number };
type SickLeavesSummary = {
  total: number;
  arrets: Array<{
    id: string;
    from: string;
    to: string;
    days: number;
    reducedDays: number;
    total: number;
  }>;
};

export type PayslipCheckSectionProps = {
  payYear: string;
  hasPayProfile: boolean;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  missing: boolean;
  estimateDetails: ReactNode;
  isContractuel: boolean;
  importBusy: boolean;
  importMode: "verify" | "calibrate" | null;
  importError: string;
  importResult: PayslipImportResult | null;
  onImport: (files: File[], mode: "verify" | "calibrate") => void;
  check: PayslipCheck | null;
  checkError: string;
  needsPeriod: boolean;
  fallbackMonth: number;
  setFallbackMonth: (month: number) => void;
  fallbackYear: number;
  setFallbackYear: (year: number) => void;
  onApplyFallbackPeriod: () => void;
  allowances: AllowancesSummary;
  displayedMonth: number;
  review: PayslipReviewSummary | null;
  unplannedCarence: boolean;
  resultDetailsOpen: boolean;
  setResultDetailsOpen: Dispatch<SetStateAction<boolean>>;
  grossForMonth: (month: number) => number;
  baseSalary: number;
  ifse: number;
  overtime: OvertimeSummary;
  mecenat: MecenatSummary;
  onReportMissingSundays: (year: number, month: number, missing: number) => void;
  nextSundayPayout: (year: number, month: number) => { year: number; month: number } | null;
  sundayCarryover: number;
  sundayCarryoverMonth?: number;
  sundayCarryoverYear?: number;
  onClearSundayCarryover: () => void;
  rateSamples: PayslipCheck[];
  rateCalibration: NetRatioCalibration;
  sickLeaves: SickLeavesSummary;
  paySettingsOpen: boolean;
  setPaySettingsOpen: Dispatch<SetStateAction<boolean>>;
  missingFields: string[];
  carenceDay: number;
  otherFixed: number;
  cia: number;
  netRatioFixed: number;
  netRatioVariable: number;
  navigo: number;
  mealVoucherDeduction: number;
  pasRate: number;
  payDrafts: Record<PayDraftKey, string>;
  setPayDrafts: Dispatch<SetStateAction<Record<PayDraftKey, string>>>;
  savingPay: PayDraftKey | null;
  onSavePayAmount: (field: PayDraftKey) => void;
  ciaMonth?: number;
  onSaveCiaMonth: (month: number) => void;
};

export function PayslipCheckSection({
  payYear,
  hasPayProfile,
  helpOpen: showPayslipHelp,
  setHelpOpen: setPayslipHelpOpen,
  missing,
  estimateDetails: payEstimateDetails,
  isContractuel,
  importBusy: payslipImportBusy,
  importMode: payslipImportMode,
  importError: payslipImportError,
  importResult: payslipImportResult,
  onImport: importPayslips,
  check: payslipCheck,
  checkError: payslipError,
  needsPeriod: payslipNeedsPeriod,
  fallbackMonth: payslipFallbackMonth,
  setFallbackMonth: setPayslipFallbackMonth,
  fallbackYear: payslipFallbackYear,
  setFallbackYear: setPayslipFallbackYear,
  onApplyFallbackPeriod: applyPayslipFallbackPeriod,
  allowances,
  displayedMonth,
  review: payslipReview,
  unplannedCarence: unplannedPayslipCarence,
  resultDetailsOpen: payslipResultDetailsOpen,
  setResultDetailsOpen: setPayslipResultDetailsOpen,
  grossForMonth,
  baseSalary,
  ifse,
  overtime: overtimeForPayMonth,
  mecenat: mecenatForCurrentPayMonth,
  onReportMissingSundays: reportMissingSundays,
  nextSundayPayout: nextSundayPayoutSlot,
  sundayCarryover,
  sundayCarryoverMonth,
  sundayCarryoverYear,
  onClearSundayCarryover: clearSundayCarryover,
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
  onSavePayAmount: savePayAmount,
  ciaMonth,
  onSaveCiaMonth: saveCiaMonth,
}: PayslipCheckSectionProps) {
  return (
      <div className="request-archive-content allowances pay-functions-layout">
        <p className="pay-year-notice">
          Paramètres de paie pour <strong>{payYear}</strong>
          {hasPayProfile
            ? " — valeurs enregistrées pour cette année."
            : " — valeurs actuelles utilisées comme point de départ ; la première modification créera l’historique de cette année."}
        </p>

        {showPayslipHelp ? (
          <section className="allowance-card">
            <header>
              <span>Comment ça marche</span>
              {!missing ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setPayslipHelpOpen(false)}
                >
                  Masquer
                </button>
              ) : null}
            </header>
            <p className="allowance-note">
              Estimer votre salaire en brut et en net demande des informations
              qui n’existent que sur un vrai bulletin de paie : le traitement
              de base (votre rémunération hors primes), le montant exact d’un
              jour de carence lors d’un arrêt maladie, et quelques lignes
              fixes plus rares (indemnité de résidence…). Un bulletin peut
              remplir ces valeurs automatiquement. Deux bulletins de mois
              différents permettent aussi d’affiner séparément le taux du
              traitement et celui des primes.
            </p>
            {!isContractuel ? (
              <p className="allowance-note">
                Pour un fonctionnaire, s’y ajoutent l’IFSE et le CIA.
              </p>
            ) : null}
            <p className="allowance-note">
              Le PDF est lu uniquement sur cet appareil et n’est jamais
              conservé. Seules les valeurs utiles à vos estimations sont
              enregistrées dans votre espace Planning Solo.
            </p>
          </section>
        ) : (
          <p className="allowance-note">
            <button
              type="button"
              className="text-button"
              onClick={() => setPayslipHelpOpen(true)}
            >
              Comment ça marche ?
            </button>
          </p>
        )}

        {payEstimateDetails}

        <PayslipVerificationCard
          importBusy={payslipImportBusy}
          importMode={payslipImportMode}
          importError={payslipImportError}
          importResult={payslipImportResult}
          onImport={importPayslips}
          check={payslipCheck}
          checkError={payslipError}
          needsPeriod={payslipNeedsPeriod}
          fallbackMonth={payslipFallbackMonth}
          setFallbackMonth={setPayslipFallbackMonth}
          fallbackYear={payslipFallbackYear}
          setFallbackYear={setPayslipFallbackYear}
          onApplyFallbackPeriod={applyPayslipFallbackPeriod}
          allowances={allowances}
          displayedMonth={displayedMonth}
          review={payslipReview}
          unplannedCarence={unplannedPayslipCarence}
          resultDetailsOpen={payslipResultDetailsOpen}
          setResultDetailsOpen={setPayslipResultDetailsOpen}
          grossForMonth={grossForMonth}
          baseSalary={baseSalary}
          ifse={ifse}
          overtime={overtimeForPayMonth}
          mecenat={mecenatForCurrentPayMonth}
          onReportMissingSundays={reportMissingSundays}
          nextSundayPayout={nextSundayPayoutSlot}
          sundayCarryover={sundayCarryover}
          sundayCarryoverMonth={sundayCarryoverMonth}
          sundayCarryoverYear={sundayCarryoverYear}
          onClearSundayCarryover={clearSundayCarryover}
        />

        <PayslipCalibrationCard
          importBusy={payslipImportBusy}
          importMode={payslipImportMode}
          importError={payslipImportError}
          onImport={importPayslips}
          rateSamples={payslipRateSamples}
          rateCalibration={payslipRateCalibration}
        />

        <PayslipSettingsSections
          allowances={allowances}
          isContractuel={isContractuel}
          sickLeaves={sickLeaves}
          paySettingsOpen={paySettingsOpen}
          setPaySettingsOpen={setPaySettingsOpen}
          missing={missing}
          missingFields={netEstimateMissing}
          baseSalary={baseSalary}
          ifse={ifse}
          carenceDay={carenceDay}
          otherFixed={otherFixed}
          cia={cia}
          netRatioFixed={netRatioFixed}
          netRatioVariable={netRatioVariable}
          navigo={navigo}
          mealVoucherDeduction={mealVoucherDeduction}
          pasRate={pasRate}
          payDrafts={payDrafts}
          setPayDrafts={setPayDrafts}
          savingPay={savingPay}
          onSavePayAmount={savePayAmount}
          ciaMonth={ciaMonth}
          onSaveCiaMonth={saveCiaMonth}
        />
      </div>
  );
}
