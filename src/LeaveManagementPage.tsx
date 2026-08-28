import type { ReactNode } from "react";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES, type MecenatEntry } from "./mecenat";
import { minutesLabel, nextPayPeriod, type OvertimeEntry, type RecoveryUse } from "./overtime";
import { MONTHS, fromKey, longDate, s } from "./planningLogic";
import { archivedRequestDate, type ArchivedRequest } from "./useRequestArchive";

type LeaveManagementPageProps = {
  balancesContent: ReactNode;
  cetContent: ReactNode;
  recoveryBalance: { earned: number; used: number; remaining: number };
  recoveryEarningsCount: number;
  overtimeEntries: OvertimeEntry[];
  holidayRecoveryEarnings: OvertimeEntry[];
  recoveryUses: RecoveryUse[];
  recoveryEarningStates: Map<string, { remainingMinutes: number }>;
  overtimeHistoryOpen: boolean;
  mecenatEntries: MecenatEntry[];
  mecenatHistoryOpen: boolean;
  isProgramAdmin: boolean;
  archiveOpen: boolean;
  archivedRequests: ArchivedRequest[];
  onRequestLeave: () => void;
  onOpenOvertime: () => void;
  onOpenSolidarity: () => void;
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
  cetContent,
  recoveryBalance,
  recoveryEarningsCount,
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
  onRequestLeave,
  onOpenOvertime,
  onOpenSolidarity,
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
  return (
    <>
      <section className="section-intro leave-intro">
        <div>
          <span className="step-label">Congés et récupérations</span>
          <h2>Mes absences et mes demandes</h2>
          <p>Vos soldes sont visibles immédiatement. Touchez une carte, puis une date pour ouvrir la fiche du jour.</p>
        </div>
        <button className="primary-action" type="button" onClick={onRequestLeave}>Poser un congé</button>
      </section>
      {balancesContent}
      <section className="leave-tools-area" aria-label="Récupérations, mécénats et CET">
        <div className="leave-secondary-grid">
          <section className="overtime-balance-card" aria-labelledby="overtime-balance-title">
            <div className="overtime-balance-heading">
              <div>
                <span className="step-label">Récupérations en heures</span>
                <h3 id="overtime-balance-title">Mes heures supplémentaires</h3>
                <p>Les heures à récupérer restent séparées de vos congés en jours.</p>
              </div>
              <strong>{minutesLabel(recoveryBalance.remaining)} disponibles</strong>
            </div>
            <div className="overtime-balance-summary">
              <article><span>Gagnées</span><strong>{minutesLabel(recoveryBalance.earned)}</strong></article>
              <article><span>Utilisées</span><strong>{minutesLabel(recoveryBalance.used)}</strong></article>
              <article className="remaining"><span>Restantes</span><strong>{minutesLabel(recoveryBalance.remaining)}</strong></article>
            </div>
            <div className="overtime-actions">
              <button type="button" className="primary-action" onClick={onOpenOvertime}>Déclarer des heures sup</button>
              <button type="button" className="secondary-button solidarity-hours-action" onClick={onOpenSolidarity}>Ajouter des heures manuellement</button>
            </div>
            <button type="button" className="soft-detail-button overtime-history-toggle" onClick={onToggleOvertimeHistory} aria-expanded={overtimeHistoryOpen}>
              {overtimeHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
            </button>
            {overtimeHistoryOpen ? (
              <div className="overtime-history">
                {!recoveryEarningsCount && !recoveryUses.length ? <p className="empty-state">Aucune heure supplémentaire enregistrée.</p> : null}
                {[...overtimeEntries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => {
                  const payPeriod = nextPayPeriod(entry.date);
                  const state = recoveryEarningStates.get(entry.id);
                  return (
                    <article key={entry.id}>
                      <span className={`overtime-kind ${entry.disposition}`} aria-hidden="true" />
                      <div>
                        <strong>{entry.id.startsWith("solidarity-") ? `Heures de solidarité · +${minutesLabel(entry.minutes)}` : `${minutesLabel(entry.minutes)} · ${entry.disposition === "paid" ? "À payer" : "À récupérer"}`}</strong>
                        <span>{longDate(fromKey(entry.date))}</span>
                        <small>
                          {entry.id.startsWith("solidarity-")
                            ? state?.remainingMinutes ? `${minutesLabel(state.remainingMinutes)} encore disponibles sur cet ajout manuel` : "Ajout manuel entièrement utilisé"
                            : entry.disposition === "paid"
                              ? `Paiement prévu en ${MONTHS[payPeriod.month]} ${payPeriod.year}`
                              : state?.remainingMinutes ? `${minutesLabel(state.remainingMinutes)} encore disponibles sur ce gain` : "Gain entièrement utilisé"}
                        </small>
                      </div>
                      <button type="button" onClick={() => onDeleteOvertime(entry)}>Supprimer</button>
                    </article>
                  );
                })}
                {[...holidayRecoveryEarnings].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => {
                  const state = recoveryEarningStates.get(entry.id);
                  return (
                    <article key={entry.id} className="holiday-recovery-history">
                      <span className="overtime-kind recovery" aria-hidden="true" />
                      <div>
                        <strong>Prime + récupération · +{minutesLabel(entry.minutes)}</strong>
                        <span>{longDate(fromKey(entry.date))}</span>
                        <small>Crédit automatique selon votre quotité{state?.remainingMinutes ? ` · ${minutesLabel(state.remainingMinutes)} disponibles` : " · gain utilisé"}</small>
                      </div>
                    </article>
                  );
                })}
                {[...recoveryUses].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
                  <article key={entry.id} className="recovery-use-history">
                    <span className="overtime-kind used" aria-hidden="true" />
                    <div>
                      <strong>− {minutesLabel(entry.minutes)} · {entry.kind === "training" ? "Formation" : "Récupération posée"}</strong>
                      <span>{longDate(fromKey(entry.date))}</span>
                      <small>{entry.kind === "training" ? "Formation déduite comme récupération en heures" : "Déduite du solde en heures"}</small>
                    </div>
                    <button type="button" onClick={() => onDeleteRecoveryUse(entry)}>Annuler</button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
          <section className="overtime-balance-card mecenat-balance-card" aria-labelledby="mecenat-history-title">
            <div className="overtime-balance-heading">
              <div>
                <span className="step-label">Distinct des heures supplémentaires</span>
                <h3 id="mecenat-history-title">Mécénats</h3>
                <p>Les montants bruts sont ajoutés automatiquement à l’estimation du mois suivant.</p>
              </div>
              <strong>{mecenatEntries.length} enregistré{s(mecenatEntries.length)}</strong>
            </div>
            <div className="mecenat-rate-summary" aria-label="Tarifs réglementaires des mécénats">
              <article><span>De 7 h à 22 h</span><strong>{euros(MECENAT_REGULATORY_RATES.dayRateCents / 100)}/h brut</strong></article>
              <article><span>De 22 h à 7 h</span><strong>{euros(MECENAT_REGULATORY_RATES.nightRateCents / 100)}/h brut</strong></article>
            </div>
            <div className="overtime-actions"><button type="button" className="primary-action mecenat-action" onClick={onOpenMecenat}>Déclarer un mécénat</button></div>
            <button type="button" className="soft-detail-button overtime-history-toggle" onClick={onToggleMecenatHistory} aria-expanded={mecenatHistoryOpen}>
              {mecenatHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
            </button>
            {mecenatHistoryOpen ? (
              <div className="overtime-history mecenat-history">
                {!mecenatEntries.length ? <p className="empty-state">Aucun mécénat enregistré.</p> : null}
                {[...mecenatEntries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
                  <article key={entry.id}>
                    <span className="overtime-kind mecenat" aria-hidden="true" />
                    <div>
                      <strong>{entry.start} → {entry.end} · {euros(entry.grossAmountCents / 100)} brut</strong>
                      <span>{longDate(fromKey(entry.date))} · {minutesLabel(entry.dayMinutes + entry.nightMinutes)}</span>
                      <small>Intégré automatiquement à la paie du mois suivant</small>
                    </div>
                    <button type="button" onClick={() => onDeleteMecenat(entry)}>Supprimer</button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
        {cetContent}
        {isProgramAdmin ? (
          <section className="leave-request-archive" aria-labelledby="leave-request-archive-title">
            <button className="request-archive-toggle" type="button" onClick={onToggleArchive} aria-expanded={archiveOpen}>
              <span className="request-archive-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 7h5l2 2h7v10H5zM7 4h7l2 2" /></svg></span>
              <span className="request-archive-copy"><strong id="leave-request-archive-title">Autre</strong><span className="step-label">Mes demandes archivées</span><small>Documents conservés sur cet appareil</small></span>
              <span className="request-archive-summary"><small>{archivedRequests.length} formulaire{s(archivedRequests.length)}</small><span className="request-archive-caret" aria-hidden="true">⌄</span></span>
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
