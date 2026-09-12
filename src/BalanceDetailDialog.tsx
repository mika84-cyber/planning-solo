import { StrikeContinuityDetails } from "./StrikeContinuityDetails";
import type { StrikePayEstimate } from "./strike";
import type { BalanceType, LeavePeriod } from "./appModel";
import { euros } from "./appModel";
import {
  dateKey,
  fromKey,
  longDate,
  s,
  type CountedOnlyType,
} from "./planningLogic";

type BalanceDetailEntry = { date: string; units: number; period: LeavePeriod };

/** Solde ou suivi d'un type d'absence, tel que le calcule l'écran des congés. */
type BalanceDetailSummary = {
  title: string;
  quota: boolean;
  allowance: number;
  manualUsed: number;
  remaining: number;
  used: number;
  details: BalanceDetailEntry[];
};

type BalanceDetailPeriod = {
  key: string;
  label: string;
  units: number;
  details: BalanceDetailEntry[];
};

export type BalanceDetailDialogProps = {
  balanceDetail: BalanceDetailSummary | null;
  balanceDetailType: BalanceType | CountedOnlyType | null;
  balanceDetailPeriods: BalanceDetailPeriod[];
  recentBalanceDetailDates: Set<string>;
  absenceYear: number;
  now: Date;
  onClose: () => void;
  onOpenDate: (date: Date) => void;
  onOpenManualAdjustments: () => void;
  strikeEstimateFor: (year: number, monthIndex: number) => StrikePayEstimate;
};

/** Détail d'un solde : ce qui a été déduit, date par date, avec accès à la fiche. */
export function BalanceDetailDialog({
  balanceDetail,
  balanceDetailType,
  balanceDetailPeriods,
  recentBalanceDetailDates,
  absenceYear,
  now,
  onClose,
  onOpenDate,
  onOpenManualAdjustments,
  strikeEstimateFor,
}: BalanceDetailDialogProps) {
  if (!balanceDetail) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <section
        className="modal-card balance-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="balance-detail-title"
      >
        <button
          className="modal-close"
          type="button"
          onClick={() => onClose()}
          aria-label="Fermer"
        >
          ×
        </button>
        <span className="step-label">
          {balanceDetail.quota ? "Solde" : "Suivi"} {absenceYear}
        </span>
        <h2 id="balance-detail-title">{balanceDetail.title}</h2>
        <div className="balance-detail-summary">
          <strong>
            {(balanceDetail.quota
              ? balanceDetail.remaining
              : balanceDetail.used
            ).toLocaleString("fr-FR")}
          </strong>
          <span>
            {balanceDetail.quota
              ? `jours restants sur ${balanceDetail.allowance} · ${balanceDetail.used.toLocaleString("fr-FR")} déduit`
              : balanceDetailType === "strike"
                ? `${balanceDetail.used > 1 ? "journées" : "journée"} de grève · aucun congé déduit`
                : balanceDetailType === "work_accident"
                  ? `${balanceDetail.used > 1 ? "journées" : "journée"} d’accident de travail · aucun congé déduit`
                : `${balanceDetail.used > 1 ? "jours" : "jour"} d’arrêt · aucun congé déduit`}
          </span>
        </div>
        <h3>
          {balanceDetail.quota
            ? "Jours déduits"
            : balanceDetailType === "strike"
              ? "Journées enregistrées"
              : balanceDetailType === "work_accident"
                ? "Journées concernées"
              : "Jours d’arrêt"}
        </h3>
        {balanceDetail.quota && balanceDetail.manualUsed > 0 ? (
          <div className="balance-manual-summary">
            <span>
              <strong>{balanceDetail.manualUsed.toLocaleString("fr-FR")} jour{s(balanceDetail.manualUsed)}</strong>
              saisi{s(balanceDetail.manualUsed)} sans date
            </span>
            <button type="button" onClick={onOpenManualAdjustments}>Modifier</button>
          </div>
        ) : null}
        <p className="balance-detail-guidance">
          Ouvrez les congés déjà pris ou les congés à venir. Touchez ensuite une date
          pour la gérer depuis sa fiche.
        </p>
        <div className="balance-detail-months">
        {balanceDetailPeriods.map((period) => (
          <details className={`balance-detail-month balance-detail-${period.key}`} key={period.key}>
            <summary>
              <span className="balance-detail-month-label">
                <strong>{period.label}</strong>
                <small>{period.units.toLocaleString("fr-FR")} jour{s(period.units)}</small>
              </span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
            </summary>
            {period.details.length ? (
              <div className="balance-detail-list">
              {period.details.map((detail) => {
                const isUpcoming = detail.date > dateKey(now);
                const timingClass = isUpcoming
                  ? "balance-detail-upcoming"
                  : "balance-detail-taken";
                return (
                  <article
                    key={`${detail.period.id}-${detail.date}`}
                    className={[
                      recentBalanceDetailDates.has(detail.date) ? "recent-leave-date" : "",
                      timingClass,
                    ].filter(Boolean).join(" ")}
                  >
                  <button
                    className="balance-detail-open"
                    type="button"
                    onClick={() => onOpenDate(fromKey(detail.date))}
                    aria-label={`Ouvrir la fiche du ${longDate(fromKey(detail.date))} pour gérer cette absence`}
                  >
                    <span className="balance-detail-date-copy">
                      <strong>{longDate(fromKey(detail.date))}</strong>
                      <small>
                        {balanceDetailType === "strike"
                          ? (() => {
                              const date = fromKey(detail.date);
                              const deduction = strikeEstimateFor(
                                date.getFullYear(),
                                date.getMonth(),
                              ).dailyDeduction;
                              return deduction === null
                                ? "Retenue à calculer · voir et gérer"
                                : `Retenue estimée : −${euros(deduction)} brut · voir et gérer`;
                            })()
                          : `${isUpcoming ? "À venir" : "Déjà pris"} · voir et gérer cette absence`}
                      </small>
                    </span>
                    <span className="balance-detail-value">
                      <strong>
                        {balanceDetail.quota ? "−" : ""}
                        {detail.units.toLocaleString("fr-FR")} jour
                      </strong>
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="m7 4 6 6-6 6" />
                      </svg>
                    </span>
                  </button>
                  </article>
                );
              })}
              </div>
            ) : (
              <p className="balance-detail-month-empty">
                Aucun congé dans cette rubrique en {absenceYear}.
              </p>
            )}
            {balanceDetailType === "strike"
              ? Array.from(new Set(period.details.map((detail) => detail.date.slice(0, 7)))).map((monthKey) => {
                  const [strikeYear, strikeMonth] = monthKey.split("-").map(Number);
                  return (
                    <StrikeContinuityDetails
                      key={monthKey}
                      estimate={strikeEstimateFor(strikeYear, strikeMonth - 1)}
                    />
                  );
                })
              : null}
          </details>
        ))}
        </div>
        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => onClose()}
          >
            Fermer
          </button>
        </div>
      </section>
    </div>
  );
}
