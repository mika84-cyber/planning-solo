import type { WishMoment } from "./appModel";
import { lazy, Suspense, type Dispatch, type SetStateAction } from "react";
import { CalendarCleanupPanel } from "./CalendarCleanup";

const SchoolVacationSettings = lazy(() =>
  import("./SchoolVacationUi").then(({ SchoolVacationSettings: Component }) => ({ default: Component })),
);
import { dayCountLabel } from "./appModel";
import {
  type SchoolZone,
  leaveTypeLabel,
  multiDatePersonLabel,
  s,
  type LeaveType,
  type MultiDatePerson,
} from "./planningLogic";
import type { RecoveryDraft } from "./useWorkTimeUiState";
import { defaultRecoveryMinutes, minutesLabel, type WorkQuota } from "./overtime";


type WorkedDaySummary = {
  worked: number;
  scheduled: number;
  onLeave: number;
  exceptionallyClosed: number;
  exchangedGiven: number;
  exchangedReturned: number;
};

/** Le mois affiché, ce qu'il reste d'ici au 31 décembre, et l'année de ce
 *  reste (celle d'aujourd'hui, quel que soit le mois affiché). */
type WorkedDaysData = {
  month: WorkedDaySummary;
  remaining: WorkedDaySummary;
  /** L'année affichée dans le calendrier, et sa place par rapport à
   *  aujourd'hui : le reste de l'année en cours, une année entière sinon. */
  year: number;
  tense?: "now" | "future" | "past";
};

type PlanningCommandCenterProps = {
  isHome: boolean;
  workQuota?: WorkQuota;
  workedDays: WorkedDaysData;
  showSchoolVacations: boolean;
  schoolZone: SchoolZone;
  onShowSchoolVacationsChange: (visible: boolean) => void;
  onSchoolZoneChange: (zone: SchoolZone) => void;
  recoveryRangeSelecting: boolean;
  recoveryDraft: RecoveryDraft;
  setRecoveryDraft: Dispatch<SetStateAction<RecoveryDraft>>;
  recoveryRangeDates: string[];
  savingOvertime: boolean;
  onCancelRecoveryRange: () => void;
  onSaveRecoveryRange: () => void;
  rangeSelecting: boolean;
  separatePeople: MultiDatePerson[];
  /** Moment des souhaits touchés ensuite : journée, matin ou après-midi. */
  wishMoment?: WishMoment | "";
  onWishMomentChange?: (moment: WishMoment | "") => void;
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
  onExportPdf?: () => void;
  exportingPdf?: boolean;
};

export function PlanningCommandCenter({
  isHome,
  workQuota = "full",
  workedDays,
  showSchoolVacations,
  schoolZone,
  onShowSchoolVacationsChange,
  onSchoolZoneChange,
  recoveryRangeSelecting,
  recoveryDraft,
  setRecoveryDraft,
  recoveryRangeDates,
  savingOvertime,
  onCancelRecoveryRange,
  onSaveRecoveryRange,
  rangeSelecting,
  separatePeople,
  wishMoment = "",
  onWishMomentChange = () => {},
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
  onExportPdf,
  exportingPdf = false,
}: PlanningCommandCenterProps) {
  // Sélection de plusieurs congés souhaités, lancée depuis « Poser un congé ».
  const wishOnly = separatePeople.length === 1 && separatePeople[0] === "wish";

  const reglagesDuPlanning = (
    <>
          {/* Le mois, l'année et le retour à aujourd'hui se changent en tête
              du calendrier (MonthNavigation) : la barre de période qui les
              doublait ici a disparu le 9 novembre 2026. */}
          <section className="controls" aria-label="Repères du mois">
            {/* Trois chiffres à même la carte : les jours travaillés du mois
                affiché, ses jours d'absence (toutes les absences posées :
                congés de tous types, Divers, grève, maladie, récupérations,
                demi-journées comprises ; c'est `onLeave`, tiré de
                personalPresenceForDate), puis les jours de travail restants
                dans l'année affichée (depuis le 11 novembre 2026 : l'année
                entière pour une autre que l'année en cours, « travaillés »
                pour une année passée). Jusqu'au 9 novembre 2026, ce dernier
                compte vivait dans un volet déplié sous une pilule. */}
            <ul className="worked-days">
              <li className="worked-days-month">
                <b>{dayCountLabel(workedDays.month.worked)}</b>
                <small>jour{s(workedDays.month.worked)} travaillé{s(workedDays.month.worked)} ce mois-ci</small>
              </li>
              <li className="worked-days-leave">
                <b>{dayCountLabel(workedDays.month.onLeave)}</b>
                <small>jour{s(workedDays.month.onLeave)} d’absence ce mois-ci</small>
              </li>
              <li className="worked-days-year">
                <b>{dayCountLabel(workedDays.remaining.worked)}</b>
                <small>{workedDays.tense === "past"
                  ? `jour${s(workedDays.remaining.worked)} travaillé${s(workedDays.remaining.worked)} en ${workedDays.year}`
                  : `jour${s(workedDays.remaining.worked)} de travail${workedDays.tense === "future" ? "" : ` restant${s(workedDays.remaining.worked)}`} en ${workedDays.year}`}</small>
              </li>
            </ul>
          </section>
        {/* Réglage d'affichage du planning : il vit ici faute d'une rubrique
            de réglages où le loger. */}
        <Suspense fallback={null}>
          <SchoolVacationSettings
            visible={showSchoolVacations}
            zone={schoolZone}
            onVisibleChange={onShowSchoolVacationsChange}
            onZoneChange={onSchoolZoneChange}
          />
        </Suspense>
    </>
  );
  return (
    <section className="planning-command-section" aria-label="Commandes du planning">
      {isHome ? (
        <section className="home-planning-heading" aria-labelledby="home-planning-title">
          <div className="home-content-heading">
            <div>
              <span className="step-label">Calendrier</span>
              <h2 id="home-planning-title">Mon planning</h2>
            </div>
            {/* Une flèche (dessinée en CSS) dit que le bouton ouvre un choix. */}
            {onExportPdf ? <button type="button" className="soft-detail-button planning-export-pdf" aria-haspopup="dialog" disabled={exportingPdf} onClick={onExportPdf}>{exportingPdf ? "Création…" : "Choisir un planning"}</button> : null}
          </div>
        </section>
      ) : null}

      {/* Les trois chiffres du mois et les vacances scolaires sont posés à
          même la page, sans volet à déplier. */}
      <div className="planning-settings-body">{reglagesDuPlanning}</div>

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
        <section className={`range-selection-panel leave${wishOnly ? " wish-selection" : ""}`} id="range-selection-panel">
          <div>
            <span className="step-label">
              {wishOnly ? "Congés souhaités · plusieurs dates" : <>
                Choix des dates · {separatePeople.map(multiDatePersonLabel).join(" et ")}
                {separatePeople.includes("leave") && ` · ${leaveTypeLabel(rangeLeaveType)}`}
              </>}
            </span>
            <h2>
              {wishOnly
                ? `${separateDates.length} ${separateDates.length > 1 ? "souhaits sélectionnés" : "souhait sélectionné"}`
                : `${separateDates.length} ${separateDates.length > 1 ? "dates sélectionnées" : "date sélectionnée"}`}
            </h2>
            <p>
              {wishOnly
                ? "Touchez chaque date souhaitée, en changeant de mois si besoin. Les souhaits ne comptent pas dans vos soldes : vous pourrez les transformer en congés plus tard."
                : "Changez de mois si nécessaire et touchez chaque date pour l’ajouter ou la retirer."}
            </p>
            {wishOnly ? (
              <div className="wish-moment-choice" role="group" aria-label="Durée des souhaits">
                {([["", "Journée"], ["morning", "Matin"], ["afternoon", "Après-midi"]] as const).map(([value, label]) => (
                  <button
                    key={value || "day"}
                    type="button"
                    className={wishMoment === value ? "active" : ""}
                    aria-pressed={wishMoment === value}
                    onClick={() => onWishMomentChange(value)}
                  >
                    {label}
                  </button>
                ))}
                <small>S’applique aux prochaines dates touchées, et à la date déjà choisie tant qu’elle est seule ; touchez une date déjà choisie pour lui donner ce moment.</small>
              </div>
            ) : null}
          </div>
          <div className="range-selection-actions">
            <button className="secondary-button" type="button" onClick={onCancelRange}>Annuler</button>
            <button
              className="save-button"
              type="button"
              onClick={onSaveRange}
              disabled={!separateDates.length || savingRange}
            >
              {savingRange ? "Synchronisation…" : wishOnly ? "Enregistrer les souhaits" : "Enregistrer toutes les dates"}
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

    </section>
  );
}
