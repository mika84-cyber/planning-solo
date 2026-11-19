import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useHelpTarget } from "./helpTargets";
import { isLeaveTool, LeaveToolWindow, type LeaveTool } from "./LeaveToolWindow";
import { MecenatRegularisationNote } from "./MecenatRegularisationNote";
import { MecenatSignupList } from "./MecenatSignupList";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES, mecenatRateLabels, pendingNightMajoration, type MecenatEntry, type MecenatSignup } from "./mecenat";
import { minutesLabel, overtimePayPeriod, type OvertimeEntry, type RecoveryUse } from "./overtime";
import { MONTHS, dateKey, s } from "./planningLogic";
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
  /** La rubrique ouverte à l’arrivée (tests de rendu). */
  initialTool?: LeaveTool | null;
  recoveryBalance: { earned: number; used: number; remaining: number };
  recoveryEarningsCount: number;
  unresolvedHolidayRecoveryCount: number;
  overtimeEntries: OvertimeEntry[];
  holidayRecoveryEarnings: OvertimeEntry[];
  recoveryUses: RecoveryUse[];
  recoveryEarningStates: Map<string, { earnedMinutes: number; remainingMinutes: number }>;
  overtimeHistoryOpen: boolean;
  /** Montant brut estimé des heures à payer d'une paie, et ce qui dépasse le plafond. */
  paidOvertimeEstimate?: (year: number, month: number) => { ready: boolean; amount: number; cappedMinutes: number; capMinutes: number };
  mecenatEntries: MecenatEntry[];
  mecenatHistoryOpen: boolean;
  mecenatSignups: MecenatSignup[];
  mecenatSignupsOpen: boolean;
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
  onToggleMecenatSignups: () => void;
  onAddMecenatSignup: (date: string, start: string, end: string) => void;
  onRetainMecenatSignup: (signup: MecenatSignup) => void;
  onDeleteMecenatSignup: (signup: MecenatSignup) => void;
  onToggleArchive: () => void;
  onOpenArchivedRequest: (request: ArchivedRequest) => void;
  onDeleteArchivedRequest: (request: ArchivedRequest) => void;
};

export function LeaveManagementPage({
  balancesContent,
  longAbsenceContent,
  cetContent,
  initialTool = null,
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
  mecenatSignups,
  mecenatSignupsOpen,
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
  onToggleMecenatSignups,
  onAddMecenatSignup,
  onRetainMecenatSignup,
  onDeleteMecenatSignup,
  onToggleArchive,
  onOpenArchivedRequest,
  onDeleteArchivedRequest,
}: LeaveManagementPageProps) {
  const todayKey = dateKey(new Date());
  const pendingMajoration = useMemo(() => pendingNightMajoration(mecenatEntries, todayKey), [mecenatEntries, todayKey]);
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
  // Chaque rubrique s'ouvre dans sa fenêtre, que « Retour » referme sur le
  // menu des trois tuiles. La fenêtre est une entrée de l'historique : le
  // bouton Retour du téléphone la referme aussi, au lieu de quitter la page.
  const toolsRef = useRef<HTMLElement>(null);
  const [tool, setTool] = useState<LeaveTool | null>(initialTool);
  useEffect(() => {
    // Une entrée de fenêtre héritée (page quittée fenêtre ouverte) : la page
    // s'ouvre toujours sur le menu.
    if (history.state?.leaveTool) history.replaceState({ ...history.state, leaveTool: undefined }, "", location.href);
    const restore = (event: PopStateEvent) => setTool(isLeaveTool(event.state?.leaveTool) ? event.state.leaveTool : null);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const openTool = (next: LeaveTool) => {
    const state = { ...(history.state || {}), leaveTool: next };
    if (history.state?.leaveTool) history.replaceState(state, "", location.href);
    else history.pushState(state, "", location.href);
    setTool(next);
  };
  const closeTool = () => {
    // Refermée par « Retour » : son entrée d'historique s'en va avec elle.
    if (history.state?.leaveTool) history.back();
    else setTool(null);
  };
  // La fenêtre d'aide amène aux heures et mécénats, ou ouvre le CET ; le
  // rappel de l'accueil l'ouvre avec son formulaire d'alimentation ou sa
  // demande d'ouverture, que la rubrique Mon CET ouvre elle-même (la demande
  // lui est laissée : elle se monte après sa fenêtre).
  useHelpTarget((target) => {
    if (target === "cet" || target === "cet-funding" || target === "cet-opening") {
      openTool("cet");
      return target === "cet";
    }
    const tools = target === "overtime-mecenat" ? toolsRef.current : null;
    if (!tools) return false;
    // Les soldes au-dessus se chargent à part : on attend qu'ils aient pris
    // leur place avant de descendre.
    window.setTimeout(() => tools.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    return true;
  });
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
      <section className="leave-tools-area" aria-label="Récupérations, mécénats et CET" ref={toolsRef}>
        {/* Trois tuiles : chacune ouvre sa rubrique dans une fenêtre, avec
            « Retour » pour revenir à ce menu. */}
        <div className="leave-secondary-grid">
          <button type="button" className="leave-tool-tile" aria-haspopup="dialog" onClick={() => openTool("overtime")}>
            <span className="leave-tool-illustration work-time" aria-hidden="true"><img src="/leave-tools/leave-tool-overtime.webp" alt="" /></span>
            <span className="leave-tool-copy"><strong>Heures supp et récupérations</strong></span>
            <b>{minutesLabel(recoveryBalance.remaining)}</b>
          </button>
          <button type="button" className="leave-tool-tile" aria-haspopup="dialog" onClick={() => openTool("mecenat")}>
            <span className="leave-tool-illustration mecenat" aria-hidden="true"><img src="/leave-tools/leave-tool-mecenat.webp" alt="" /></span>
            <span className="leave-tool-copy"><strong>Mécénats</strong></span>
            <b>{mecenatEntries.length} enregistré{s(mecenatEntries.length)}</b>
          </button>
          <button type="button" className="leave-tool-tile cet-tile" aria-haspopup="dialog" onClick={() => openTool("cet")}>
            <span className="leave-tool-illustration cet" aria-hidden="true"><img src="/leave-tools/leave-tool-cet.webp" alt="" /></span>
            <span className="leave-tool-copy"><strong>Mon CET</strong></span>
            <b>Consulter et gérer</b>
          </button>
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
      {tool ? (
        <LeaveToolWindow labelledBy={tool === "overtime" ? "overtime-balance-title" : tool === "mecenat" ? "mecenat-history-title" : "cet-title"} onClose={closeTool}>
          {tool === "overtime" ? (
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
                <article><span>À payer</span><strong>{minutesLabel(nextPaidMinutes)}</strong><small>{nextPaidPeriod ? `${MONTHS[nextPaidPeriod.month]} ${nextPaidPeriod.year}${nextPaidEstimate?.ready && nextPaidEstimate.amount ? ` · ≈ ${euros(nextPaidEstimate.amount)} brut` : ""}` : "Aucune heure prévue"}</small>{nextPaidEstimate?.cappedMinutes ? <small className="overtime-capped-note">{minutesLabel(nextPaidEstimate.cappedMinutes)} au-delà du plafond de {minutesLabel(nextPaidEstimate.capMinutes)} : non payées</small> : null}</article>
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
          ) : tool === "mecenat" ? (
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
                <article><span>{mecenatRateLabels().day}</span><strong>{euros(MECENAT_REGULATORY_RATES.dayRateCents / 100)}/h brut</strong></article>
                <article><span>{mecenatRateLabels().night}</span><strong>{euros(MECENAT_REGULATORY_RATES.nightRateCents / 100)}/h brut</strong></article>
              </div>
              <MecenatRegularisationNote pending={pendingMajoration} />
              {/* Les trois actions sur une rangée : déclarer, puis les deux
                  volets qui s'ouvrent dessous — les dates où l'on s'est inscrit
                  (à retenir ou à effacer) et l'historique. Sur téléphone, elles
                  s'empilent sur toute la largeur. */}
              <div className="overtime-actions mecenat-actions">
                <button type="button" className="primary-action mecenat-action" onClick={onOpenMecenat}>Déclarer un mécénat</button>
                <button type="button" className="soft-detail-button mecenat-signups-toggle" onClick={onToggleMecenatSignups} aria-expanded={mecenatSignupsOpen}>
                  {mecenatSignupsOpen ? "Masquer mes dates d’inscription" : `Mes dates d’inscription${mecenatSignups.length ? ` (${mecenatSignups.length})` : ""}`}
                </button>
                <button type="button" className="soft-detail-button mecenat-history-toggle" onClick={onToggleMecenatHistory} aria-expanded={mecenatHistoryOpen}>
                  {mecenatHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
                </button>
              </div>
              {mecenatSignupsOpen ? (
                <MecenatSignupList signups={mecenatSignups} onAdd={onAddMecenatSignup} onRetain={onRetainMecenatSignup} onDelete={onDeleteMecenatSignup} />
              ) : null}
              {mecenatHistoryOpen ? (
                <div className="overtime-history mecenat-history">
                  {!mecenatEntries.length ? <p className="empty-state">Aucun mécénat enregistré.</p> : null}
                  <MecenatHistoryList entries={mecenatEntries} onDelete={onDeleteMecenat} />
                </div>
              ) : null}
            </section>
          ) : cetContent}
        </LeaveToolWindow>
      ) : null}
    </>
  );
}
