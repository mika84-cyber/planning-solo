import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { PayslipSuccessCelebration } from "./PayslipSuccessCelebration";
import { PayslipWarningEffect } from "./PayslipWarningEffect";
import { euros } from "./appModel";
import type { NetRatioCalibration } from "./payslip";
import type { PayslipReviewSummary } from "./payslipReview";
import {
  MONTHS,
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  periodLabel,
  s,
} from "./planningLogic";
import { minutesLabel } from "./overtime";
import type {
  PayDraftKey,
  PayslipCheck,
  PayslipImportResult,
} from "./usePayUiState";

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

type PayslipCheckSectionProps = {
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

          <section className="allowance-card pay-function-card payslip-verify-card">
            <header>
              <div>
                <span className="step-label">Contrôler une fiche réelle</span>
                <h3>Vérifier un bulletin</h3>
                <small>Pour voir si rien ne manque</small>
              </div>
              <small>Un seul PDF suffit</small>
            </header>
            <div className="payslip-guide-step active">
              <span className="payslip-guide-number">1</span>
              <div>
                <strong>Choisir le bulletin à vérifier</strong>
                <small>Son mois et son année seront reconnus automatiquement.</small>
              </div>
              <label className="payslip-drop">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={payslipImportBusy}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (files.length) void importPayslips(files, "verify");
                  }}
                />
                <span>
                  {payslipImportBusy && payslipImportMode === "verify"
                    ? "Lecture en cours…"
                    : "Choisir le PDF"}
                </span>
              </label>
            </div>
            {payslipCheck && !payslipNeedsPeriod && payslipCheck.reading.month !== undefined && payslipCheck.reading.year !== undefined ? (
              <>
                <div className="payslip-detected-period" role="status">
                  <span>Période reconnue</span>
                  <strong>{MONTHS[payslipCheck.reading.month]} {payslipCheck.reading.year}</strong>
                </div>
                {payslipCheck.reading.gross !== undefined ||
                payslipCheck.reading.netBeforeTax !== undefined ? (
                  <div className="payslip-actual-values" aria-label="Valeurs réellement lues sur le bulletin">
                    <span>Valeurs du bulletin</span>
                    {payslipCheck.reading.gross !== undefined ? (
                      <div>
                        <small>Brut réel</small>
                        <strong>{euros(payslipCheck.reading.gross)}</strong>
                      </div>
                    ) : null}
                    {payslipCheck.reading.netBeforeTax !== undefined ? (
                      <div>
                        <small>Net avant impôt réel</small>
                        <strong>{euros(payslipCheck.reading.netBeforeTax)}</strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            {payslipCheck && payslipNeedsPeriod ? (
              <div className="payslip-period-fallback">
                <div>
                  <strong>Période non reconnue</strong>
                  <small>Indiquez exceptionnellement le mois et l’année de ce bulletin.</small>
                </div>
                <ChoicePicker
                  value={payslipFallbackMonth}
                  options={MONTH_OPTIONS}
                  onChange={setPayslipFallbackMonth}
                  ariaLabel="Mois du bulletin"
                  className="payslip-month-picker"
                />
                <ChoicePicker
                  value={payslipFallbackYear}
                  options={YEAR_OPTIONS}
                  onChange={setPayslipFallbackYear}
                  ariaLabel="Année du bulletin"
                  className="payslip-year-picker"
                />
                <button type="button" className="secondary-button" onClick={applyPayslipFallbackPeriod}>
                  Utiliser cette période
                </button>
              </div>
            ) : null}
            {payslipImportMode === "verify" && payslipImportError ? (
              <p className="allowance-note warn">{payslipImportError}</p>
            ) : null}
            {payslipImportMode === "verify" && payslipImportResult ? (
              <>
                <p className="allowance-note">
                  {payslipImportResult.applied.length} champ
                  {s(payslipImportResult.applied.length)} rempli
                  {s(payslipImportResult.applied.length)} :{" "}
                  {payslipImportResult.applied
                    .map((item) => `${item.label} (${item.value})`)
                    .join(", ")}
                  .
                </p>
                {payslipImportResult.missing.length ? (
                  <p className="allowance-note warn">
                    Pas trouvé sur ces bulletins :{" "}
                    {payslipImportResult.missing.join(", ")}.
                  </p>
                ) : null}
                {payslipImportResult.adjustment ? (
                  <p className="allowance-note positive">
                    {payslipImportResult.adjustment}
                  </p>
                ) : null}
              </>
            ) : null}
            {payslipError ? (
              <p className="allowance-note warn">{payslipError}</p>
            ) : null}
            {payslipCheck ? (
            payslipCheck.reading.month === undefined ||
            payslipCheck.reading.year !== allowances.year ||
            payslipCheck.reading.month !== displayedMonth ? (
              <p className="allowance-note warn">
                Ce bulletin
                {payslipCheck.reading.month !== undefined
                  ? ` porte ${MONTHS[payslipCheck.reading.month]} ${payslipCheck.reading.year}`
                  : " n’indique pas sa période"}{" "}
                mais sa période ne correspond pas encore au mois affiché.
                Réessayez ou indiquez sa période manuellement.
              </p>
            ) : (
            <>
              {payslipReview?.tone === "ok" ? (
                <PayslipSuccessCelebration
                  key={`${payslipCheck.name}-${payslipCheck.reading.year}-${payslipCheck.reading.month}`}
                />
              ) : null}
              {payslipReview?.tone === "warning" ? (
                <PayslipWarningEffect
                  key={`${payslipCheck.name}-${payslipCheck.reading.year}-${payslipCheck.reading.month}`}
                />
              ) : null}
              {payslipReview ? (
                <div className={`payslip-result-summary ${payslipReview.tone}`}>
                  <span className="payslip-result-icon" aria-hidden="true">
                    {payslipReview.tone === "ok" ? "✓" : payslipReview.tone === "warning" ? "!" : "?"}
                  </span>
                  <div>
                    <strong>{payslipReview.verdict}</strong>
                    <small>
                      {payslipReview.verified.length} contrôle
                      {s(payslipReview.verified.length)} fiable
                      {s(payslipReview.verified.length)} effectué
                      {s(payslipReview.verified.length)}
                      {payslipReview.unavailable.length
                        ? ` · ${payslipReview.unavailable.length} non vérifiable${s(payslipReview.unavailable.length)}`
                        : ""}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setPayslipResultDetailsOpen((current) => !current)
                    }
                    aria-expanded={payslipResultDetailsOpen}
                  >
                    {payslipResultDetailsOpen ? "Masquer le détail" : "Voir le détail"}
                  </button>
                </div>
              ) : null}
              {unplannedPayslipCarence ? (
                <p className="allowance-note warn">
                  Jour de carence de {euros(payslipCheck.reading.carenceDay as number)} présent sur le bulletin, mais aucun arrêt maladie n’était prévu dans l’application pour ce mois.
                </p>
              ) : null}
              {payslipResultDetailsOpen ? (
                <>
              <table className="allowance-table">
                <thead>
                  <tr>
                    <th scope="col">Ligne</th>
                    <th scope="col">Bulletin</th>
                    <th scope="col">Appli</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      {
                        key: "gross",
                        label: "Cumul brut",
                        found: payslipCheck.reading.gross,
                        computed: grossForMonth(payslipCheck.reading.month),
                      },
                      {
                        key: "base",
                        label: "Traitement de base",
                        found: payslipCheck.reading.baseSalary,
                        computed: baseSalary,
                      },
                      {
                        key: "ifse",
                        label: "IFSE",
                        found: payslipCheck.reading.ifse,
                        computed: ifse,
                      },
                      ...(overtimeForPayMonth.totalMinutes
                        ? [
                            {
                              key: "overtime",
                              label: `Heures supplémentaires (${minutesLabel(
                                overtimeForPayMonth.totalMinutes,
                              )})`,
                              found: undefined,
                              computed: overtimeForPayMonth.amount,
                            },
                          ]
                        : []),
                      ...(mecenatForCurrentPayMonth.totalMinutes
                        ? [
                            {
                              key: "mecenat",
                              label: `Mécénats (${minutesLabel(
                                mecenatForCurrentPayMonth.totalMinutes,
                              )})`,
                              found: undefined,
                              computed:
                                mecenatForCurrentPayMonth.grossAmountCents / 100,
                            },
                          ]
                        : []),
                    ] as const
                  ).map((row) => {
                    const gap =
                      row.found === undefined
                        ? null
                        : Math.abs(row.found - row.computed);
                    return (
                      <tr key={row.key}>
                        <th scope="row">
                          {row.label}
                          {gap === null ? (
                            <small>absent du bulletin</small>
                          ) : gap < 0.05 ? (
                            <small>concorde</small>
                          ) : (
                            <small className="gap">
                              écart de {euros(gap)}
                            </small>
                          )}
                        </th>
                        <td>
                          {row.found === undefined ? "—" : euros(row.found)}
                        </td>
                        <td className={gap !== null && gap >= 0.05 ? "pending" : ""}>
                          {euros(row.computed)}
                        </td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const found = payslipCheck.reading.sundaysBeyondTen;
                    const expected =
                      allowances.monthly.find(
                        (slot) => slot.index === payslipCheck.reading.month,
                      )?.sundayCount || 0;
                    const missing = expected - found;
                    return (
                      <tr>
                        <th scope="row">
                          Dimanches comptés
                          {missing === 0 ? (
                            <small>concorde</small>
                          ) : missing > 0 ? (
                            <small className="gap">
                              {missing} manquant{s(missing)}
                            </small>
                          ) : (
                            <small className="gap">
                              {-missing} de plus qu’attendu
                            </small>
                          )}
                        </th>
                        <td>{found}</td>
                        <td className={missing !== 0 ? "pending" : ""}>
                          {expected}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              {overtimeForPayMonth.totalMinutes ? (
                <p className="allowance-note">
                  {minutesLabel(overtimeForPayMonth.totalMinutes)} sont attendues
                  sur ce bulletin pour un montant brut estimé de {euros(
                    overtimeForPayMonth.amount,
                  )}. La ligne du PDF n’est pas encore reconnue de façon assez
                  fiable : vérifiez-la visuellement sur le bulletin.
                </p>
              ) : null}
              {mecenatForCurrentPayMonth.totalMinutes ? (
                <p className="allowance-note">
                  {minutesLabel(mecenatForCurrentPayMonth.totalMinutes)} de mécénat
                  sont attendues sur ce bulletin pour {euros(
                    mecenatForCurrentPayMonth.grossAmountCents / 100,
                  )} brut. La ligne du PDF n’est pas reconnue de façon assez
                  fiable : vérifiez-la visuellement sur le bulletin.
                </p>
              ) : null}
              <p className="allowance-note">
                {payslipCheck.name} · comparé à{" "}
                {MONTHS[payslipCheck.reading.month]} {payslipCheck.reading.year}
                . Un écart de quelques centimes vient des arrondis ; au-delà, il
                y a une vraie différence à comprendre.
              </p>
              {(() => {
                const found = payslipCheck.reading.sundaysBeyondTen;
                const expected =
                  allowances.monthly.find(
                    (slot) => slot.index === payslipCheck.reading.month,
                  )?.sundayCount || 0;
                const missing = expected - found;
                if (missing <= 0) return null;
                const target = nextSundayPayoutSlot(
                  payslipCheck.reading.year,
                  payslipCheck.reading.month,
                );
                if (!target) return null;
                return (
                  <p className="allowance-note">
                    {missing} dimanche{s(missing)} pas encore payé
                    {s(missing)}, sans doute pour un délai de traitement.{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        void reportMissingSundays(
                          payslipCheck.reading.year as number,
                          payslipCheck.reading.month as number,
                          missing,
                        )
                      }
                    >
                      Reporter sur {MONTHS[target.month]} {target.year}
                    </button>
                  </p>
                );
              })()}
                </>
              ) : null}
            </>
            )
          ) : null}
          {sundayCarryover > 0 &&
          sundayCarryoverMonth !== undefined &&
          sundayCarryoverYear !== undefined ? (
            <p className="allowance-note">
              {sundayCarryover} dimanche{s(sundayCarryover)} en attente sur{" "}
              {MONTHS[sundayCarryoverMonth]} {sundayCarryoverYear}.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => void clearSundayCarryover()}
              >
                Retirer le report
              </button>
            </p>
          ) : null}
          </section>

        <section className="allowance-card pay-function-card payslip-calibration-card">
          <header>
            <div>
              <span className="step-label">Améliorer la précision</span>
              <h3>Affiner mes estimations</h3>
              <small>Pour remplir automatiquement les éléments de paie</small>
            </div>
            <small>Facultatif</small>
          </header>
          <p className="allowance-note">
            Sélectionnez ensemble au moins deux bulletins de mois différents.
            Ils servent uniquement à distinguer plus précisément le taux du
            traitement de celui des primes ; les PDF ne sont pas conservés.
          </p>
          <label className="payslip-drop payslip-calibration-drop">
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={payslipImportBusy}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                if (files.length) void importPayslips(files, "calibrate");
              }}
            />
            <span>
              {payslipImportBusy && payslipImportMode === "calibrate"
                ? "Analyse en cours…"
                : "Choisir plusieurs bulletins"}
            </span>
          </label>
          {payslipImportMode === "calibrate" && payslipImportError ? (
            <p className="allowance-note warn">{payslipImportError}</p>
          ) : null}
          {payslipRateSamples.length ? (
            <div className={`payslip-calibration-status ${payslipRateCalibration.reason}`} role="status">
              <strong>
                {payslipRateCalibration.reason === "ready"
                  ? "Taux affinés automatiquement"
                  : payslipRateCalibration.reason === "not-enough-variation"
                    ? "Bulletins trop similaires"
                    : payslipRateCalibration.reason === "inconsistent"
                      ? "Calcul encore trop incertain"
                      : `${payslipRateCalibration.usableCount} bulletin${s(payslipRateCalibration.usableCount)} utilisable${s(payslipRateCalibration.usableCount)}`}
              </strong>
              <small>
                {payslipRateCalibration.reason === "ready"
                  ? "Les taux du traitement et des primes ont été mis à jour."
                  : "Il faut au moins deux mois lisibles avec des montants de primes différents."}
              </small>
            </div>
          ) : null}
        </section>

        {/* La retenue (un jour de carence puis 10 %/jour) est une règle de
            fonctionnaire ; le régime d'une contractuelle (IJSS, subrogation)
            est différent et n'est pas vérifié ici. */}
        {!isContractuel && sickLeaves.arrets.length > 0 && (
          <section className="allowance-card">
            <header>
              <span>Arrêts maladie {allowances.year}</span>
              <strong className="negative">−{euros(sickLeaves.total)}</strong>
            </header>
            <table className="allowance-table">
              <tbody>
                {sickLeaves.arrets.map((arret) => (
                  <tr key={arret.id}>
                    <th scope="row">
                      {periodLabel(arret.from, arret.to)}
                      <small>
                        {arret.days} jour{s(arret.days)} · carence +{" "}
                        {arret.reducedDays} à 10 %
                      </small>
                    </th>
                    <td className="negative">−{euros(arret.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="allowance-card pay-function-card pay-elements-card">
          <header>
            <div>
              <span className="step-label">Références utilisées par les calculs</span>
              <h3>Éléments de paie</h3>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setPaySettingsOpen((current) => !current)}
              aria-expanded={paySettingsOpen}
            >
              {paySettingsOpen ? "Replier" : missing ? "À compléter" : "Voir"}
            </button>
          </header>
          {paySettingsOpen ? (
            <>
          {missing ? (
            <p className="allowance-note warn">
              Information{netEstimateMissing.length > 1 ? "s" : ""} encore
              manquante{netEstimateMissing.length > 1 ? "s" : ""} : {netEstimateMissing.join(", ")}.
              Un bulletin lisible peut les remplir automatiquement.
            </p>
          ) : null}
          <div className="pay-field-grid">
          {(
            [
              {
                field: "baseSalary" as const,
                label: "Traitement de base",
                value: baseSalary,
                hint: "Ex. 1855,88",
                use: "primes de férié et retenue maladie",
              },
              {
                field: "ifse" as const,
                label: "IFSE",
                value: ifse,
                hint: "Ex. 416,66",
                use: "retenue maladie",
              },
              {
                field: "carenceDay" as const,
                label: "Jour de carence",
                value: carenceDay,
                hint: "Ex. 78,17",
                use: "à recopier du bulletin",
              },
              {
                field: "otherFixed" as const,
                label: isContractuel
                  ? "Indemnité de résidence"
                  : "Autres éléments fixes",
                value: otherFixed,
                hint: isContractuel ? "3 % du traitement, déjà calculée" : "Ex. 75,84",
                use: isContractuel
                  ? "3 % du traitement de base ; ne modifiez que si votre bulletin montre un autre montant"
                  : "résidence + SMIC comp. + ICHCSG + MGEN − transfert",
              },
              {
                field: "cia" as const,
                label: "CIA",
                value: cia,
                hint: "Ex. 476,00",
                use: "complément indemnitaire annuel",
              },
              {
                field: "netRatioFixed" as const,
                label: "Taux net avant impôt — traitement",
                value: netRatioFixed,
                hint: "",
                use: "estimation automatique, affinée lorsque les bulletins permettent un calcul fiable",
                percent: true,
                automatic: true,
              },
              {
                field: "netRatioVariable" as const,
                label: "Taux net avant impôt — primes",
                value: netRatioVariable,
                hint: "",
                use: "estimation automatique pour les dimanches, fériés et le CIA",
                percent: true,
                automatic: true,
              },
              {
                field: "navigo" as const,
                label: "Navigo remboursé",
                value: navigo,
                hint: "Ex. 68,10",
                use: "hors cumul brut, ajouté tel quel au net",
              },
              {
                field: "mealVoucherDeduction" as const,
                label: "Titres repas (retenue)",
                value: mealVoucherDeduction,
                hint: "Ex. 82,40",
                use: "hors cumul brut, retiré tel quel du net — jamais en décembre",
              },
              {
                field: "pasRate" as const,
                label: "Taux d’imposition (PAS)",
                value: pasRate,
                hint: "Ex. 1,70",
                use: "recopié de la ligne « PAS - Taux » du bulletin — mettez-le à jour si les impôts le changent",
                percent: true,
              },
            ]
          )
            .filter(
              (item) =>
                !isContractuel || (item.field !== "ifse" && item.field !== "cia"),
            )
            .map((item) => (
            <div className="pay-field" key={item.field}>
              <span className="pay-field-head">
                {item.label}
                <b className={item.value ? "" : "pending"}>
                  {item.value
                    ? item.percent
                      ? `${item.value.toLocaleString("fr-FR")} %`
                      : euros(item.value)
                    : "à renseigner"}
                </b>
              </span>
              {/* L'explication ne sert qu'à trouver la ligne sur le bulletin :
                  une fois le montant saisi, elle n'est plus que du bruit. */}
              {item.automatic || !item.value ? <small>{item.use}</small> : null}
              {item.automatic ? (
                <span className="pay-field-automatic">Automatique</span>
              ) : (
              <div className="salary-field">
                <input
                  type="text"
                  inputMode="decimal"
                  className="note-search-input"
                  placeholder={item.hint}
                  value={payDrafts[item.field]}
                  onChange={(event) =>
                    setPayDrafts((current) => ({
                      ...current,
                      [item.field]: event.target.value,
                    }))
                  }
                  aria-label={item.label}
                  title={item.use}
                />
                <button
                  type="button"
                  className="save-button"
                  onClick={() => void savePayAmount(item.field)}
                  disabled={
                    !payDrafts[item.field].trim() || savingPay === item.field
                  }
                  aria-label={`Enregistrer ${item.label}`}
                  title="Enregistrer"
                >
                  {savingPay === item.field ? (
                    "…"
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m4 10.5 4 4 8-9" />
                    </svg>
                  )}
                </button>
              </div>
              )}
            </div>
          ))}
          {!isContractuel && (
          <div className="pay-field">
            <span className="pay-field-head">
              Mois du CIA
              <b className={ciaMonth === undefined ? "pending" : ""}>
                {ciaMonth === undefined ? "à renseigner" : MONTHS[ciaMonth]}
              </b>
            </span>
            {ciaMonth === undefined ? (
              <small>versé une seule fois dans l’année</small>
            ) : null}
            <div className="salary-field">
              <ChoicePicker
                value={ciaMonth ?? -1}
                options={[
                  { value: 6, label: "Juillet" },
                  { value: 7, label: "Août" },
                  { value: 8, label: "Septembre" },
                ]}
                onChange={(month) => void saveCiaMonth(month)}
                ariaLabel="Choisir le mois de versement du CIA"
                layout="list"
                className="leave-type-picker cia-month-picker"
                placeholder="À renseigner"
              />
            </div>
          </div>
          )}
          </div>
            </>
          ) : (
            <button
              type="button"
              className="pay-settings-summary"
              onClick={() => setPaySettingsOpen(true)}
            >
              <strong>{missing ? "Des informations restent à renseigner" : "Paramètres enregistrés"}</strong>
              <span>
                {missing
                  ? "Le bulletin PDF peut remplir automatiquement les principaux champs."
                  : "Ouvrir seulement si un montant de votre bulletin change."}
              </span>
            </button>
          )}
        </section>
      </div>
  );
}
