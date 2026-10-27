import { type ComponentProps, type Dispatch, lazy, type SetStateAction, Suspense } from "react";
import { PdfDownloadPage } from "./appSections";
import { CalendarCleanupPanel, CalendarCleanupTrigger } from "./CalendarCleanup";
import { PlanningCommandCenter } from "./PlanningCommandCenter";
import { MonthCalendar } from "./PlanningView";
import { LeaveDurationControl } from "./LeaveDurationControl";
import { LeaveTypeTabs } from "./LeaveTypeTabs";
import { DURATION_LEAVE_TYPES, TYPE_COLORS, dateKey, localDate, type SchoolVacation, type SelectionType } from "./planningLogic";
import type { useAnnualPdfExport } from "./useAnnualPdfExport";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useLeaveBalances } from "./useLeaveBalances";
import type { useMonthPayEstimate } from "./useMonthPayEstimate";
import type { usePayProfileValues } from "./usePayProfileValues";
import type { usePlanningEditorActions } from "./usePlanningEditorActions";
import type { usePlanningEntryActions } from "./usePlanningEntryActions";
import type { usePlanningInteractionActions } from "./usePlanningInteractionActions";
import type { usePlanningRequestActions } from "./usePlanningRequestActions";
import type { usePlanningUiState } from "./usePlanningUiState";
import { leaveHoursFor, type useRequestTypeSelection } from "./useRequestTypeSelection";
import type { useWorkedDaysOverview } from "./useWorkedDaysOverview";
import type { useWorkExchangeActions } from "./useWorkExchangeActions";
import type { useWorkTimeActions } from "./useWorkTimeActions";
import type { useWorkTimeUiState } from "./useWorkTimeUiState";
import { WorkExchangePanel } from "./WorkExchangePanel";

/** Au-dessus du planning, les congés qu'on pose le plus, en libellés courts ;
 *  le type choisi dans le panneau s'il est autre s'y ajoute. */
const CALENDAR_LEAVE_TYPES = ["annual", "rtt", "fraction"] as const;
const CALENDAR_TYPE_LABELS: Partial<Record<SelectionType, string>> = {
  annual: "CA",
  fraction: "Fractionnement",
  childcare: "Garde d’enfant",
  exceptional: "Exceptionnel",
  cet: "CET",
};

const AnnualPdfActions = lazy(() =>
  import("./AnnualPdfActions").then(({ AnnualPdfActions: Component }) => ({ default: Component })),
);
const planningRequestPanelsModule = () => import("./PlanningRequestPanels");
const NoteSelectionPanel = lazy(() =>
  planningRequestPanelsModule().then(({ NoteSelectionPanel: Component }) => ({ default: Component })),
);
const RecoveryDatePickingPanel = lazy(() =>
  planningRequestPanelsModule().then(({ RecoveryDatePickingPanel: Component }) => ({ default: Component })),
);
// Les étapes 2 et 3 d'une demande : dans le morceau des écrans différés,
// préparé au repos, et montées seulement pendant une demande.
const RequestSelectionPanel = lazy(() =>
  import("./deferredScreens").then(({ RequestSelectionPanel: Component }) => ({ default: Component })),
);
const SchoolVacationMonthSummary = lazy(() =>
  import("./SchoolVacationUi").then(({ SchoolVacationMonthSummary: Component }) => ({ default: Component })),
);

type RequestSelectionProps = ComponentProps<typeof RequestSelectionPanel>;

type Props = {
  now: Date;
  group: number;
  view: Date;
  setView: Dispatch<SetStateAction<Date>>;
  /** Le calendrier s'affiche à l'accueil et pendant toute sélection de dates. */
  showCalendarWorkspace: boolean;
  workQuota: ReturnType<typeof usePayProfileValues>["workQuota"];
  workedDays: Pick<ReturnType<typeof useWorkedDaysOverview>, "monthWorkedDays" | "remainingWorkedDays">;
  /** Vacances scolaires du mois affiché, si leur affichage est demandé. */
  monthSchoolVacations: SchoolVacation[];
  shell: Pick<
    ReturnType<typeof useAppShellUiState>,
    | "homeSection" | "narrowScreen" | "pdfOpen" | "setPdfOpen" | "showSchoolVacationsOnPdf" | "setShowSchoolVacationsOnPdf"
    | "showSchoolVacations" | "setShowSchoolVacations" | "schoolZone" | "setSchoolZone" | "calendarSlide"
  >;
  planning: Pick<
    ReturnType<typeof usePlanningUiState>,
    | "recoveryRangeSelecting" | "recoveryRangeDates" | "rangeSelecting" | "separatePeople" | "wishMoment"
    | "rangeLeaveType" | "separateDates" | "savingRange" | "noteSelecting" | "noteColor" | "noteText" | "noteDates"
    | "savingDay" | "requestKind" | "sickRequest" | "activeType" | "setActiveType" | "leaveMoment" | "leaveHours" | "savingRequest"
  >;
  workTime: Pick<
    ReturnType<typeof useWorkTimeUiState>,
    "recoveryDraft" | "setRecoveryDraft" | "savingOvertime" | "recoveryDatePicking" | "setRecoveryDatePicking" | "setRecoveryDialogOpen"
  >;
  /** La demande en cours : dates choisies, soldes et contrôles de l'étape. */
  request: Pick<RequestSelectionProps, "selectedList" | "selectedCounts">
    & Pick<ReturnType<typeof useLeaveBalances>, "leaveRemainingByType" | "leaveRemainingByYear" | "leaveSelectionOverBalance">
    & Pick<ReturnType<typeof useMonthPayEstimate>, "recoveryBalance">
    & Pick<ReturnType<typeof useRequestTypeSelection>, "selectLeaveType" | "selectLeaveMoment" | "selectLeaveHours" | "selectRecoveryType">
    & Pick<ReturnType<typeof usePlanningRequestActions>, "validateAndOpenForm" | "saveRequestToPlanning">
    & {
      recoverySelectionInsufficient: boolean;
      recoverySelectionIncomplete: boolean;
      cancelRequest: () => void;
    };
  /** « Effacer plusieurs dates ou notes ». */
  cleanup: Pick<ReturnType<typeof usePlanningInteractionActions>, "startCalendarCleanup" | "cancelCalendarCleanup">
    & Pick<ReturnType<typeof usePlanningEntryActions>, "deleteMultiplePlanningDates">
    & { calendarDeleteMode: boolean; calendarDeleteDates: string[]; deletingMultipleDates: boolean };
  /** Les plannings PDF, ouverts depuis le calendrier. */
  pdf: ReturnType<typeof useAnnualPdfExport> & {
    pdfDialogOpen: boolean;
    setPdfDialogOpen: Dispatch<SetStateAction<boolean>>;
  };
  exchange: Pick<ReturnType<typeof useWorkExchangeActions>, "exchanges" | "openNew" | "openEdit">;
  renderDay: ComponentProps<typeof MonthCalendar>["renderDay"];
  actions: Pick<
    ReturnType<typeof usePlanningInteractionActions>,
    "chooseWishMoment" | "cancelRangeSelection" | "cancelNoteSelection" | "goToday" | "startMonthSwipe" | "endMonthSwipe"
  >
    & Pick<ReturnType<typeof useWorkTimeActions>, "cancelRecoveryRangeSelection" | "saveRecoveryRangeDates">
    & Pick<ReturnType<typeof usePlanningEditorActions>, "saveNoteAcrossDates" | "saveSeparateLeaveDates">
    & { openRequestChooser: (origin: "general" | "planning") => void };
};

/**
 * L'espace du planning : la barre de commandes, les plannings PDF, les
 * panneaux d'une demande ou d'une sélection, puis le calendrier du mois avec
 * ses boutons, les échanges et l'effacement groupé. Les états et les actions
 * restent dans App.tsx ; ce composant les relie aux commandes et au calendrier.
 */
export function PlanningWorkspace({
  now, group, view, setView, showCalendarWorkspace, workQuota, workedDays, monthSchoolVacations,
  shell, planning, workTime, request, cleanup, pdf, exchange, renderDay, actions,
}: Props) {
  const {
    homeSection, narrowScreen, pdfOpen, setPdfOpen, showSchoolVacationsOnPdf, setShowSchoolVacationsOnPdf,
    showSchoolVacations, setShowSchoolVacations, schoolZone, setSchoolZone, calendarSlide,
  } = shell;
  const {
    recoveryRangeSelecting, recoveryRangeDates, rangeSelecting, separatePeople, wishMoment,
    rangeLeaveType, separateDates, savingRange, noteSelecting, noteColor, noteText, noteDates,
    savingDay, requestKind, sickRequest, activeType, setActiveType, leaveMoment, leaveHours, savingRequest,
  } = planning;
  const { recoveryDraft, setRecoveryDraft, savingOvertime, recoveryDatePicking, setRecoveryDatePicking, setRecoveryDialogOpen } = workTime;
  const { monthWorkedDays, remainingWorkedDays } = workedDays;
  const {
    selectedList, selectedCounts, leaveRemainingByType, leaveRemainingByYear, leaveSelectionOverBalance,
    recoveryBalance, recoverySelectionInsufficient, recoverySelectionIncomplete,
    cancelRequest, selectLeaveType, selectLeaveMoment, selectLeaveHours, selectRecoveryType, validateAndOpenForm, saveRequestToPlanning,
  } = request;
  const {
    calendarDeleteMode, calendarDeleteDates, deletingMultipleDates,
    startCalendarCleanup, cancelCalendarCleanup, deleteMultiplePlanningDates,
  } = cleanup;
  const { pdfDialogOpen, setPdfDialogOpen, pdfExporting, exportAnnualPlanning } = pdf;
  const { exchanges: workExchanges, openNew: openWorkExchange, openEdit: editWorkExchange } = exchange;
  const {
    openRequestChooser, chooseWishMoment, cancelRangeSelection, cancelNoteSelection, goToday, startMonthSwipe, endMonthSwipe,
    cancelRecoveryRangeSelection, saveRecoveryRangeDates, saveNoteAcrossDates, saveSeparateLeaveDates,
  } = actions;
  return (
      <div className={`planning-workspace-shell${homeSection === "home" ? " framed" : ""}`}>
      {showCalendarWorkspace ? (
        <>
      <PlanningCommandCenter
        isHome={homeSection === "home"}
        view={view}
        setView={setView}
        workQuota={workQuota}
        workedDays={{ month: monthWorkedDays, remaining: remainingWorkedDays }}
        recoveryRangeSelecting={recoveryRangeSelecting}
        recoveryDraft={recoveryDraft}
        setRecoveryDraft={setRecoveryDraft}
        recoveryRangeDates={recoveryRangeDates}
        savingOvertime={savingOvertime}
        onCancelRecoveryRange={cancelRecoveryRangeSelection}
        onSaveRecoveryRange={() => void saveRecoveryRangeDates()}
        rangeSelecting={rangeSelecting}
        separatePeople={separatePeople}
        wishMoment={wishMoment}
        onWishMomentChange={chooseWishMoment}
        rangeLeaveType={rangeLeaveType}
        separateDates={separateDates}
        savingRange={savingRange}
        onCancelRange={cancelRangeSelection}
        onSaveRange={() => void saveSeparateLeaveDates()}
        calendarDeleteMode={calendarDeleteMode && narrowScreen}
        calendarDeleteDates={calendarDeleteDates}
        deletingMultipleDates={deletingMultipleDates}
        onCancelCleanup={cancelCalendarCleanup}
        onDeleteAbsences={() =>
          void deleteMultiplePlanningDates(calendarDeleteDates, "absences")
        }
        onDeleteNotes={() =>
          void deleteMultiplePlanningDates(calendarDeleteDates, "notes")
        }
        onToday={goToday}
        onExportPdf={homeSection === "home" ? () => setPdfDialogOpen(true) : undefined}
        exportingPdf={false}
        showSchoolVacations={showSchoolVacations}
        schoolZone={schoolZone}
        onShowSchoolVacationsChange={setShowSchoolVacations}
        onSchoolZoneChange={setSchoolZone}
      />

      {/* Les plannings PDF s'ouvrent depuis le calendrier de l'accueil. */}
      {pdfDialogOpen ? (
        <Suspense fallback={null}>
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPdfDialogOpen(false)}>
            <section className="modal-card planning-pdf-dialog" role="dialog" aria-modal="true" aria-label="Plannings PDF">
              <button className="modal-close" type="button" aria-label="Fermer" onClick={() => setPdfDialogOpen(false)}>×</button>
              <PdfDownloadPage
                narrowScreen={narrowScreen}
                year={view.getFullYear()}
                group={group}
                showSchoolVacations={showSchoolVacationsOnPdf}
                exporting={pdfExporting}
                onYearChange={(year) => setView(localDate(year, view.getMonth(), 1))}
                onShowSchoolVacationsChange={setShowSchoolVacationsOnPdf}
                onExport={(scope, includeSchoolVacations, pdfGroup) => void exportAnnualPlanning(scope, includeSchoolVacations, pdfGroup)}
              />
            </section>
          </div>
        </Suspense>
      ) : null}

      {/* Les trois exports annuels ne dépendent plus d'une vue annuelle
          retirée : la rubrique PDF les porte à elle seule. */}
      {homeSection === "pdf" && (
        <Suspense fallback={null}>
        <AnnualPdfActions
          narrowScreen={narrowScreen}
          pdfOpen={pdfOpen}
          onTogglePdfOpen={() => setPdfOpen((current) => !current)}
          showSchoolVacationsOnPdf={showSchoolVacationsOnPdf}
          onToggleSchoolVacations={() =>
            setShowSchoolVacationsOnPdf((current) => !current)
          }
          pdfExporting={pdfExporting}
          group={group}
          onExport={(scope, includeSchoolVacations) =>
            void exportAnnualPlanning(scope, includeSchoolVacations)
          }
        />
        </Suspense>
      )}

      {noteSelecting ? (
        <Suspense fallback={null}>
        <NoteSelectionPanel
          open={noteSelecting}
          noteColor={noteColor}
          noteText={noteText}
          noteDates={noteDates}
          savingDay={savingDay}
          onCancel={cancelNoteSelection}
          onSave={saveNoteAcrossDates}
        />
        </Suspense>
      ) : null}

      {requestKind ? (
        <Suspense fallback={null}>
      <RequestSelectionPanel
        requestKind={requestKind}
        sickRequest={sickRequest}
        activeType={activeType}
        setActiveType={setActiveType}
        selectedList={selectedList}
        selectedCounts={selectedCounts}
        group={group}
        workQuota={workQuota}
        recoveryBalanceRemaining={recoveryBalance.remaining}
        leaveRemainingByType={leaveRemainingByType}
        leaveRemainingByYear={leaveRemainingByYear}
        currentYear={now.getFullYear()}
        savingRequest={savingRequest}
        selectionBlocked={
          recoverySelectionInsufficient ||
          recoverySelectionIncomplete ||
          leaveSelectionOverBalance
        }
        onCancel={cancelRequest}
        onSelectLeaveType={selectLeaveType}
        leaveMoment={leaveMoment}
        onSelectLeaveMoment={selectLeaveMoment}
        leaveHours={leaveHoursFor(leaveHours, leaveMoment)}
        onChangeLeaveHours={selectLeaveHours}
        onSelectRecoveryType={selectRecoveryType}
        onValidateAndOpenForm={() => void validateAndOpenForm()}
        onSaveToPlanning={() => void saveRequestToPlanning()}
      />
        </Suspense>
      ) : null}

      {recoveryDatePicking ? (
        <Suspense fallback={null}>
        <RecoveryDatePickingPanel
          open={recoveryDatePicking}
          onCancel={() => {
            setRecoveryDatePicking(false);
            setRecoveryDialogOpen(true);
          }}
        />
        </Suspense>
      ) : null}

      <section className="planning-calendar-section" aria-label="Planning et congés">
      {/* Pendant une demande de congé, le congé des dates qu'on va toucher,
          juste au-dessus d'elles — CA, RTT, fractionnement, et le type choisi
          s'il est autre — puis, pour un CA, leur durée : un RTT, un CA et une
          demi-journée se posent dans la même demande sans remonter au
          panneau. */}
      {requestKind === "leave" && !sickRequest ? (
        <div className="planning-request-duration">
          <span className="leave-moment-label" aria-hidden="true">Dates touchées</span>
          <LeaveTypeTabs
            types={(CALENDAR_LEAVE_TYPES as readonly SelectionType[]).includes(activeType) ? CALENDAR_LEAVE_TYPES : [...CALENDAR_LEAVE_TYPES, activeType]}
            activeType={activeType}
            selectedCounts={selectedCounts}
            labels={CALENDAR_TYPE_LABELS}
            ariaLabel="Congé des dates touchées"
            onSelect={selectLeaveType}
          />
          {(DURATION_LEAVE_TYPES as readonly string[]).includes(activeType) ? (
            <LeaveDurationControl
              moment={leaveMoment}
              hours={leaveHoursFor(leaveHours, leaveMoment)}
              color={TYPE_COLORS[activeType]}
              ariaLabel="Durée des dates touchées"
              onSelectMoment={selectLeaveMoment}
              onChangeHours={selectLeaveHours}
            />
          ) : null}
        </div>
      ) : (
      <div className="planning-leave-panel">
        <button
          className="primary-action planning-leave-action"
          type="button"
          onClick={() => openRequestChooser("planning")}
        >
          Poser un congé
        </button>
        <button
          className="planning-exchange-action"
          type="button"
          onClick={() => openWorkExchange()}
        >
          Faire un échange
        </button>
      </div>
      )}

      {showSchoolVacations ? (
        <Suspense fallback={null}>
          <SchoolVacationMonthSummary zone={schoolZone} vacations={monthSchoolVacations} />
        </Suspense>
      ) : null}

      <section
        className={`month-card${calendarSlide ? ` calendar-${calendarSlide}` : ""}`}
        onTouchStart={startMonthSwipe}
        onTouchEnd={endMonthSwipe}
      >
        <MonthCalendar
          year={view.getFullYear()}
          month={view.getMonth()}
          renderDay={renderDay}
        />
      </section>
      {homeSection === "home" ? (
        <WorkExchangePanel exchanges={workExchanges} group={group} today={dateKey(now)} onEdit={editWorkExchange} />
      ) : null}
      {homeSection === "home" ? (
        <div className="planning-calendar-cleanup-row">
          {calendarDeleteMode && !narrowScreen ? (
            <CalendarCleanupPanel
              selectedCount={calendarDeleteDates.length}
              busy={deletingMultipleDates}
              onCancel={cancelCalendarCleanup}
              onDeleteAbsences={() => void deleteMultiplePlanningDates(calendarDeleteDates, "absences")}
              onDeleteNotes={() => void deleteMultiplePlanningDates(calendarDeleteDates, "notes")}
            />
          ) : !calendarDeleteMode ? (
            <CalendarCleanupTrigger
              className="calendar-bulk-delete-button calendar-bulk-delete-below"
              onStart={startCalendarCleanup}
            />
          ) : null}
        </div>
      ) : null}
      </section>
        </>
      ) : null}
      </div>
  );
}
