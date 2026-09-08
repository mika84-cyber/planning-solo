import { useMemo, useState, type ReactNode } from "react";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES, type MecenatEntry } from "./mecenat";
import { minutesLabel, nextPayPeriod, type OvertimeEntry, type RecoveryUse } from "./overtime";
import { MONTHS, fromKey, longDate, s } from "./planningLogic";
import { archivedRequestDate, type ArchivedRequest } from "./useRequestArchive";

export type WorkTimeHistoryFilter = "all" | "gains" | "uses" | "paid";

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
  cetContent: ReactNode;
  recoveryBalance: { earned: number; used: number; remaining: number };
  recoveryEarningsCount: number;
  unresolvedHolidayRecoveryCount: number;
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
  const [historyFilter, setHistoryFilter] = useState<WorkTimeHistoryFilter>("all");
  const historyItems = useMemo(
    () => workTimeHistoryItems(overtimeEntries, holidayRecoveryEarnings, recoveryUses),
    [overtimeEntries, holidayRecoveryEarnings, recoveryUses],
  );
  const filteredHistory = historyItems.filter((item) => historyFilter === "all"
    || (historyFilter === "gains" && (item.kind === "gain" || item.kind === "holiday"))
    || (historyFilter === "uses" && item.kind === "use")
    || (historyFilter === "paid" && item.kind === "paid"));
  const paidPeriods = overtimeEntries
    .filter((entry) => entry.disposition === "paid")
    .map((entry) => ({ ...nextPayPeriod(entry.date), minutes: entry.minutes }));
  const currentPayKey = new Date().getFullYear() * 12 + new Date().getMonth();
  const nextPaidPeriod = paidPeriods.filter((period) => period.year * 12 + period.month >= currentPayKey).sort((a, b) => a.year - b.year || a.month - b.month)[0];
  const nextPaidMinutes = nextPaidPeriod
    ? paidPeriods.filter((period) => period.year === nextPaidPeriod.year && period.month === nextPaidPeriod.month).reduce((sum, period) => sum + period.minutes, 0)
    : 0;
  return (
    <>
      {balancesContent}
      <section className="leave-tools-area" aria-label="Récupérations, mécénats et CET">
        <div className="leave-secondary-grid">
          <details className="leave-tool-disclosure">
            <summary>
              <span className="leave-tool-illustration work-time" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="30" cy="34" r="18" /><path d="M30 16v-6m-7 0h14M30 24v11l8 5" /><circle cx="48" cy="18" r="9" /><path d="M48 14v8m-4-4h8" /></svg></span>
              <span className="leave-tool-copy"><small>Temps de travail</small><strong>Heures sup et récupérations</strong></span>
              <b>{minutesLabel(recoveryBalance.remaining)}</b><i aria-hidden="true" />
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
              <article><span>À payer</span><strong>{minutesLabel(nextPaidMinutes)}</strong><small>{nextPaidPeriod ? `${MONTHS[nextPaidPeriod.month]} ${nextPaidPeriod.year}` : "Aucune heure prévue"}</small></article>
            </div>
            <div className="overtime-actions">
              <button type="button" className="primary-action" onClick={onOpenOvertime}>Déclarer des heures sup</button>
              <button type="button" className="secondary-button solidarity-hours-action" onClick={onOpenSolidarity}>Ajouter des heures manuellement</button>
            </div>
            {unresolvedHolidayRecoveryCount ? (
              <p className="allowance-note warn">{unresolvedHolidayRecoveryCount} ancien{unresolvedHolidayRecoveryCount > 1 ? "s" : ""} crédit{unresolvedHolidayRecoveryCount > 1 ? "s" : ""} de férié reste{unresolvedHolidayRecoveryCount > 1 ? "nt" : ""} à confirmer dans Ma paie &gt; Primes et jours fériés. Aucune durée n’est déduite de votre quotité actuelle.</p>
            ) : null}
            <button type="button" className="soft-detail-button overtime-history-toggle" onClick={onToggleOvertimeHistory} aria-expanded={overtimeHistoryOpen}>
              {overtimeHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
            </button>
            {overtimeHistoryOpen ? (
              <div className="overtime-history">
                <div className="overtime-history-filters" role="group" aria-label="Filtrer l’historique">
                  {([["all", "Tout"], ["gains", "Gains"], ["uses", "Récupérations posées"], ["paid", "Heures à payer"]] as const).map(([value, label]) => (
                    <button key={value} type="button" className={historyFilter === value ? "active" : ""} aria-pressed={historyFilter === value} onClick={() => setHistoryFilter(value)}>{label}</button>
                  ))}
                </div>
                {!recoveryEarningsCount && !recoveryUses.length ? <p className="empty-state">Aucune heure supplémentaire enregistrée.</p> : null}
                {!filteredHistory.length && historyItems.length ? <p className="empty-state">Aucun élément pour ce filtre.</p> : null}
                {filteredHistory.map((item) => {
                  if (item.kind === "use") {
                    const entry = item.entry as RecoveryUse;
                    return (
                      <article key={entry.id} className="recovery-use-history">
                        <span className="overtime-kind used" aria-hidden="true" />
                        <div><strong>− {minutesLabel(entry.minutes)} · {entry.kind === "training" ? "Formation" : "Récupération consommée"}</strong><span>{longDate(fromKey(entry.date))}</span><small>{entry.kind === "training" ? "Formation déduite du solde" : "Récupération posée"}</small></div>
                        <button type="button" onClick={() => onDeleteRecoveryUse(entry)}>Annuler</button>
                      </article>
                    );
                  }
                  const entry = item.entry as OvertimeEntry;
                  if (item.kind === "holiday") {
                    const state = recoveryEarningStates.get(entry.id);
                    return <article key={entry.id} className="holiday-recovery-history"><span className="overtime-kind recovery" aria-hidden="true" /><div><strong>Férié · +{minutesLabel(entry.minutes)}</strong><span>{longDate(fromKey(entry.date))}</span><small>{state?.remainingMinutes ? `${minutesLabel(state.remainingMinutes)} disponibles` : "Gain utilisé"}</small></div></article>;
                  }
                  const payPeriod = nextPayPeriod(entry.date);
                  const state = recoveryEarningStates.get(entry.id);
                  return (
                    <article key={entry.id}>
                      <span className={`overtime-kind ${entry.disposition}`} aria-hidden="true" />
                      <div>
                        <strong>{entry.id.startsWith("solidarity-") ? `Ajout manuel · +${minutesLabel(entry.minutes)}` : `Heures sup · ${minutesLabel(entry.minutes)} · ${entry.disposition === "paid" ? "À payer" : "À récupérer"}`}</strong>
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
              </div>
            ) : null}
          </section>
          </details>
          <details className="leave-tool-disclosure">
            <summary>
              <span className="leave-tool-illustration mecenat" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="m32 10 5.5 11.5L50 23l-9 8.5L43.5 44 32 38l-11.5 6L23 31.5 14 23l12.5-1.5L32 10Z" /><path d="M12 47c7-3 13-2 20 3 7-5 13-6 20-3M16 53h32" /></svg></span>
              <span className="leave-tool-copy"><small>Activités ponctuelles</small><strong>Mécénats</strong></span>
              <b>{mecenatEntries.length} enregistré{s(mecenatEntries.length)}</b><i aria-hidden="true" />
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
          </details>
          <details className="leave-tool-disclosure cet-disclosure">
            <summary>
              <span className="leave-tool-illustration cet" aria-hidden="true"><svg viewBox="0 0 64 64"><rect x="10" y="13" width="44" height="40" rx="7" /><path d="M10 25h44M21 9v9m22-9v9" /><circle cx="35" cy="39" r="10" /><path d="M35 33v7l5 3" /></svg></span>
              <span className="leave-tool-copy"><small>Compte épargne-temps</small><strong>Mon CET</strong></span>
              <b>Consulter et gérer</b><i aria-hidden="true" />
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
