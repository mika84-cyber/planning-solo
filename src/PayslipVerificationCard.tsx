import { ChoicePicker } from "./ChoicePicker";
import { useState } from "react";
import { euros } from "./appModel";
import { MONTHS, MONTH_OPTIONS, YEAR_OPTIONS, s } from "./planningLogic";
import { minutesLabel, type OvertimeEntry } from "./overtime";
import { matchEarlyPayment } from "./earlyPayment";
import { mecenatsPaidEarly, type MecenatEntry } from "./mecenat";
import { isMecenatLabel, isOvertimeLabel, usesAverageNetRatios } from "./payslip";
import type { PayslipCheckSectionProps } from "./PayslipCheckSection";
import {
  isPayslipImage,
  PAYSLIP_FILE_ACCEPT,
} from "./payslipOcr";
import { describePayslipGap, explainPayslipGap, type PayslipReviewCheck } from "./payslipReview";

import {
  createPayslipAnomalyPdf,
  payslipAnomalyPdfName,
  type PayslipVerificationRecord,
  type PayslipVerificationStatus,
} from "./payslipVerificationDecision";
import { payslipVerificationFor } from "./payslipVerificationRecords";

function formatReviewValue(row: PayslipReviewCheck, value: number) {
  if (row.key === "sundays") return value.toLocaleString("fr-FR");
  if (row.key === "pas-rate") return `${value.toLocaleString("fr-FR")} %`;
  return euros(value);
}

function PayslipIssueList({ issues, title }: { issues: PayslipReviewCheck[]; title?: string }) {
  return (
    <section className="payslip-mismatch-list" aria-label={title || "Détail des anomalies enregistrées"}>
      {title ? <div className="payslip-mismatch-heading"><span>Comparaison détaillée</span><h3>{title}</h3></div> : null}
      {issues.map((row) => {
        const found = row.found as number;
        const difference = found - row.expected;
        return (
          <article className="payslip-mismatch-item" key={`mismatch-${row.key}`}>
            <h4>{row.label}</h4>
            <p className="payslip-mismatch-sentence">{describePayslipGap(row)}</p>
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
  );
}

type Props = Pick<
  PayslipCheckSectionProps,
  "verificationRecords" | "onSaveVerification" | "onRemoveVerification" | "importBusy" | "importMode" | "importError" | "importResult" | "onImport" |
  "check" | "checkError" | "needsPeriod" | "fallbackMonth" | "setFallbackMonth" |
  "fallbackYear" | "setFallbackYear" | "onApplyFallbackPeriod" | "allowances" |
  "displayedMonth" | "review" | "unplannedCarence" | "resultDetailsOpen" |
  "rateCalibration" | "netRatioFixed" | "netRatioVariable" |
  "setResultDetailsOpen" | "grossForMonth" | "overtime" |
  "mecenat" | "mecenatEntries" | "onMarkMecenatsPaidEarly" | "overtimeEarlyCandidates" |
  "onMarkOvertimePaidEarly" | "onReportMissingSundays" | "nextSundayPayout" | "sundayCarryover" |
  "sundayCarryoverMonth" | "sundayCarryoverYear" | "onClearSundayCarryover"
>;

/** « 19:00 » devient « 19 h », « 09:30 » devient « 9 h 30 ». */
function clockText(value = "") {
  return value.replace(/^0/, "").replace(":00", " h").replace(":", " h ");
}
function dayText(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });
}
/** Vacation d'un mécénat : « lun. 12 octobre · 19 h – 23 h ». */
function mecenatSlotLabel(entry: MecenatEntry) {
  return `${dayText(entry.date)} · ${clockText(entry.start)} – ${clockText(entry.end)}`;
}
/** Heures sup : « lun. 12 octobre · 18 h – 20 h · 2 h ». */
function overtimeSlotLabel(entry: OvertimeEntry) {
  const range = entry.start && entry.end ? ` · ${clockText(entry.start)} – ${clockText(entry.end)}` : "";
  return `${dayText(entry.date)}${range} · ${minutesLabel(entry.minutes)}`;
}

const EARLY_WORDING = {
  mecenat: {
    title: "Mécénat payé en avance",
    what: "de mécénat",
    matchedOne: "au mécénat suivant, prévu", matchedMany: "aux mécénats suivants, prévus",
    pickOne: "Indiquez si ce mécénat, prévu", pickMany: "Indiquez lesquels de ces mécénats, prévus",
    paidOne: "payé", paidMany: "payés", removedOne: "retiré", removedMany: "retirés",
  },
  overtime: {
    title: "Heures supplémentaires payées en avance",
    what: "d’heures supplémentaires",
    matchedOne: "à la déclaration suivante, prévue", matchedMany: "aux déclarations suivantes, prévues",
    pickOne: "Indiquez si cette déclaration, prévue", pickMany: "Indiquez lesquelles de ces déclarations, prévues",
    paidOne: "payée", paidMany: "payées", removedOne: "retirée", removedMany: "retirées",
  },
} as const;

/** Un bulletin qui paie plus que prévu : on propose de confirmer que les
 *  éléments attendus le mois suivant sont déjà payés. */
export function EarlyPaymentNotice({
  kind,
  surplusCents,
  items,
  matchedIds,
  nextMonthLabel,
  onConfirm,
}: {
  kind: keyof typeof EARLY_WORDING;
  surplusCents: number;
  items: Array<{ id: string; label: string; cents: number }>;
  matchedIds: string[];
  nextMonthLabel: string;
  onConfirm: (ids: string[]) => void;
}) {
  const words = EARLY_WORDING[kind];
  const matched = matchedIds.length > 0;
  const several = (matched ? matchedIds.length : items.length) > 1;
  return (
    <section className="mecenat-early-payment" aria-label={words.title}>
      <p>
        <strong>{words.title}</strong>
        Ce bulletin paie {euros(surplusCents / 100)} {words.what} de plus que prévu.{" "}
        {matched
          ? `Cela correspond ${several ? words.matchedMany : words.matchedOne} sur la paie de ${nextMonthLabel}.`
          : `${several ? words.pickMany : words.pickOne} sur la paie de ${nextMonthLabel}, ${several ? "sont" : "est"} déjà ${several ? words.paidMany : words.paidOne}.`}
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={matchedIds.includes(item.id) ? "matched" : undefined}>
            <span>{item.label}</span>
            <strong>{euros(item.cents / 100)}</strong>
            {matched ? null : (
              <button type="button" className="secondary-button" onClick={() => onConfirm([item.id])}>
                Déjà {words.paidOne}
              </button>
            )}
          </li>
        ))}
      </ul>
      {matched ? (
        <button type="button" className="primary-action" onClick={() => onConfirm(matchedIds)}>
          Confirmer : déjà {several ? words.paidMany : words.paidOne}, {several ? words.removedMany : words.removedOne} de {nextMonthLabel}
        </button>
      ) : null}
    </section>
  );
}

/** Le cas du mécénat, d'après le calcul de mecenatsPaidEarly. */
export function EarlyMecenatPayment({
  early,
  nextMonthLabel,
  onConfirm,
}: {
  early: ReturnType<typeof mecenatsPaidEarly>;
  nextMonthLabel: string;
  onConfirm: (entries: MecenatEntry[]) => void;
}) {
  return (
    <EarlyPaymentNotice
      kind="mecenat"
      surplusCents={early.surplusCents}
      items={early.candidates.map((entry) => ({ id: entry.id, label: mecenatSlotLabel(entry), cents: entry.grossAmountCents }))}
      matchedIds={early.matched.map((entry) => entry.id)}
      nextMonthLabel={nextMonthLabel}
      onConfirm={(ids) => onConfirm(early.candidates.filter((entry) => ids.includes(entry.id)))}
    />
  );
}

function downloadPdf(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function PayslipVerificationCard({
  rateCalibration,
  netRatioFixed,
  netRatioVariable,
  verificationRecords,
  onSaveVerification,
  onRemoveVerification,
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
  mecenatEntries = [],
  onMarkMecenatsPaidEarly,
  overtimeEarlyCandidates,
  onMarkOvertimePaidEarly,
  onReportMissingSundays: reportMissingSundays,
  nextSundayPayout: nextSundayPayoutSlot,
  sundayCarryover,
  sundayCarryoverMonth,
  sundayCarryoverYear,
  onClearSundayCarryover: clearSundayCarryover,
}: Props) {
  const [activeImportSource, setActiveImportSource] = useState<"file" | "photo">("file");
  /** Le choix d'un PDF ou de photos, pour ajouter une page au bulletin lu ou
   *  en vérifier un autre : un seul champ, deux usages. */
  const payslipFileInput = (mode: "add-page" | "verify") => (
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
        void importPayslips(files, mode);
      }}
    />
  );
  // La décision du mois vient du compte (ou de l'appareil, en démo) : elle
  // suit d'un appareil à l'autre.
  const savedDecision = payslipVerificationFor(verificationRecords, allowances.year, displayedMonth);
  const [decisionError, setDecisionError] = useState("");
  const [sharingReport, setSharingReport] = useState(false);
  const checkMatchesDisplayedPeriod = payslipCheck?.reading.month === displayedMonth
    && payslipCheck.reading.year === allowances.year;
  // Un mécénat attendu sur la paie suivante, déjà payé par ce bulletin.
  const bulletinMecenatCents = checkMatchesDisplayedPeriod && payslipCheck
    ? Math.round((payslipCheck.reading.extraLines || []).filter((line) => isMecenatLabel(line.label)).reduce((sum, line) => sum + line.amount, 0) * 100)
    : 0;
  const earlyMecenat = bulletinMecenatCents
    ? mecenatsPaidEarly(mecenatEntries, allowances.year, displayedMonth, bulletinMecenatCents)
    : null;
  const nextMonthLabel = MONTHS[(displayedMonth + 1) % 12];
  // Les heures supplémentaires lues sur le bulletin, comparées à l'estimation,
  // et celles du mois que la paie suivante attendait encore.
  const bulletinOvertimeCents = checkMatchesDisplayedPeriod && payslipCheck
    ? Math.round((payslipCheck.reading.extraLines || []).filter((line) => isOvertimeLabel(line.label)).reduce((sum, line) => sum + line.amount, 0) * 100)
    : 0;
  const expectedOvertimeCents = Math.round(overtimeForPayMonth.amount * 100);
  const overtimeSurplusCents = bulletinOvertimeCents - expectedOvertimeCents;
  const earlyOvertime = bulletinOvertimeCents && overtimeEarlyCandidates
    ? matchEarlyPayment(overtimeEarlyCandidates(allowances.year, displayedMonth), (item) => item.cents, overtimeSurplusCents)
    : null;
  const comparableGross =
    checkMatchesDisplayedPeriod && payslipCheck &&
    payslipCheck.reading.gross !== undefined
      ? {
          expected: grossForMonth(displayedMonth),
          found: payslipCheck.reading.gross,
          gap: Math.abs(payslipCheck.reading.gross - grossForMonth(displayedMonth)),
        }
      : null;
  const recordDecision = (status: PayslipVerificationStatus) => {
    const record: PayslipVerificationRecord = {
      status,
      year: allowances.year,
      month: displayedMonth,
      sourceName: payslipCheck?.name || "",
      note: "",
      issues: status === "attention" ? (payslipReview?.issues || []) : [],
      unavailableCount: payslipReview?.unavailable.length || 0,
      verifiedCount: payslipReview?.verified.length || 0,
      updatedAt: new Date().toISOString(),
    };
    onSaveVerification(record);
    setDecisionError("");
  };
  const resetDecision = () => {
    onRemoveVerification(allowances.year, displayedMonth);
    setDecisionError("");
  };
  const prepareReport = async () => {
    if (!savedDecision || savedDecision.status !== "attention") return null;
    const blob = await createPayslipAnomalyPdf(savedDecision, MONTHS[savedDecision.month]);
    return { blob, name: payslipAnomalyPdfName(savedDecision) };
  };
  const downloadReport = async () => {
    setSharingReport(true);
    setDecisionError("");
    try {
      const report = await prepareReport();
      if (report) downloadPdf(report.blob, report.name);
    } catch {
      setDecisionError("Le PDF des anomalies n’a pas pu être créé.");
    } finally {
      setSharingReport(false);
    }
  };
  const shareReport = async (channel: "email" | "whatsapp") => {
    setSharingReport(true);
    setDecisionError("");
    try {
      const report = await prepareReport();
      if (!report) return;
      const file = new File([report.blob], report.name, { type: "application/pdf" });
      const shareData = {
        title: `Anomalies du bulletin — ${MONTHS[savedDecision!.month]} ${savedDecision!.year}`,
        text: "Voici le relevé des anomalies constatées sur mon bulletin.",
        files: [file],
      };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadPdf(report.blob, report.name);
        const subject = encodeURIComponent(shareData.title);
        const message = encodeURIComponent(`${shareData.text}\nLe PDF vient d’être téléchargé : ajoutez-le au message avant l’envoi.`);
        if (channel === "email") window.location.href = `mailto:?subject=${subject}&body=${message}`;
        else window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDecisionError("Le partage du PDF n’a pas pu être ouvert. Vous pouvez le télécharger manuellement.");
    } finally {
      setSharingReport(false);
    }
  };
  return (
          <section className="allowance-card pay-function-card payslip-verify-card" aria-label="Sélection et résultat du bulletin">
            {savedDecision?.status === "ok" ? (
              <button
                type="button"
                className="payslip-month-check ok"
                aria-label={`Revoir la vérification de ${MONTHS[savedDecision.month]} ${savedDecision.year}`}
                onClick={resetDecision}
              >
                <span aria-hidden="true">✓</span>
              </button>
            ) : savedDecision?.status === "attention" ? (
              <div className="payslip-month-attention" role="region" aria-label="Résultat du bulletin signalé">
                <span className="payslip-month-check attention" role="img" aria-label={`Anomalie signalée pour ${MONTHS[savedDecision.month]} ${savedDecision.year}`}>✓</span>
                <details className="payslip-anomaly-details">
                  <summary>
                    <span>Détails de l’anomalie</span>
                    <strong>{MONTHS[savedDecision.month]} {savedDecision.year}</strong>
                    <i aria-hidden="true">⌄</i>
                  </summary>
                  <div>
                    <p className="allowance-note">{savedDecision.verifiedCount} ligne{s(savedDecision.verifiedCount)} vérifiée{s(savedDecision.verifiedCount)} · {savedDecision.unavailableCount} non vérifiable{s(savedDecision.unavailableCount)}</p>
                    {savedDecision.issues.length ? (
                      <PayslipIssueList issues={savedDecision.issues} />
                    ) : (
                      <p className="allowance-note warn">Anomalie signalée. Aucun écart n’a été identifié automatiquement sur les lignes comparables.</p>
                    )}
                    {savedDecision.note ? <p className="allowance-note">Observation enregistrée : {savedDecision.note}</p> : null}
                    <div className="payslip-report-actions">
                      <button type="button" onClick={() => void downloadReport()} disabled={sharingReport}>Télécharger le PDF</button>
                      <button type="button" onClick={() => void shareReport("email")} disabled={sharingReport}>E-mail</button>
                      <button type="button" onClick={() => void shareReport("whatsapp")} disabled={sharingReport}>WhatsApp</button>
                    </div>
                    <button type="button" className="text-button" onClick={resetDecision}>Recommencer la vérification</button>
                    {decisionError ? <p className="allowance-note warn" role="alert">{decisionError}</p> : null}
                  </div>
                </details>
              </div>
            ) : (
            <>
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
            {checkMatchesDisplayedPeriod && payslipCheck ? (
              <>
                <div className="payslip-detected-period" role="status">
                  <span>Période reconnue</span>
                  <strong>{MONTHS[displayedMonth]} {allowances.year}</strong>
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
            {payslipImportMode === "verify" && payslipImportResult && (payslipNeedsPeriod || checkMatchesDisplayedPeriod) ? (
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
            {payslipError && (!payslipCheck || payslipNeedsPeriod || checkMatchesDisplayedPeriod) ? (
              <p className="allowance-note warn">{payslipError}</p>
            ) : null}
            {checkMatchesDisplayedPeriod && payslipCheck ? (
            <>
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
                    {/* L'essentiel d'abord : chaque écart en une phrase, avant le détail chiffré. */}
                    {payslipReview.issues.length ? (
                      <ul className="payslip-gap-sentences">
                        {payslipReview.issues.map((row) => <li key={`gap-${row.key}`}>{describePayslipGap(row)}</li>)}
                      </ul>
                    ) : null}
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
              {/* Une autre photo ou page du même bulletin, prise après coup :
                  elle s'ajoute à la lecture déjà faite. */}
              <label className="payslip-add-page">
                {payslipFileInput("add-page")}
                <span aria-hidden="true">＋</span>
                <strong>{payslipImportBusy ? "Lecture de la page…" : "Ajouter une page"}</strong>
                <small>Une autre photo ou page du même bulletin</small>
              </label>
              {/* Un seul bulletin ne suffit pas à calculer les taux de la
                  personne : tant que l'estimation repose sur des valeurs
                  moyennes, on l'invite simplement à en vérifier un second. */}
              {rateCalibration.reason !== "ready" && usesAverageNetRatios(netRatioFixed, netRatioVariable) ? (
                <section className="payslip-second-hint" aria-label="Pour un net encore plus juste">
                  <strong>Pour un net encore plus juste</strong>
                  <p>
                    Avec un seul bulletin, l’application estime vos cotisations avec des valeurs
                    moyennes. Vérifiez maintenant un deuxième bulletin, d’un autre mois où vos primes
                    sont différentes (plus ou moins de dimanches, par exemple) : elle calculera vos
                    propres taux.
                  </p>
                  <label className="payslip-second-button">
                    {payslipFileInput("verify")}
                    Vérifier un autre bulletin
                  </label>
                </section>
              ) : null}
              {payslipReview ? (
                <section className="payslip-review-decision" aria-label="Conclusion de la vérification">
                  <div><span>Votre conclusion</span><strong>Valider le contrôle du bulletin</strong></div>
                  <div className="payslip-decision-options">
                    <button type="button" className="payslip-decision-ok" onClick={() => recordDecision("ok")}><span aria-hidden="true">✓</span><strong>Tout est OK</strong></button>
                    <button type="button" className="payslip-decision-attention" onClick={() => recordDecision("attention")}><span aria-hidden="true">!</span><strong>Signaler une anomalie</strong></button>
                  </div>
                </section>
              ) : null}
              {unplannedPayslipCarence ? (
                <p className="allowance-note warn">
                  Jour de carence de {euros(payslipCheck.reading.carenceDay as number)} présent sur le bulletin, mais aucun arrêt maladie n’était prévu dans l’application pour ce mois.
                </p>
              ) : null}
              {/* Une ligne que l'application ne connaissait pas est prise en
                  compte, et dite : où elle a été rangée. */}
              {payslipCheck.reading.extraLines?.length ? (
                <p className="allowance-note">
                  Lignes que l’application ne connaissait pas, prises en compte :{" "}
                  {payslipCheck.reading.extraLines.map((line) => `${line.label} (${euros(line.amount)}, ${
                    line.recall
                      ? "rappel compté pour ce mois seulement"
                      : line.sick
                        ? "arrêt maladie, déjà calculé par l’application"
                        : line.fixed === true
                          ? "ajoutée aux autres éléments fixes"
                          : line.fixed === false
                            ? "ponctuelle, comptée pour ce mois seulement"
                            : "déjà calculée par l’application"
                  })`).join(" ; ")}.
                </p>
              ) : null}
              {earlyOvertime?.candidates.length && onMarkOvertimePaidEarly ? (
                <EarlyPaymentNotice
                  kind="overtime"
                  surplusCents={overtimeSurplusCents}
                  items={earlyOvertime.candidates.map((item) => ({ id: item.entry.id, label: overtimeSlotLabel(item.entry), cents: item.cents }))}
                  matchedIds={earlyOvertime.matched.map((item) => item.entry.id)}
                  nextMonthLabel={nextMonthLabel}
                  onConfirm={(ids) => onMarkOvertimePaidEarly(earlyOvertime.candidates.filter((item) => ids.includes(item.entry.id)).map((item) => item.entry))}
                />
              ) : null}
              {earlyMecenat?.candidates.length && onMarkMecenatsPaidEarly ? (
                <EarlyMecenatPayment
                  early={earlyMecenat}
                  nextMonthLabel={nextMonthLabel}
                  onConfirm={(entries) => onMarkMecenatsPaidEarly(entries, allowances.year, displayedMonth)}
                />
              ) : null}
              {payslipReview?.issues.length ? (
                <PayslipIssueList issues={payslipReview.issues} title="Tous les points qui ne coïncident pas" />
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
              {overtimeForPayMonth.totalMinutes || bulletinOvertimeCents ? (
                <p className="allowance-note">
                  {bulletinOvertimeCents
                    ? `Heures supplémentaires lues sur ce bulletin : ${euros(bulletinOvertimeCents / 100)}, pour ${euros(overtimeForPayMonth.amount)} attendus${overtimeForPayMonth.totalMinutes ? ` (${minutesLabel(overtimeForPayMonth.totalMinutes)})` : ""}${Math.abs(overtimeSurplusCents) <= 100 ? " : cela concorde." : "."}`
                    : `${minutesLabel(overtimeForPayMonth.totalMinutes)} sont attendues sur ce bulletin pour un montant brut estimé de ${euros(overtimeForPayMonth.amount)}, mais aucune ligne d’heures supplémentaires n’y a été trouvée : vérifiez-la sur le bulletin.`}
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
                {MONTHS[displayedMonth]} {allowances.year}
                . Un écart de quelques centimes vient des arrondis ; au-delà, il
                y a une vraie différence à comprendre.
              </p>
              {(() => {
                const found = payslipCheck.reading.sundaysBeyondTen;
                const expected =
                  allowances.monthly.find(
                    (slot) => slot.index === displayedMonth,
                  )?.sundayCount || 0;
                const missing = expected - found;
                if (missing <= 0) return null;
                const target = nextSundayPayoutSlot(
                  allowances.year,
                  displayedMonth,
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
          ) : null}
          {sundayCarryover > 0 &&
          sundayCarryoverMonth !== undefined &&
          sundayCarryoverYear !== undefined &&
          sundayCarryoverMonth === displayedMonth &&
          sundayCarryoverYear === allowances.year ? (
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
          </>
          )}
          </section>
  );
}
