import { lazy, Suspense, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CalendarCleanupPanel } from "./CalendarCleanup";
import { ChoicePicker } from "./ChoicePicker";
import { dayCountLabel, type ViewMode } from "./appModel";
import {
  GROUP_OPTIONS,
  MONTHS,
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  leaveTypeLabel,
  localDate,
  multiDatePersonLabel,
  s,
  type LeaveType,
  type MultiDatePerson,
  type SchoolZone,
} from "./planningLogic";
import type { RecoveryDraft } from "./useWorkTimeUiState";
import { defaultRecoveryMinutes, minutesLabel, type WorkQuota } from "./overtime";

const SchoolVacationSettings = lazy(() =>
  import("./SchoolVacationUi").then(({ SchoolVacationSettings: Component }) => ({ default: Component })),
);

type WorkedDaySummary = {
  worked: number;
  scheduled: number;
  onLeave: number;
  exceptionallyClosed: number;
  exchangedGiven: number;
  exchangedReturned: number;
};

type WorkedDaysData = {
  month: WorkedDaySummary;
  thirds: Array<WorkedDaySummary & {
    label: string;
    range: string;
    current: boolean;
  }>;
};

type PlanningCommandCenterProps = {
  isHome: boolean;
  mode: ViewMode;
  view: Date;
  setView: (view: Date) => void;
  group: number;
  workQuota?: WorkQuota;
  onGroupChange: (group: number) => void;
  workedDays: WorkedDaysData;
  totals: { work: number; training: number; workedHoliday: number };
  recoveryRangeSelecting: boolean;
  recoveryDraft: RecoveryDraft;
  setRecoveryDraft: Dispatch<SetStateAction<RecoveryDraft>>;
  recoveryRangeDates: string[];
  savingOvertime: boolean;
  onCancelRecoveryRange: () => void;
  onSaveRecoveryRange: () => void;
  rangeSelecting: boolean;
  separatePeople: MultiDatePerson[];
  rangeLeaveType: LeaveType;
  separateDates: string[];
  savingRange: boolean;
  onCancelRange: () => void;
  onSaveRange: () => void;
  calendarDeleteMode: boolean;
  calendarDeleteDates: string[];
  deletingMultipleDates: boolean;
  onCancelCleanup: () => void;
  onDeleteAbsences: () => void;
  onDeleteNotes: () => void;
  onToday: () => void;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
  showSchoolVacations: boolean;
  schoolZone: SchoolZone;
  onShowSchoolVacationsChange: (visible: boolean) => void;
  onSchoolZoneChange: (zone: SchoolZone) => void;
};

function closureDetail(count: number) {
  return count
    ? `, ${dayCountLabel(count)} fermeture${s(count)} exceptionnelle${s(count)}`
    : "";
}

function exchangeDetail(given: number, returned: number) {
  const details = [
    given ? `${dayCountLabel(given)} cédé${given > 1 ? "s" : ""}` : "",
    returned ? `${dayCountLabel(returned)} rendu${returned > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return details.length ? `, échanges : ${details.join(" et ")}` : "";
}

export function PlanningCommandCenter({
  isHome,
  mode,
  view,
  setView,
  group,
  workQuota = "full",
  onGroupChange,
  workedDays,
  totals,
  recoveryRangeSelecting,
  recoveryDraft,
  setRecoveryDraft,
  recoveryRangeDates,
  savingOvertime,
  onCancelRecoveryRange,
  onSaveRecoveryRange,
  rangeSelecting,
  separatePeople,
  rangeLeaveType,
  separateDates,
  savingRange,
  onCancelRange,
  onSaveRange,
  calendarDeleteMode,
  calendarDeleteDates,
  deletingMultipleDates,
  onCancelCleanup,
  onDeleteAbsences,
  onDeleteNotes,
  onToday,
  onExportPdf,
  exportingPdf = false,
  showSchoolVacations,
  schoolZone,
  onShowSchoolVacationsChange,
  onSchoolZoneChange,
}: PlanningCommandCenterProps) {
  const [workedDaysOpen, setWorkedDaysOpen] = useState(false);
  const workedDaysRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!workedDaysOpen) return;
    const close = (event: MouseEvent) => {
      if (!workedDaysRef.current?.contains(event.target as Node))
        setWorkedDaysOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWorkedDaysOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [workedDaysOpen]);

  return (
    <section className="planning-command-section" aria-label="Commandes du planning">
      {isHome ? (
        <section className="home-planning-heading" aria-labelledby="home-planning-title">
          <div className="home-content-heading">
            <div>
              <span className="step-label">Calendrier</span>
              <h2 id="home-planning-title">Mon planning</h2>
            </div>
            {onExportPdf ? <button type="button" className="soft-detail-button planning-export-pdf" disabled={exportingPdf} onClick={onExportPdf}>{exportingPdf ? "Création…" : "Exporter en PDF"}</button> : null}
          </div>
        </section>
      ) : null}

      {mode !== "year" ? (
        <section className="controls" aria-label="Choix du planning">
          <div className="year-choice planning-year-choice" role="group" aria-label="Choix de l’année affichée">
            <span className="year-choice-label">Année affichée</span>
            <div className="year-stepper">
              <div className="year-select-display">
                <span className="year-calendar-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                  </svg>
                </span>
                <ChoicePicker
                  value={view.getFullYear()}
                  options={YEAR_OPTIONS}
                  onChange={(year) => setView(localDate(year, view.getMonth(), 1))}
                  ariaLabel="Sélectionner l’année"
                  className="year-choice-picker"
                />
              </div>
            </div>
          </div>
          <div className="year-choice planning-today-choice" role="group" aria-label="Accès rapide au mois actuel" style={{ textAlign: "center" }}>
            <span className="year-choice-label">Navigation</span>
            <button className="planning-today-button" type="button" onClick={onToday}>
              Aujourd’hui
            </button>
          </div>
          <div className="worked-days" ref={workedDaysRef}>
            <span className="year-choice-label">Jours travaillés</span>
            <div className="worked-days-stepper">
              <button
                type="button"
                className="worked-days-trigger"
                onClick={() => setWorkedDaysOpen((current) => !current)}
                aria-expanded={workedDaysOpen}
                aria-label="Détail des jours travaillés"
              >
                <span>{dayCountLabel(workedDays.month.worked)} ce mois-ci</span>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m5 7.5 5 5 5-5" />
                </svg>
              </button>
              {workedDaysOpen ? (
                <div className="worked-days-panel">
                  <article>
                    <span className="worked-days-scope">
                      {MONTHS[view.getMonth()]} {view.getFullYear()}
                    </span>
                    <strong>{dayCountLabel(workedDays.month.worked)} jour{s(workedDays.month.worked)}</strong>
                    <small>
                      {dayCountLabel(workedDays.month.scheduled)} au cycle
                      {workedDays.month.onLeave
                        ? `, ${dayCountLabel(workedDays.month.onLeave)} de congé`
                        : ", aucun congé"}
                      {closureDetail(workedDays.month.exceptionallyClosed)}
                      {exchangeDetail(workedDays.month.exchangedGiven, workedDays.month.exchangedReturned)}
                    </small>
                  </article>
                  {workedDays.thirds.map((third) => (
                    <article key={third.label} className={third.current ? "current" : ""}>
                      <span className="worked-days-scope">
                        {third.label}
                        {third.current ? <em>en cours</em> : null}
                      </span>
                      <strong>{dayCountLabel(third.worked)} jour{s(third.worked)}</strong>
                      <small>
                        {third.range} · {dayCountLabel(third.scheduled)} au cycle
                        {third.onLeave
                          ? `, ${dayCountLabel(third.onLeave)} de congé`
                          : ", aucun congé"}
                        {closureDetail(third.exceptionallyClosed)}
                        {exchangeDetail(third.exchangedGiven, third.exchangedReturned)}
                      </small>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {mode === "year" ? (
        <section className="summary" aria-label="Récapitulatif">
          <article><strong>{totals.work}</strong><span>jours travaillés</span></article>
          <article><strong>{totals.training}</strong><span>jours de formation</span></article>
          <article><strong>{totals.workedHoliday}</strong><span>jours fériés travaillés</span></article>
        </section>
      ) : null}

      {recoveryRangeSelecting ? (
        <section className="range-selection-panel recovery" id="recovery-range-selection-panel">
          <div>
            <span className="step-label">
              Choix des dates · {({
                day: "Récupération en journée",
                half: "Récupération en demi-journée",
                hours: "Récupération en heures",
                holiday: "Récupération de jour férié",
                training: "Récupération sur une formation",
              } as const)[recoveryDraft.kind]}
            </span>
            <h2>{recoveryRangeDates.length} {recoveryRangeDates.length > 1 ? "dates sélectionnées" : "date sélectionnée"}</h2>
            <p>Changez de mois si nécessaire et touchez chaque date pour l’ajouter ou la retirer.</p>
            <fieldset className="overtime-choice-field recovery-range-duration recovery-duration-field">
              <legend>Heures à poser pour chaque date</legend>
              <div className="recovery-duration-choice">
                {recoveryDraft.kind === "training" ? (
                  ([
                    ...(workQuota === "half" ? [] : [["morning", 360, "Journée · 6 h · 10 h–16 h"]] as const),
                    ["morning", 180, "Matin · 3 h · 10 h–13 h"],
                    ["afternoon", 180, "Après-midi · 3 h · 13 h–16 h"],
                  ] as const).map(([value, minutes, label]) => (
                    <button key={`${value}-${minutes}`} type="button" className={(recoveryDraft.trainingMoment || "morning") === value && recoveryDraft.trainingMinutes === minutes ? "active" : ""} onClick={() => setRecoveryDraft((current) => ({ ...current, trainingMoment: value, trainingMinutes: minutes }))}>{label}</button>
                  ))
                ) : ((recoveryDraft.kind === "hours"
                  ? [[480, "8 h"], [360, "6 h"], [240, "4 h"], [225, "3 h 45"], [120, "2 h"]] as const
                  : [[defaultRecoveryMinutes(recoveryDraft.kind, workQuota), minutesLabel(defaultRecoveryMinutes(recoveryDraft.kind, workQuota))], ...(recoveryDraft.kind === "holiday" ? [] : [[null, "Durée libre"]] as const)]
                ) as ReadonlyArray<readonly [number | null, string]>).map(([value, label]) => (
                  <button
                    key={value ?? "custom"}
                    type="button"
                    className={recoveryDraft.durationMinutes === value ? "active" : ""}
                    onClick={() => setRecoveryDraft((current) => ({ ...current, durationMinutes: recoveryDraft.kind === "holiday" ? defaultRecoveryMinutes("holiday", workQuota) : value }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {recoveryDraft.kind !== "training" && recoveryDraft.durationMinutes === null ? (
              <div className="overtime-duration-grid recovery-custom-duration">
                <label>
                  <span>Heures</span>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    inputMode="decimal"
                    value={recoveryDraft.hours}
                    onChange={(event) => setRecoveryDraft((current) => ({ ...current, hours: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Minutes</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    inputMode="numeric"
                    value={recoveryDraft.minutes}
                    onChange={(event) => setRecoveryDraft((current) => ({ ...current, minutes: event.target.value }))}
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div className="range-selection-actions">
            <button className="secondary-button" type="button" onClick={onCancelRecoveryRange}>Annuler</button>
            <button
              className="save-button"
              type="button"
              onClick={onSaveRecoveryRange}
              disabled={!recoveryRangeDates.length || savingOvertime}
            >
              {savingOvertime ? "Synchronisation…" : "Enregistrer toutes les dates"}
            </button>
          </div>
        </section>
      ) : null}

      {rangeSelecting ? (
        <section className="range-selection-panel leave" id="range-selection-panel">
          <div>
            <span className="step-label">
              Choix des dates · {separatePeople.map(multiDatePersonLabel).join(" et ")}
              {separatePeople.includes("leave") && ` · ${leaveTypeLabel(rangeLeaveType)}`}
            </span>
            <h2>{separateDates.length} {separateDates.length > 1 ? "dates sélectionnées" : "date sélectionnée"}</h2>
            <p>Changez de mois si nécessaire et touchez chaque date pour l’ajouter ou la retirer.</p>
          </div>
          <div className="range-selection-actions">
            <button className="secondary-button" type="button" onClick={onCancelRange}>Annuler</button>
            <button
              className="save-button"
              type="button"
              onClick={onSaveRange}
              disabled={!separateDates.length || savingRange}
            >
              {savingRange ? "Synchronisation…" : "Enregistrer toutes les dates"}
            </button>
          </div>
        </section>
      ) : null}

      {calendarDeleteMode ? (
        <CalendarCleanupPanel
          selectedCount={calendarDeleteDates.length}
          busy={deletingMultipleDates}
          onCancel={onCancelCleanup}
          onDeleteAbsences={onDeleteAbsences}
          onDeleteNotes={onDeleteNotes}
        />
      ) : null}

      <section className={`calendar-toolbar ${mode === "month" ? "month-toolbar" : "year-toolbar"}${mode === "year" ? " annual-toolbar" : ""}`}>
        <div className="period-navigation">
          {mode === "month" ? (
            <ChoicePicker
              value={view.getMonth()}
              options={MONTH_OPTIONS}
              onChange={(month) => setView(localDate(view.getFullYear(), month, 1))}
              ariaLabel="Sélectionner le mois"
              className="toolbar-month-picker"
            />
          ) : null}
          <ChoicePicker
            value={view.getFullYear()}
            options={YEAR_OPTIONS}
            onChange={(year) => setView(localDate(year, view.getMonth(), 1))}
            ariaLabel="Sélectionner l’année"
            className="toolbar-year-picker"
          />
        </div>
        {mode === "year" ? (
          <ChoicePicker
            value={group}
            options={GROUP_OPTIONS}
            onChange={onGroupChange}
            ariaLabel="Sélectionner le groupe du planning annuel"
            layout="list"
            className="toolbar-group-picker"
          />
        ) : null}
        {mode === "year" ? (
          <button className="today-button" type="button" onClick={onToday}>Aujourd’hui</button>
        ) : null}
      </section>
      {mode === "month" ? (
        <Suspense fallback={null}>
          <SchoolVacationSettings
            visible={showSchoolVacations}
            zone={schoolZone}
            onVisibleChange={onShowSchoolVacationsChange}
            onZoneChange={onSchoolZoneChange}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
