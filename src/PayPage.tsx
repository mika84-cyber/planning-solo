import { useEffect, useState, type ReactNode, type TouchEventHandler } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { ClockTimePicker } from "./ClockTimePicker";
import { PayDashboard, type PayDashboardVariable } from "./PayDashboard";
import { PAY_STATUS_OPTIONS, type PayStatus } from "./appModel";
import { WORK_QUOTA_OPTIONS, type WorkQuota, type WorkSchedule } from "./overtime";
import { MONTHS } from "./planningLogic";

export type PayScreen = "overview" | "allowances" | "payslip";

type PayPageProps = {
  screen: PayScreen;
  month: number;
  year: number;
  profileOpen: boolean;
  profileFocusRequested: boolean;
  settingsOpen: boolean;
  /** Absents tant que rien n’a été choisi : les calculs retiennent bien un
   *  temps plein contractuel par défaut, mais l’afficher ici ferait passer
   *  pour renseigné ce qui reste à décider. */
  workQuota?: WorkQuota;
  /** Absent tant que personne n’a saisi de plage : les champs restent vides
   *  plutôt que d’afficher une plage que l’on n’a pas choisie. */
  workSchedule?: WorkSchedule;
  status?: PayStatus;
  netEstimateComplete: boolean;
  gross: number;
  grossComplete: boolean;
  net: number | null;
  profileLabel: string;
  missingFields?: string[];
  onCompleteEstimate?: () => void;
  reliability: { tone: "exact" | "estimated" | "incomplete"; label: string; detail: string };
  variables: PayDashboardVariable[];
  monthSlide: string;
  allowancesContent: ReactNode;
  estimateContent: ReactNode;
  verificationContent: ReactNode;
  settingsContent: ReactNode;
  onScreenChange: (screen: PayScreen) => void;
  onToggleProfile: () => void;
  onProfileFocused: () => void;
  onToggleSettings: () => void;
  onWorkQuotaChange: (quota: WorkQuota) => void;
  onWorkScheduleChange: (schedule: WorkSchedule) => void;
  onStatusChange: (status: PayStatus) => void;
  onSaveProfile: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
};

export function PayPage({
  screen, month, year, profileOpen, profileFocusRequested, settingsOpen, workQuota, workSchedule, status,
  netEstimateComplete, gross, grossComplete, net, profileLabel,
  missingFields, onCompleteEstimate,
  reliability, variables, monthSlide, allowancesContent, estimateContent,
  verificationContent, settingsContent, onScreenChange, onToggleProfile, onProfileFocused,
  onToggleSettings, onWorkQuotaChange, onWorkScheduleChange, onStatusChange, onPreviousMonth,
  onSaveProfile, onNextMonth, onToday, onTouchStart, onTouchEnd,
}: PayPageProps) {
  const [focusMissing, setFocusMissing] = useState(false);
  useEffect(() => {
    if (!focusMissing || !settingsOpen) return;
    const panel = document.querySelector<HTMLElement>(".pay-elements-card");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    }
    setFocusMissing(false);
  }, [focusMissing, settingsOpen]);
  useEffect(() => {
    if (!profileFocusRequested || screen !== "overview" || !profileOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const profile = document.getElementById("pay-profile-settings");
      profile?.scrollIntoView({ behavior: "smooth", block: "center" });
      profile?.focus({ preventScroll: true });
      onProfileFocused();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onProfileFocused, profileFocusRequested, profileOpen, screen]);

  /* Le résumé ne nomme que ce qui a été choisi : annoncer « Temps plein ·
     Contractuel » sans que personne ne l'ait retenu donnerait le profil pour
     réglé. */
  const profileRecap = [
    WORK_QUOTA_OPTIONS.find((option) => option.value === workQuota)?.label,
    PAY_STATUS_OPTIONS.find((option) => option.value === status)?.label,
  ].filter(Boolean).join(" · ") || "Quotité et statut à renseigner";

  const profileContent = (
    <section id="pay-profile-settings" tabIndex={-1} className={`pay-profile-settings${profileOpen ? " open" : ""}`} aria-labelledby="pay-profile-settings-title">
      <button type="button" className="pay-profile-summary" onClick={onToggleProfile} aria-expanded={profileOpen}>
        <span className="pay-profile-symbol" aria-hidden="true">P</span>
        <span className="pay-profile-summary-copy">
          <span className="step-label">Profil utilisé pour les calculs</span>
          <strong id="pay-profile-settings-title">Mon profil de paie</strong>
          <small>{profileRecap}</small>
        </span>
        <span className={`pay-profile-open-copy${netEstimateComplete ? " complete" : " missing"}`}>
          {profileOpen ? "Replier" : netEstimateComplete ? "Profil complet" : "À compléter"}
        </span>
        <i aria-hidden="true">⌄</i>
      </button>
      {profileOpen ? (
        <div className="pay-profile-settings-grid">
          <label>
            <span>Quotité de travail</span>
            <ChoicePicker value={workQuota ?? ""} options={WORK_QUOTA_OPTIONS.map(({ value, label }) => ({ value, label }))} onChange={onWorkQuotaChange} ariaLabel="Choisir la quotité de travail" layout="list" className="pay-profile-picker" placeholder="À renseigner" />
          </label>
          <label>
            <span>Statut</span>
            <ChoicePicker value={status ?? ""} options={PAY_STATUS_OPTIONS} onChange={onStatusChange} ariaLabel="Choisir le statut" layout="list" className="pay-profile-picker" placeholder="À renseigner" />
            <small>Calculs adaptés à votre statut</small>
          </label>
          <fieldset className="pay-work-schedule">
            <legend>Sur quelle plage horaire travaillez-vous ?</legend>
            {(["start", "end"] as Array<keyof WorkSchedule>).map((key) => <ClockTimePicker key={key} className="pay-work-time-field" pickerClassName="pay-work-time-picker" label={key === "start" ? "Heure de début" : "Heure de fin"} value={workSchedule?.[key] ?? ""} allowEmpty onChange={(value) => onWorkScheduleChange({ start: workSchedule?.start ?? "", end: workSchedule?.end ?? "", [key]: value })} />)}
            <small>Calculs adaptés à vos horaires</small>
          </fieldset>
          <button type="button" className="primary-action pay-profile-save" onClick={onSaveProfile}>Enregistrer le profil</button>
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
            missingFields={missingFields} onCompleteEstimate={() => { setFocusMissing(true); onCompleteEstimate?.(); }}
            variables={variables} verificationContent={verificationContent}
            profileContent={profileContent} settingsContent={settingsContent} settingsOpen={settingsOpen}
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
