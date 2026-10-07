import { useMemo, type ReactNode } from "react";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES, type MecenatEntry } from "./mecenat";
import { minutesLabel, overtimePayPeriod, type OvertimeEntry, type RecoveryUse } from "./overtime";
import { MONTHS, s } from "./planningLogic";
import { archivedRequestDate, type ArchivedRequest } from "./useRequestArchive";
import { MecenatHistoryList, WorkTimeHistoryList } from "./WorkTimeHistory";


/** La date en tête de ligne, avec sa majuscule : « Mardi 12 mai 2026 ». */
export function workTimeHistoryItems(
  overtimeEntries: OvertimeEntry[],
  holidayRecoveryEarnings: OvertimeEntry[],
  recoveryUses: RecoveryUse[],
) {
  return [
    ...overtimeEntries.map((entry) => ({ date: entry.date, kind: entry.disposition === "paid" ? "paid" as const : "gain" as const, entry })),
    ...holidayRecoveryEarnings.map((entry) => ({ date: entry.date, kind: "holiday" as const, entry })),
    ...recoveryUses.map((entry) => ({ date: entry.date, kind: "use" as const, entry })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

type LeaveManagementPageProps = {
  balancesContent: ReactNode;
  /** Absences de 31 jours et plus, avec leur courrier de dérogation. */
  longAbsenceContent?: ReactNode;
  cetContent: ReactNode;
  recoveryBalance: { earned: number; used: number; remaining: number };
  recoveryEarningsCount: number;
  unresolvedHolidayRecoveryCount: number;
  overtimeEntries: OvertimeEntry[];
  holidayRecoveryEarnings: OvertimeEntry[];
  recoveryUses: RecoveryUse[];
  recoveryEarningStates: Map<string, { earnedMinutes: number; remainingMinutes: number }>;
  overtimeHistoryOpen: boolean;
  /** Montant brut estimé des heures à payer d'une paie, et ce qui dépasse le plafond. */
  paidOvertimeEstimate?: (year: number, month: number) => { ready: boolean; amount: number; cappedMinutes: number };
  mecenatEntries: MecenatEntry[];
  mecenatHistoryOpen: boolean;
  isProgramAdmin: boolean;
  archiveOpen: boolean;
  archivedRequests: ArchivedRequest[];
  onOpenOvertime: () => void;
  onRequestLeave: () => void;
  /** Ouvre le formulaire de demande vierge, sans passer par le choix des dates. */
  onOpenBlankForm: () => void;
  onOpenSolidarity: () => void;
  /** Conduit à l’écran où ces crédits se confirment, plutôt que de nommer le
   *  chemin et de laisser chercher. */
  onOpenHolidayAllowances: () => void;
  onToggleOvertimeHistory: () => void;
  onDeleteOvertime: (entry: OvertimeEntry) => void;
  onDeleteRecoveryUse: (entry: RecoveryUse) => void;
  onOpenMecenat: () => void;
  onToggleMecenatHistory: () => void;
  onDeleteMecenat: (entry: MecenatEntry) => void;
  onToggleArchive: () => void;
  onOpenArchivedRequest: (request: ArchivedRequest) => void;
  onDeleteArchivedRequest: (request: ArchivedRequest) => void;
};

export function LeaveManagementPage({
  balancesContent,
  longAbsenceContent,
  cetContent,
  recoveryBalance,
  recoveryEarningsCount,
  unresolvedHolidayRecoveryCount,
  overtimeEntries,
  holidayRecoveryEarnings,
  recoveryUses,
  recoveryEarningStates,
  overtimeHistoryOpen,
  mecenatEntries,
  mecenatHistoryOpen,
  isProgramAdmin,
  archiveOpen,
  archivedRequests,
  paidOvertimeEstimate,
  onOpenOvertime,
  onRequestLeave,
  onOpenBlankForm,
  onOpenSolidarity,
  onOpenHolidayAllowances,
  onToggleOvertimeHistory,
  onDeleteOvertime,
  onDeleteRecoveryUse,
  onOpenMecenat,
  onToggleMecenatHistory,
  onDeleteMecenat,
  onToggleArchive,
  onOpenArchivedRequest,
  onDeleteArchivedRequest,
}: LeaveManagementPageProps) {
  const historyItems = useMemo(
    () => workTimeHistoryItems(overtimeEntries, holidayRecoveryEarnings, recoveryUses),
    [overtimeEntries, holidayRecoveryEarnings, recoveryUses],
  );
  const paidPeriods = overtimeEntries
    .filter((entry) => entry.disposition === "paid")
    .map((entry) => ({ ...overtimePayPeriod(entry), minutes: entry.minutes }));
  const currentPayKey = new Date().getFullYear() * 12 + new Date().getMonth();
  const nextPaidPeriod = paidPeriods.filter((period) => period.year * 12 + period.month >= currentPayKey).sort((a, b) => a.year - b.year || a.month - b.month)[0];
  const nextPaidMinutes = nextPaidPeriod
    ? paidPeriods.filter((period) => period.year === nextPaidPeriod.year && period.month === nextPaidPeriod.month).reduce((sum, period) => sum + period.minutes, 0)
    : 0;
  const nextPaidEstimate = nextPaidPeriod ? paidOvertimeEstimate?.(nextPaidPeriod.year, nextPaidPeriod.month) : undefined;
  return (
    <>
      <div className="planning-leave-panel leave-primary-action-bar">
        <button type="button" className="primary-action planning-leave-action" onClick={onRequestLeave}>
          Poser un congé
        </button>
        <button type="button" className="secondary-button leave-open-form-action" onClick={onOpenBlankForm}>
          Formulaire vierge
        </button>
      </div>
      {longAbsenceContent}
      {balancesContent}
      <section className="leave-tools-area" aria-label="Récupérations, mécénats et CET">
        <div className="leave-secondary-grid">
          <details className="leave-tool-disclosure">
            <summary>
              <span className="leave-tool-illustration work-time" aria-hidden="true"><img src="/leave-tools/leave-tool-overtime.webp" alt="" /></span>
              <span className="leave-tool-copy"><strong>Heures supp et récupérations</strong></span>
              <b>{minutesLabel(recoveryBalance.remaining)}</b>
            </summary>
          <section className="overtime-balance-card" aria-labelledby="overtime-balance-title">
            <div className="overtime-balance-heading">
              <div>
                <h3 id="overtime-balance-title">Heures supplémentaires et récupérations</h3>
                <p>Les heures disponibles et celles prévues sur votre prochaine paie.</p>
              </div>
              <strong>{minutesLabel(recoveryBalance.remaining)} disponibles</strong>
            </div>
            <div className="overtime-balance-summary overtime-balance-summary-primary">
              <article className="remaining"><span>À récupérer</span><strong>{minutesLabel(recoveryBalance.remaining)}</strong><small>Solde disponible</small></article>
              <article><span>À payer</span><strong>{minutesLabel(nextPaidMinutes)}</strong><small>{nextPaidPeriod ? `${MONTHS[nextPaidPeriod.month]} ${nextPaidPeriod.year}${nextPaidEstimate?.ready && nextPaidEstimate.amount ? ` · ≈ ${euros(nextPaidEstimate.amount)} brut` : ""}` : "Aucune heure prévue"}</small>{nextPaidEstimate?.cappedMinutes ? <small className="overtime-capped-note">{minutesLabel(nextPaidEstimate.cappedMinutes)} au-delà du plafond de 25 h : non payées</small> : null}</article>
            </div>
            <div className="overtime-actions">
              <button type="button" className="primary-action" onClick={onOpenOvertime}>Déclarer des heures sup</button>
              <button type="button" className="secondary-button solidarity-hours-action" onClick={onOpenSolidarity}>Ajouter des heures manuellement</button>
            </div>
            {/* L'alerte mène là où se règle le problème : lire « dans Ma paie
                &gt; Primes et jours fériés » puis chercher soi-même l'écran
                n'apporte rien de plus qu'un bouton qui y conduit. */}
            {unresolvedHolidayRecoveryCount ? (
              <button type="button" className="allowance-note warn alert-fix-action" onClick={onOpenHolidayAllowances}>
                <span>{unresolvedHolidayRecoveryCount} ancien{unresolvedHolidayRecoveryCount > 1 ? "s" : ""} crédit{unresolvedHolidayRecoveryCount > 1 ? "s" : ""} de férié reste{unresolvedHolidayRecoveryCount > 1 ? "nt" : ""} à confirmer. Aucune durée n’est déduite de votre quotité actuelle.</span>
                <b>Confirmer dans Ma paie <span aria-hidden="true">→</span></b>
              </button>
            ) : null}
            <button type="button" className="soft-detail-button overtime-history-toggle" onClick={onToggleOvertimeHistory} aria-expanded={overtimeHistoryOpen}>
              {overtimeHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
            </button>
            {overtimeHistoryOpen ? (
              <div className="overtime-history">
                {!recoveryEarningsCount && !recoveryUses.length ? <p className="empty-state">Aucune heure supplémentaire enregistrée.</p> : null}
                <WorkTimeHistoryList
                  items={historyItems}
                  earningStates={recoveryEarningStates}
                  onDeleteOvertime={onDeleteOvertime}
                  onDeleteRecoveryUse={onDeleteRecoveryUse}
                />
              </div>
            ) : null}
          </section>
          </details>
          <details className="leave-tool-disclosure">
            <summary>
              <span className="leave-tool-illustration mecenat" aria-hidden="true"><img src="/leave-tools/leave-tool-mecenat.webp" alt="" /></span>
              <span className="leave-tool-copy"><strong>Mécénats</strong></span>
              <b>{mecenatEntries.length} enregistré{s(mecenatEntries.length)}</b>
            </summary>
          <section className="overtime-balance-card mecenat-balance-card" aria-labelledby="mecenat-history-title">
            <div className="overtime-balance-heading">
              <div>
                <span className="step-label">Distinct des heures supplémentaires</span>
                <h3 id="mecenat-history-title">Mécénats</h3>
                <p>Les montants bruts sont ajoutés automatiquement à l’estimation du mois suivant.</p>
              </div>
              <strong>{mecenatEntries.length} enregistré{s(mecenatEntries.length)}</strong>
            </div>
            <div className="mecenat-rate-summary" role="group" aria-label="Tarifs réglementaires des mécénats">
              <article><span>Avant 22 h</span><strong>{euros(MECENAT_REGULATORY_RATES.dayRateCents / 100)}/h brut</strong></article>
              <article><span>Après 22 h</span><strong>{euros(MECENAT_REGULATORY_RATES.nightRateCents / 100)}/h brut</strong></article>
            </div>
            <div className="overtime-actions"><button type="button" className="primary-action mecenat-action" onClick={onOpenMecenat}>Déclarer un mécénat</button></div>
            <button type="button" className="soft-detail-button overtime-history-toggle" onClick={onToggleMecenatHistory} aria-expanded={mecenatHistoryOpen}>
              {mecenatHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
            </button>
            {mecenatHistoryOpen ? (
              <div className="overtime-history mecenat-history">
                {!mecenatEntries.length ? <p className="empty-state">Aucun mécénat enregistré.</p> : null}
                <MecenatHistoryList entries={mecenatEntries} onDelete={onDeleteMecenat} />
              </div>
            ) : null}
          </section>
          </details>
          <details className="leave-tool-disclosure cet-disclosure">
            <summary>
              <span className="leave-tool-illustration cet" aria-hidden="true"><img src="/leave-tools/leave-tool-cet.webp" alt="" /></span>
              <span className="leave-tool-copy"><strong>Mon CET</strong></span>
              <b>Consulter et gérer</b>
            </summary>
            {cetContent}
          </details>
        </div>
        {isProgramAdmin ? (
          <section className="leave-request-archive" aria-labelledby="leave-request-archive-title">
            <button className="request-archive-toggle" type="button" onClick={onToggleArchive} aria-expanded={archiveOpen}>
              <span className="request-archive-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 7h5l2 2h7v10H5zM7 4h7l2 2" /></svg></span>
              <span className="request-archive-copy"><strong id="leave-request-archive-title">Demandes archivées</strong></span>
              <span className="request-archive-summary"><small>{archivedRequests.length} PDF</small><span className="request-archive-caret" aria-hidden="true">⌄</span></span>
            </button>
            {archiveOpen ? (
              <div className="request-archive-list">
                {archivedRequests.length ? archivedRequests.map((request) => (
                  <article className="archived-request" key={request.id}>
                    <button className="archived-request-open" type="button" onClick={() => onOpenArchivedRequest(request)}>
                      <span className="archived-request-pdf">PDF</span><span><strong>{request.name}</strong><small>{archivedRequestDate(request.updatedAt)}</small></span>
                    </button>
                    <button className="archived-request-delete" type="button" onClick={() => onDeleteArchivedRequest(request)} aria-label={`Supprimer ${request.name}`}>×</button>
                  </article>
                )) : <p className="request-archive-empty">Aucune demande archivée sur cet appareil.</p>}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </>
  );
}
