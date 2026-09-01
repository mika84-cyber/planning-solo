import { useState, type ReactNode } from "react";
import { euros } from "./appModel";
import { MONTHS } from "./planningLogic";

export type PayDashboardAlert = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
};

export type PayDashboardVariable = {
  key: string;
  label: string;
  quantity: string;
  amount: number | null;
};

type PayDashboardProps = {
  month: number;
  year: number;
  gross: number;
  grossComplete: boolean;
  net: number | null;
  profileLabel: string;
  reliability: {
    tone: "exact" | "estimated" | "incomplete";
    label: string;
    detail: string;
  };
  alerts: PayDashboardAlert[];
  variables: PayDashboardVariable[];
  verificationContent: ReactNode;
  settingsContent: ReactNode;
  settingsOpen: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onOpenEstimateDetails: () => void;
  onOpenAllowances: () => void;
  onToggleSettings: () => void;
};

export function PayDashboard({
  month,
  year,
  gross,
  grossComplete,
  net,
  profileLabel,
  reliability,
  alerts,
  variables,
  verificationContent,
  settingsContent,
  settingsOpen,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onOpenEstimateDetails,
  onOpenAllowances,
  onToggleSettings,
}: PayDashboardProps) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 3);
  const hiddenAlertCount = Math.max(0, alerts.length - 3);

  return (
    <div className="pay-dashboard">
      <header className="pay-dashboard-month" aria-labelledby="pay-dashboard-title">
        <div>
          <span className="step-label">Ma paie</span>
          <h2 id="pay-dashboard-title">{MONTHS[month]} {year}</h2>
        </div>
        <div className="pay-dashboard-month-actions" role="group" aria-label="Choisir le mois de paie">
          <button type="button" className="pay-nav-arrow" onClick={onPreviousMonth} aria-label="Mois précédent">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
          </button>
          <button type="button" className="pay-nav-arrow" onClick={onNextMonth} aria-label="Mois suivant">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
          </button>
          <button type="button" className="pay-today-button" onClick={onToday}>Aujourd’hui</button>
        </div>
      </header>

      <div className="pay-dashboard-priority-grid">
        <section className="pay-dashboard-estimate" aria-labelledby="pay-dashboard-estimate-title">
          <div className="pay-dashboard-estimate-heading">
            <div>
              <span className="step-label">Estimation du mois</span>
              <h3 id="pay-dashboard-estimate-title">Ce que vous devriez recevoir</h3>
            </div>
            <span className={`pay-dashboard-reliability ${reliability.tone}`} title={reliability.detail}>
              {reliability.label}
            </span>
          </div>
          <div className="pay-dashboard-amounts">
            <p className="pay-dashboard-net">
              <span>Net estimé</span>
              <strong>{net === null ? "À compléter" : euros(net)}</strong>
            </p>
            <p className="pay-dashboard-gross">
              <span>Brut estimé</span>
              <strong>{grossComplete ? euros(gross) : "À compléter"}</strong>
            </p>
          </div>
          <p className="pay-dashboard-profile-note">{profileLabel}</p>
          <button type="button" className="secondary-button pay-dashboard-detail-button" onClick={onOpenEstimateDetails}>
            Voir le détail du calcul
          </button>
        </section>

        <section className={`pay-dashboard-checks${alerts.length ? "" : " all-clear"}`} aria-labelledby="pay-dashboard-checks-title">
          <div className="pay-dashboard-card-heading">
            <div>
              <span className="step-label">Actions utiles</span>
              <h3 id="pay-dashboard-checks-title">À vérifier</h3>
            </div>
            {alerts.length ? (
              <span
                className="pay-dashboard-count"
                aria-label={`${alerts.length} action${alerts.length > 1 ? "s" : ""} à effectuer`}
              >
                {alerts.length} action{alerts.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          {alerts.length ? (
            <div className="pay-dashboard-alert-list">
              {visibleAlerts.map((alert) => (
                <article key={alert.id} className="pay-dashboard-alert">
                  <span className="pay-dashboard-alert-symbol" aria-hidden="true">!</span>
                  <div>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </div>
                  <button type="button" className="secondary-button pay-dashboard-alert-action" onClick={alert.onAction}>
                    {alert.actionLabel}<span aria-hidden="true">→</span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="pay-dashboard-all-clear" role="status">
              <span aria-hidden="true">✓</span> <strong>Tout est à jour</strong>
            </p>
          )}
          {hiddenAlertCount ? (
            <button
              type="button"
              className="text-button pay-dashboard-all-checks"
              onClick={() => setShowAllAlerts((current) => !current)}
              aria-expanded={showAllAlerts}
            >
              {showAllAlerts ? "Afficher moins" : `Voir toutes les vérifications (${alerts.length})`}
            </button>
          ) : null}
        </section>
      </div>

      <section className="pay-dashboard-variables" aria-labelledby="pay-dashboard-variables-title">
        <div className="pay-dashboard-card-heading">
          <div>
            <span className="step-label">Éléments variables</span>
            <h3 id="pay-dashboard-variables-title">Prévus sur cette paie</h3>
          </div>
          <button type="button" className="text-button" onClick={onOpenAllowances}>Voir les primes et jours fériés</button>
        </div>
        {variables.length ? (
          <div className="pay-dashboard-variable-list">
            {variables.map((item) => (
              <article key={item.key}>
                <span><strong>{item.label}</strong><small>{item.quantity}</small></span>
                <b className={item.amount === null ? "pending" : item.amount < 0 ? "negative" : ""}>
                  {item.amount === null ? "À vérifier" : euros(item.amount)}
                </b>
              </article>
            ))}
          </div>
        ) : <p className="allowance-note">Aucun élément variable prévu pour ce mois.</p>}
      </section>

      <section id="pay-dashboard-verification" className="pay-dashboard-verification" aria-labelledby="pay-dashboard-verification-title">
        <div className="pay-dashboard-card-heading">
          <div>
            <span className="step-label">Contrôle du mois</span>
            <h3 id="pay-dashboard-verification-title">Vérifier mon bulletin</h3>
            <p>Choisissez le PDF pour comparer ce qui était attendu avec ce qui a été versé.</p>
          </div>
        </div>
        {verificationContent}
      </section>

      <section id="pay-dashboard-settings" className={`pay-dashboard-settings${settingsOpen ? " open" : ""}`}>
        <button
          type="button"
          className="pay-dashboard-settings-toggle"
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-controls="pay-dashboard-settings-content"
        >
          <span><span className="step-label">Moins souvent modifié</span><strong>Réglages et explications</strong></span>
          <span>{settingsOpen ? "Replier" : "Ouvrir"}</span>
          <i aria-hidden="true">⌄</i>
        </button>
        {settingsOpen ? <div id="pay-dashboard-settings-content" className="pay-dashboard-settings-content">{settingsContent}</div> : null}
      </section>
    </div>
  );
}
