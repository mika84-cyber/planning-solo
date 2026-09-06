import { ChoicePicker } from "./ChoicePicker";
import { useState } from "react";
import { PayslipSuccessCelebration } from "./PayslipSuccessCelebration";
import { euros } from "./appModel";
import { MONTHS, MONTH_OPTIONS, YEAR_OPTIONS, s } from "./planningLogic";
import { minutesLabel } from "./overtime";
import type { PayslipCheckSectionProps } from "./PayslipCheckSection";
import {
  isPayslipImage,
  PAYSLIP_FILE_ACCEPT,
} from "./payslipOcr";
import { explainPayslipGap, type PayslipReviewCheck } from "./payslipReview";

function formatReviewValue(row: PayslipReviewCheck, value: number) {
  if (row.key === "sundays") return value.toLocaleString("fr-FR");
  if (row.key === "pas-rate") return `${value.toLocaleString("fr-FR")} %`;
  return euros(value);
}

type Props = Pick<
  PayslipCheckSectionProps,
  "importBusy" | "importMode" | "importError" | "importResult" | "onImport" |
  "check" | "checkError" | "needsPeriod" | "fallbackMonth" | "setFallbackMonth" |
  "fallbackYear" | "setFallbackYear" | "onApplyFallbackPeriod" | "allowances" |
  "displayedMonth" | "review" | "unplannedCarence" | "resultDetailsOpen" |
  "setResultDetailsOpen" | "grossForMonth" | "overtime" |
  "mecenat" | "onReportMissingSundays" | "nextSundayPayout" | "sundayCarryover" |
  "sundayCarryoverMonth" | "sundayCarryoverYear" | "onClearSundayCarryover"
>;

export function PayslipVerificationCard({
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
  overtime: overtimeForPayMonth,
  mecenat: mecenatForCurrentPayMonth,
  onReportMissingSundays: reportMissingSundays,
  nextSundayPayout: nextSundayPayoutSlot,
  sundayCarryover,
  sundayCarryoverMonth,
  sundayCarryoverYear,
  onClearSundayCarryover: clearSundayCarryover,
}: Props) {
  const [activeImportSource, setActiveImportSource] = useState<"file" | "photo">("file");
  const comparableGross =
    payslipCheck?.reading.month === displayedMonth &&
    payslipCheck.reading.year === allowances.year &&
    payslipCheck.reading.gross !== undefined
      ? {
          expected: grossForMonth(displayedMonth),
          found: payslipCheck.reading.gross,
          gap: Math.abs(payslipCheck.reading.gross - grossForMonth(displayedMonth)),
        }
      : null;
  return (
          <section className="allowance-card pay-function-card payslip-verify-card" aria-label="Sélection et résultat du bulletin">
            <div className="payslip-guide-step active">
              <span className="payslip-guide-number">1</span>
              <div>
                <strong>Choisir le bulletin à vérifier</strong>
                <small>La netteté, la lumière, le cadrage et l’inclinaison de la photo sont contrôlés avant la lecture.</small>
              </div>
              <div className="payslip-import-actions">
                <label className="payslip-drop payslip-file-drop">
                  <input
                    type="file"
                    accept={PAYSLIP_FILE_ACCEPT}
                    multiple
                    disabled={payslipImportBusy}
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      event.target.value = "";
                      if (!files.length) return;
                      setActiveImportSource(isPayslipImage(files[0]) ? "photo" : "file");
                      void importPayslips(files, "verify");
                    }}
                  />
                  <span>
                    {payslipImportBusy && payslipImportMode === "verify"
                      ? activeImportSource === "photo"
                        ? "Reconnaissance des photos…"
                        : "Lecture en cours…"
                      : "Choisir PDF ou photo"}
                  </span>
                </label>
              </div>
            </div>
            {payslipCheck && !payslipNeedsPeriod && payslipCheck.reading.month !== undefined && payslipCheck.reading.year !== undefined ? (
              <>
                <div className="payslip-detected-period" role="status">
                  <span>Période reconnue</span>
                  <strong>{MONTHS[payslipCheck.reading.month]} {payslipCheck.reading.year}</strong>
                </div>
                {comparableGross || payslipCheck.reading.netBeforeTax !== undefined ? (
                  <div className="payslip-actual-values" role="group" aria-label="Valeurs réellement lues sur le bulletin">
                    <span>{comparableGross ? "Comparaison du montant brut" : "Valeurs du bulletin"}</span>
                    {comparableGross ? (
                      <>
                        <div>
                          <small>Attendu</small>
                          <strong>{euros(comparableGross.expected)}</strong>
                        </div>
                        <div>
                          <small>Trouvé</small>
                          <strong>{euros(comparableGross.found)}</strong>
                        </div>
                        <div>
                          <small>Écart</small>
                          <strong className={comparableGross.gap >= 0.05 ? "negative" : ""}>{euros(comparableGross.gap)}</strong>
                        </div>
                      </>
                    ) : payslipCheck.reading.gross !== undefined ? (
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
              {payslipReview ? (
                <div className={`payslip-result-summary ${payslipReview.tone}`}>
                  <span className="payslip-result-icon" aria-hidden="true">
                    {payslipReview.tone === "ok" ? "✓" : payslipReview.tone === "warning" ? "!" : payslipReview.tone === "partial" ? "≈" : "?"}
                  </span>
                  <div>
                    <strong>{payslipReview.verdict}</strong>
                    <small>
                      {payslipReview.verified.length} ligne{s(payslipReview.verified.length)} vérifiée{s(payslipReview.verified.length)}
                      {` · ${payslipReview.unavailable.length} non vérifiable${s(payslipReview.unavailable.length)}`}
                    </small>
                  </div>
                  {payslipReview.tone === "warning" ? (
                    <strong className="payslip-details-visible">Écarts détaillés ci-dessous</strong>
                  ) : (
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
                  )}
                </div>
              ) : null}
              {unplannedPayslipCarence ? (
                <p className="allowance-note warn">
                  Jour de carence de {euros(payslipCheck.reading.carenceDay as number)} présent sur le bulletin, mais aucun arrêt maladie n’était prévu dans l’application pour ce mois.
                </p>
              ) : null}
              {payslipReview?.issues.length ? (
                <section className="payslip-mismatch-list" aria-label="Détail des points qui ne coïncident pas">
                  <div className="payslip-mismatch-heading">
                    <span>Comparaison détaillée</span>
                    <h3>Tous les points qui ne coïncident pas</h3>
                  </div>
                  {payslipReview.issues.map((row) => {
                    const found = row.found as number;
                    const difference = found - row.expected;
                    return (
                      <article className="payslip-mismatch-item" key={`mismatch-${row.key}`}>
                        <h4>{row.label}</h4>
                        <div className="payslip-mismatch-values">
                          <span><small>Attendu</small><strong>{formatReviewValue(row, row.expected)}</strong></span>
                          <span><small>Trouvé</small><strong>{formatReviewValue(row, found)}</strong></span>
                          <span><small>Différence</small><strong>{difference > 0 ? "+" : ""}{formatReviewValue(row, difference)}</strong></span>
                        </div>
                        <p><strong>Explication possible :</strong> {explainPayslipGap(row)}</p>
                      </article>
                    );
                  })}
                </section>
              ) : null}
              {payslipResultDetailsOpen || payslipReview?.tone === "warning" ? (
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
                  {payslipReview ? [...payslipReview.verified, ...payslipReview.unavailable].map((row) => {
                    const gap =
                      row.found === undefined
                        ? null
                        : Math.abs(row.found - row.expected);
                    const tolerance = row.tolerance ?? 0.05;
                    return (
                      <tr key={row.key}>
                        <th scope="row">
                          {row.label}
                          {gap === null ? (
                            <small>absent du bulletin</small>
                          ) : gap < tolerance ? (
                            <small>concorde</small>
                          ) : (
                            <small className="gap">
                              écart de {formatReviewValue(row, gap)}
                            </small>
                          )}
                        </th>
                        <td>
                          {row.found === undefined ? "—" : formatReviewValue(row, row.found)}
                        </td>
                        <td className={gap !== null && gap >= tolerance ? "pending" : ""}>
                          {formatReviewValue(row, row.expected)}
                        </td>
                      </tr>
                    );
                  }) : null}
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
              {sundayCarryover} dimanche{s(sundayCarryover)} en attente pour{" "}
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
  );
}
