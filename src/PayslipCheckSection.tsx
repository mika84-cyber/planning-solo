import type { PayslipVerificationRecord, PayslipVerificationRecords } from "./payslipVerificationRecords";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { NetRatioCalibration } from "./payslip";
import type { MecenatEntry } from "./mecenat";
import type { OvertimeEntry } from "./overtime";
import type { PayslipReviewSummary } from "./payslipReview";
import type { PayslipGapExplanation } from "./payslipGapExplanation";
import type {
  PayDraftKey,
  PayslipCheck,
  PayslipImportResult,
} from "./usePayUiState";
import { PayslipSettingsSections } from "./PayslipSettingsSections";
import { PayslipVerificationCard } from "./PayslipVerificationCard";

type AllowancesSummary = {
  year: number;
  monthly: Array<{ index: number; sundayCount: number }>;
};

type OvertimeSummary = { totalMinutes: number; amount: number };
type SickLeavesSummary = {
  total: number;
  arrets: Array<{
    id: string;
    from: string;
    to: string;
    days: number;
    reducedDays: number;
    halfPayDays?: number;
    total: number;
  }>;
};

export type PayslipCheckSectionProps = {
  part: "verification" | "settings";
  payYear: string;
  /** Décisions « Tout est OK » ou anomalie, bulletin par bulletin. */
  verificationRecords: PayslipVerificationRecords;
  onSaveVerification: (record: PayslipVerificationRecord) => void;
  onRemoveVerification: (year: number, month: number) => void;
  hasPayProfile: boolean;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  missing: boolean;
  isContractuel: boolean;
  importBusy: boolean;
  importMode: "verify" | "calibrate" | null;
  importError: string;
  importResult: PayslipImportResult | null;
  /** « add-page » ajoute une page au bulletin qui vient d'être vérifié. */
  onImport: (files: File[], mode: "verify" | "calibrate" | "add-page") => void;
  check: PayslipCheck | null;
  checkError: string;
  needsPeriod: boolean;
  /** Une première photo lue : l'autre page du bulletin est attendue. */
  photoPending: boolean;
  /** « Il n'y a pas d'autre page » : la vérification se termine avec ce qui est lu. */
  onFinishPhotos: () => void;
  fallbackMonth: number;
  setFallbackMonth: (month: number) => void;
  fallbackYear: number;
  setFallbackYear: (year: number) => void;
  onApplyFallbackPeriod: () => void;
  allowances: AllowancesSummary;
  displayedMonth: number;
  review: PayslipReviewSummary | null;
  /** D'où vient l'écart, du brut jusqu'au net, quand le bulletin se compare. */
  gapExplanation?: PayslipGapExplanation | null;
  /** Le nom et la signature de l'agent, pour le courrier à la hiérarchie. */
  fullName?: string;
  signature?: string;
  unplannedCarence: boolean;
  grossForMonth: (month: number) => number;
  baseSalary: number;
  ifse: number;
  overtime: OvertimeSummary;
  /** Tous les mécénats, pour retrouver ceux qu'un bulletin a payés en avance. */
  mecenatEntries?: MecenatEntry[];
  onMarkMecenatsPaidEarly?: (entries: MecenatEntry[], year: number, month: number) => void;
  /** Heures « à payer » d'un mois que la paie suivante attend encore, avec
   *  leur montant : un bulletin qui en paie plus a pu les régler en avance. */
  overtimeEarlyCandidates?: (year: number, month: number) => Array<{ entry: OvertimeEntry; cents: number }>;
  onMarkOvertimePaidEarly?: (entries: OvertimeEntry[]) => void;
  /** Devant un écart du bulletin, les gestes proposés (voir payslipGapChoices). */
  onApplyPayslipValue: (field: PayDraftKey, value: number) => void;
  onDeferMecenats?: (entries: MecenatEntry[], year: number, month: number) => void;
  onChangeStatus?: (status: "fonctionnaire" | "contractuel") => void;
  onOpenHolidayChoices?: () => void;
  /** Fériés travaillés dont la compensation reste à décider. */
  holidayPending?: number;
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
  onCreatePayProfile: () => Promise<void>;
  ciaMonth?: number;
  onSaveCiaMonth: (month: number) => void;
  /** Retire un bulletin mal lu des taux (sous son mois « AAAA-MM »). */
  onRemoveRateSample: (period: string) => void;
};

export function PayslipCheckSection({
  part,
  payYear,
  verificationRecords,
  onSaveVerification,
  onRemoveVerification,
  hasPayProfile,
  helpOpen: showPayslipHelp,
  setHelpOpen: setPayslipHelpOpen,
  missing,
  isContractuel,
  importBusy: payslipImportBusy,
  importMode: payslipImportMode,
  importError: payslipImportError,
  importResult: payslipImportResult,
  onImport: importPayslips,
  check: payslipCheck,
  checkError: payslipError,
  needsPeriod: payslipNeedsPeriod,
  photoPending,
  onFinishPhotos,
  fallbackMonth: payslipFallbackMonth,
  setFallbackMonth: setPayslipFallbackMonth,
  fallbackYear: payslipFallbackYear,
  setFallbackYear: setPayslipFallbackYear,
  onApplyFallbackPeriod: applyPayslipFallbackPeriod,
  allowances,
  displayedMonth,
  review: payslipReview,
  gapExplanation,
  fullName,
  signature,
  unplannedCarence: unplannedPayslipCarence,
  baseSalary,
  ifse,
  overtime: overtimeForPayMonth,
  mecenatEntries,
  onMarkMecenatsPaidEarly,
  overtimeEarlyCandidates,
  onMarkOvertimePaidEarly,
  onApplyPayslipValue,
  onDeferMecenats,
  onChangeStatus,
  onOpenHolidayChoices,
  holidayPending,
  onReportMissingSundays: reportMissingSundays,
  nextSundayPayout: nextSundayPayoutSlot,
  sundayCarryover,
  sundayCarryoverMonth,
  sundayCarryoverYear,
  onClearSundayCarryover: clearSundayCarryover,
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
  onCreatePayProfile,
  ciaMonth,
  onSaveCiaMonth: saveCiaMonth,
  onRemoveRateSample,
  rateCalibration: payslipRateCalibration,
}: PayslipCheckSectionProps) {
  const [creatingPayProfile, setCreatingPayProfile] = useState(false);
  const createPayProfile = async () => {
    setCreatingPayProfile(true);
    try {
      await onCreatePayProfile();
    } finally {
      setCreatingPayProfile(false);
    }
  };
  const verificationCard = (
    <PayslipVerificationCard
      verificationRecords={verificationRecords}
      onSaveVerification={onSaveVerification}
      onRemoveVerification={onRemoveVerification}
      importBusy={payslipImportBusy}
      importMode={payslipImportMode}
      importError={payslipImportError}
      importResult={payslipImportResult}
      onImport={importPayslips}
      check={payslipCheck}
      checkError={payslipError}
      needsPeriod={payslipNeedsPeriod}
      photoPending={photoPending}
      onFinishPhotos={onFinishPhotos}
      fallbackMonth={payslipFallbackMonth}
      setFallbackMonth={setPayslipFallbackMonth}
      fallbackYear={payslipFallbackYear}
      setFallbackYear={setPayslipFallbackYear}
      onApplyFallbackPeriod={applyPayslipFallbackPeriod}
      allowances={allowances}
      displayedMonth={displayedMonth}
      review={payslipReview}
      gapExplanation={gapExplanation}
      fullName={fullName}
      signature={signature}
      unplannedCarence={unplannedPayslipCarence}
      overtime={overtimeForPayMonth}
      mecenatEntries={mecenatEntries}
      onMarkMecenatsPaidEarly={onMarkMecenatsPaidEarly}
      overtimeEarlyCandidates={overtimeEarlyCandidates}
      onMarkOvertimePaidEarly={onMarkOvertimePaidEarly}
      onApplyPayslipValue={onApplyPayslipValue}
      onDeferMecenats={onDeferMecenats}
      onChangeStatus={onChangeStatus}
      onOpenHolidayChoices={onOpenHolidayChoices}
      holidayPending={holidayPending}
      onReportMissingSundays={reportMissingSundays}
      nextSundayPayout={nextSundayPayoutSlot}
      sundayCarryover={sundayCarryover}
      sundayCarryoverMonth={sundayCarryoverMonth}
      sundayCarryoverYear={sundayCarryoverYear}
      onClearSundayCarryover={clearSundayCarryover}
      rateCalibration={payslipRateCalibration}
      netRatioFixed={netRatioFixed}
      netRatioVariable={netRatioVariable}
    />
  );

  if (part === "verification") return verificationCard;

  return (
      <div className="pay-dashboard-settings-stack">
        {!hasPayProfile ? (
          <div className="pay-year-notice">
            <button type="button" className="secondary-button" disabled={creatingPayProfile} onClick={() => void createPayProfile()}>
              {creatingPayProfile ? "Actualisation…" : `Utiliser ces valeurs pour ${payYear}`}
            </button>
          </div>
        ) : null}

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
              remplir ces valeurs automatiquement.
            </p>
            {!isContractuel ? (
              <p className="allowance-note">
                Pour un fonctionnaire, s’y ajoutent l’IFSE et le CIA.
              </p>
            ) : null}
            {/* Les montants d'un bulletin vérifié sont gardés dans le compte :
                les suivants peuvent venir lors d'autres visites. */}
            <p className="allowance-note">
              Dès le premier bulletin, l’application cale ses deux taux net
              avant impôt (traitement et primes) sur votre net réel. Chaque
              bulletin vérifié ensuite les affine ; un bulletin d’un autre mois
              où vos primes diffèrent (plus ou moins de dimanches, par exemple)
              lui permet de distinguer le taux du traitement de celui des
              primes. Vérifiez-les un par un, le même jour ou plus tard : les
              montants de chaque bulletin restent gardés dans votre compte.
              Plusieurs fichiers choisis ensemble sont lus comme les pages d’un
              seul bulletin.
            </p>
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
          rateCalibration={payslipRateCalibration}
          onRemoveRateSample={onRemoveRateSample}
        />
      </div>
  );
}
