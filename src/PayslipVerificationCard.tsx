import { ChoicePicker } from "./ChoicePicker";
import { PayslipSuccessCelebration } from "./PayslipSuccessCelebration";
import { PayslipWarningEffect } from "./PayslipWarningEffect";
import { euros } from "./appModel";
import { MONTHS, MONTH_OPTIONS, YEAR_OPTIONS, s } from "./planningLogic";
import { minutesLabel } from "./overtime";
import type { PayslipCheckSectionProps } from "./PayslipCheckSection";

type Props = Pick<
  PayslipCheckSectionProps,
  "importBusy" | "importMode" | "importError" | "importResult" | "onImport" |
  "check" | "checkError" | "needsPeriod" | "fallbackMonth" | "setFallbackMonth" |
  "fallbackYear" | "setFallbackYear" | "onApplyFallbackPeriod" | "allowances" |
  "displayedMonth" | "review" | "unplannedCarence" | "resultDetailsOpen" |
  "setResultDetailsOpen" | "grossForMonth" | "baseSalary" | "ifse" | "overtime" |
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
}: Props) {
  return (
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
                  <div className="payslip-actual-values" role="group" aria-label="Valeurs réellement lues sur le bulletin">
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
  );
}
