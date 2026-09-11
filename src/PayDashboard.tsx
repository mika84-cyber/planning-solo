import type { ReactNode } from "react";
import { euros } from "./appModel";
import { MONTHS } from "./planningLogic";

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
  missingFields?: string[];
  onCompleteEstimate?: () => void;
  reliability: {
    tone: "exact" | "estimated" | "incomplete";
    label: string;
    detail: string;
  };
  variables: PayDashboardVariable[];
  profileContent: ReactNode;
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
  missingFields = [],
  onCompleteEstimate,
  reliability,
  variables,
  profileContent,
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
  const monthLabel = MONTHS[month].charAt(0).toUpperCase() + MONTHS[month].slice(1);
  return (
    <div className="pay-dashboard">
      <header className="pay-dashboard-month">
        <div>
          <span className="step-label">Ma paie</span>
          <h2 id="pay-dashboard-title">{monthLabel} {year}</h2>
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
            {/* `is-missing` ne sert qu'à l'apparence : une absence de valeur
                ne doit pas se lire comme un montant. */}
            <p className={`pay-dashboard-net${net === null ? " is-missing" : ""}`}>
              <span>Net estimé</span>
              <strong>{net === null ? "À compléter" : euros(net)}</strong>
            </p>
            <p className={`pay-dashboard-gross${grossComplete ? "" : " is-missing"}`}>
              <span>Brut estimé</span>
              <strong>{grossComplete ? euros(gross) : "À compléter"}</strong>
            </p>
          </div>
          <p className="pay-dashboard-profile-note">{profileLabel}</p>
          {(net === null || !grossComplete) && missingFields.length > 0 ? <div className="pay-missing-guidance">
            <div className="pay-import-heading">
              <span className="pay-import-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" /></svg></span>
              <div><strong>Votre estimation commence ici</strong><p>Ajoutez votre bulletin de paie. Les informations reconnues sont complétées automatiquement.</p></div>
            </div>
            <button type="button" className="primary-action" onClick={() => {
              const section = document.getElementById("pay-dashboard-verification");
              section?.scrollIntoView({ behavior: "smooth", block: "start" });
              section?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
            }}>Ajouter mon bulletin</button>
            <div className="pay-import-secondary">
              <button type="button" className="text-button" onClick={onCompleteEstimate}>Compléter manuellement si besoin</button>
            </div>
          </div> : null}
          <button type="button" className="secondary-button pay-dashboard-detail-button" onClick={onOpenEstimateDetails}>
            Voir le détail du calcul <span aria-hidden="true">→</span>
          </button>
        </section>

      </div>

      <section className="pay-dashboard-variables" aria-labelledby="pay-dashboard-variables-title">
        <div className="pay-dashboard-card-heading">
          <div>
            <span className="step-label">Éléments variables</span>
            <h3 id="pay-dashboard-variables-title">Prévus sur cette paie</h3>
          </div>
          <button type="button" className="text-button pay-inline-action" onClick={onOpenAllowances}>Primes et jours fériés <span aria-hidden="true">→</span></button>
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

      <div className="pay-dashboard-profile-slot">{profileContent}</div>

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
