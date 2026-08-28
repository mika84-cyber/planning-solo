import type { ReactNode, TouchEventHandler } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { PAY_STATUS_OPTIONS, type PayStatus } from "./appModel";
import { WORK_QUOTA_OPTIONS, minutesLabel, type WorkQuota } from "./overtime";
import { MONTHS } from "./planningLogic";

export type PayScreen = "overview" | "allowances" | "payslip";

type PayPageProps = {
  screen: PayScreen;
  month: number;
  year: number;
  profileOpen: boolean;
  workQuota: WorkQuota;
  status: PayStatus;
  workDayMinutes: number;
  netEstimateComplete: boolean;
  monthSlide: string;
  allowancesContent: ReactNode;
  payslipContent: ReactNode;
  onScreenChange: (screen: PayScreen) => void;
  onToggleProfile: () => void;
  onWorkQuotaChange: (quota: WorkQuota) => void;
  onStatusChange: (status: PayStatus) => void;
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
};

export function PayPage({
  screen,
  month,
  year,
  profileOpen,
  workQuota,
  status,
  workDayMinutes,
  netEstimateComplete,
  monthSlide,
  allowancesContent,
  payslipContent,
  onScreenChange,
  onToggleProfile,
  onWorkQuotaChange,
  onStatusChange,
  onTouchStart,
  onTouchEnd,
}: PayPageProps) {
  return (
    <section className="pay-app-screen" aria-label="Ma paie">
      {screen === "overview" ? (
        <>
          <div className="native-screen-heading pay-overview-intro">
            <span className="step-label">Ma paie</span>
            <h2>Ma paie en un coup d’œil</h2>
            <p>Réglez votre profil, puis retrouvez vos primes, vos estimations et vos bulletins.</p>
          </div>
          <section className="pay-overview-profile-panel" aria-labelledby="pay-overview-profile-title">
            <div className="pay-overview-section-heading">
              <span className="pay-overview-number profile" aria-hidden="true">1</span>
              <div>
                <h3 id="pay-overview-profile-title">Mes réglages</h3>
                <p>Les calculs s’adaptent automatiquement à votre situation.</p>
              </div>
            </div>
            <section className={`pay-profile-settings${profileOpen ? " open" : ""}`} aria-labelledby="pay-profile-settings-title">
              <button
                type="button"
                className="pay-profile-summary"
                onClick={onToggleProfile}
                aria-expanded={profileOpen}
              >
                <span className="pay-profile-symbol" aria-hidden="true">P</span>
                <span className="pay-profile-summary-copy">
                  <span className="step-label">Profil utilisé pour les calculs</span>
                  <strong id="pay-profile-settings-title">Mon profil de paie</strong>
                  <small>
                    {WORK_QUOTA_OPTIONS.find((option) => option.value === workQuota)?.label}
                    {" · "}
                    {PAY_STATUS_OPTIONS.find((option) => option.value === status)?.label}
                  </small>
                  {netEstimateComplete ? (
                    <span className="pay-profile-completeness complete" title="Les informations nécessaires à l’estimation du mois sont renseignées.">
                      Profil complet
                    </span>
                  ) : null}
                </span>
                <span className="pay-profile-open-copy">{profileOpen ? "Replier" : "Modifier"}</span>
                <i aria-hidden="true">⌄</i>
              </button>
              {profileOpen ? (
                <div className="pay-profile-settings-grid">
                  <label>
                    <span>Quotité de travail</span>
                    <ChoicePicker
                      value={workQuota}
                      options={WORK_QUOTA_OPTIONS.map(({ value, label }) => ({ value, label }))}
                      onChange={onWorkQuotaChange}
                      ariaLabel="Choisir la quotité de travail"
                      layout="list"
                      className="pay-profile-picker"
                    />
                    <small>{minutesLabel(workDayMinutes)} par jour</small>
                  </label>
                  <label>
                    <span>Statut</span>
                    <ChoicePicker
                      value={status}
                      options={PAY_STATUS_OPTIONS}
                      onChange={onStatusChange}
                      ariaLabel="Choisir le statut"
                      layout="list"
                      className="pay-profile-picker"
                    />
                    <small>Calculs adaptés à votre statut</small>
                  </label>
                </div>
              ) : null}
            </section>
          </section>
          <section className="pay-overview-category-panel" aria-labelledby="pay-overview-category-title">
            <div className="pay-overview-section-heading">
              <span className="pay-overview-number categories" aria-hidden="true">2</span>
              <div>
                <h3 id="pay-overview-category-title">Consulter ma paie</h3>
                <p>Choisissez les informations que vous souhaitez retrouver.</p>
              </div>
            </div>
            <div className="pay-category-grid">
              <button type="button" onClick={() => onScreenChange("allowances")}>
                <span className="pay-category-icon allowances" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" /></svg>
                </span>
                <span className="pay-category-copy">
                  <span className="pay-category-kicker">Éléments variables</span>
                  <strong>Primes et jours fériés</strong>
                  <small>Dimanches, fériés, heures payées et mécénats</small>
                  <span className="pay-category-cta">Voir le détail <i aria-hidden="true">→</i></span>
                </span>
              </button>
              <button type="button" onClick={() => onScreenChange("payslip")}>
                <span className="pay-category-icon payslip" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h4" /></svg>
                </span>
                <span className="pay-category-copy">
                  <span className="pay-category-kicker">Estimation mensuelle</span>
                  <strong>Bulletins et estimations</strong>
                  <small>Vérifier un bulletin et consulter le détail de la paie</small>
                  <span className="pay-category-cta">Ouvrir l’estimation <i aria-hidden="true">→</i></span>
                </span>
              </button>
            </div>
          </section>
        </>
      ) : (
        <div className="pay-detail-screen">
          <header className="pay-detail-sticky-header">
            <button className="native-back-button" type="button" onClick={() => onScreenChange("overview")} aria-label="Revenir aux catégories de paie">
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" className="pay-detail-title-button" onClick={() => onScreenChange("overview")} aria-label="Fermer cette catégorie et revenir à Ma paie">
              <span className="step-label">Ma paie</span>
              <h2>{screen === "allowances" ? "Primes et jours fériés" : "Bulletins et estimations"}</h2>
              <small>{MONTHS[month]} {year}</small>
            </button>
            <button className="pay-detail-close" type="button" onClick={() => onScreenChange("overview")} aria-label="Fermer cette catégorie">×</button>
          </header>
          {screen === "allowances" ? (
            <div className={`request-archive-content allowances pay-dedicated-content${monthSlide ? ` pay-month-${monthSlide}` : ""}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              {allowancesContent}
            </div>
          ) : (
            <div className={`pay-dedicated-content${monthSlide ? ` pay-month-${monthSlide}` : ""}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <aside className="payslip-leave-notice" aria-label="Conseil pour une estimation correcte">
                <span aria-hidden="true">i</span>
                <p><strong>Avant de vérifier votre bulletin</strong>Pour que l’estimation soit correcte, renseignez dans le planning tous vos congés validés.</p>
              </aside>
              {payslipContent}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
