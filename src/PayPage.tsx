import type { ReactNode, TouchEventHandler } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { PayDashboard, type PayDashboardAlert, type PayDashboardVariable } from "./PayDashboard";
import { PAY_STATUS_OPTIONS, type PayStatus } from "./appModel";
import { WORK_QUOTA_OPTIONS, minutesLabel, type WorkQuota } from "./overtime";
import { MONTHS } from "./planningLogic";

export type PayScreen = "overview" | "allowances" | "payslip";

type PayPageProps = {
  screen: PayScreen;
  month: number;
  year: number;
  profileOpen: boolean;
  settingsOpen: boolean;
  workQuota: WorkQuota;
  status: PayStatus;
  workDayMinutes: number;
  netEstimateComplete: boolean;
  gross: number;
  grossComplete: boolean;
  net: number | null;
  profileLabel: string;
  reliability: { tone: "exact" | "estimated" | "incomplete"; label: string; detail: string };
  alerts: PayDashboardAlert[];
  variables: PayDashboardVariable[];
  monthSlide: string;
  allowancesContent: ReactNode;
  estimateContent: ReactNode;
  verificationContent: ReactNode;
  settingsContent: ReactNode;
  onScreenChange: (screen: PayScreen) => void;
  onToggleProfile: () => void;
  onToggleSettings: () => void;
  onWorkQuotaChange: (quota: WorkQuota) => void;
  onStatusChange: (status: PayStatus) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
};

export function PayPage({
  screen, month, year, profileOpen, settingsOpen, workQuota, status,
  workDayMinutes, netEstimateComplete, gross, grossComplete, net, profileLabel,
  reliability, alerts, variables, monthSlide, allowancesContent, estimateContent,
  verificationContent, settingsContent, onScreenChange, onToggleProfile,
  onToggleSettings, onWorkQuotaChange, onStatusChange, onPreviousMonth,
  onNextMonth, onToday, onTouchStart, onTouchEnd,
}: PayPageProps) {
  const profileContent = (
    <section className={`pay-profile-settings${profileOpen ? " open" : ""}`} aria-labelledby="pay-profile-settings-title">
      <button type="button" className="pay-profile-summary" onClick={onToggleProfile} aria-expanded={profileOpen}>
        <span className="pay-profile-symbol" aria-hidden="true">P</span>
        <span className="pay-profile-summary-copy">
          <span className="step-label">Profil utilisé pour les calculs</span>
          <strong id="pay-profile-settings-title">Mon profil de paie</strong>
          <small>{WORK_QUOTA_OPTIONS.find((option) => option.value === workQuota)?.label}{" · "}{PAY_STATUS_OPTIONS.find((option) => option.value === status)?.label}</small>
          {netEstimateComplete ? <span className="pay-profile-completeness complete">Profil complet</span> : null}
        </span>
        <span className="pay-profile-open-copy">{profileOpen ? "Replier" : "Modifier"}</span>
        <i aria-hidden="true">⌄</i>
      </button>
      {profileOpen ? (
        <div className="pay-profile-settings-grid">
          <label>
            <span>Quotité de travail</span>
            <ChoicePicker value={workQuota} options={WORK_QUOTA_OPTIONS.map(({ value, label }) => ({ value, label }))} onChange={onWorkQuotaChange} ariaLabel="Choisir la quotité de travail" layout="list" className="pay-profile-picker" />
            <small>{minutesLabel(workDayMinutes)} par jour</small>
          </label>
          <label>
            <span>Statut</span>
            <ChoicePicker value={status} options={PAY_STATUS_OPTIONS} onChange={onStatusChange} ariaLabel="Choisir le statut" layout="list" className="pay-profile-picker" />
            <small>Calculs adaptés à votre statut</small>
          </label>
        </div>
      ) : null}
    </section>
  );

  return (
    <section className="pay-app-screen" aria-label="Ma paie">
      {screen === "overview" ? (
        <div className={`pay-dashboard-motion${monthSlide ? ` pay-month-${monthSlide}` : ""}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <PayDashboard
            key={`${year}-${month}`}
            month={month} year={year} gross={gross} grossComplete={grossComplete}
            net={net} profileLabel={profileLabel} reliability={reliability}
            alerts={alerts} variables={variables} verificationContent={verificationContent}
            settingsContent={<>{profileContent}{settingsContent}</>} settingsOpen={settingsOpen}
            onPreviousMonth={onPreviousMonth} onNextMonth={onNextMonth} onToday={onToday}
            onOpenEstimateDetails={() => onScreenChange("payslip")}
            onOpenAllowances={() => onScreenChange("allowances")}
            onToggleSettings={onToggleSettings}
          />
        </div>
      ) : (
        <div className="pay-detail-screen">
          <header className="pay-detail-sticky-header">
            <button className="native-back-button" type="button" onClick={() => onScreenChange("overview")} aria-label="Revenir au tableau de bord de paie"><span aria-hidden="true">←</span></button>
            <button type="button" className="pay-detail-title-button" onClick={() => onScreenChange("overview")} aria-label="Fermer cette page et revenir à Ma paie">
              <span className="step-label">Ma paie</span>
              <h2>{screen === "allowances" ? "Primes et jours fériés" : "Détail du calcul"}</h2>
              <small>{MONTHS[month]} {year}</small>
            </button>
            <button className="pay-detail-close" type="button" onClick={() => onScreenChange("overview")} aria-label="Fermer cette page">×</button>
          </header>
          <div className={`pay-dedicated-content${screen === "allowances" ? " request-archive-content allowances" : ""}${monthSlide ? ` pay-month-${monthSlide}` : ""}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {screen === "allowances" ? allowancesContent : estimateContent}
          </div>
        </div>
      )}
    </section>
  );
}
