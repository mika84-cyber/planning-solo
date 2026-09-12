import { HomeAdminMessage } from './HomeAdminMessage';
import { clearColleagueGroupsCache } from './colleagueSharingApi';
import {
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import {
  getUser,
  handleAuthCallback,
} from "@netlify/identity";
import { AuthScreen } from "./AuthScreen";
import { grandPalaisExceptionalClosure } from "./grandPalaisClosures";
import { getSharedGrandPalaisProgram } from "./grandPalaisProgramApi";
import { getUsefulContacts } from "./contactsApi";
import { getColleagueGroups } from "./colleagueSharingApi";
import { resolvePublicDemoAccess } from "./demoAccess";
import { parseDemoCompletedRequestJson } from "./demoCompletedRequest";
import { ConnectionStatus } from "./ConnectionStatus";
import { useAuthUiState } from "./useAuthUiState";
import { usePayUiState } from "./usePayUiState";
import { effectivePayProfile, usePayActions } from "./usePayActions";
import type { PayDashboardVariable } from "./PayDashboard";
import type { PayCalculationBreakdown } from "./PayEstimateDetails";
import type { PayslipCheckSectionProps } from "./PayslipCheckSection";

const homeDashboardModule = import("./HomeDashboard");
const AdminToolsPanel = lazy(() => import('./AdminToolsPanel').then(module => ({ default: module.AdminToolsPanel })));
const HomeDashboard = lazy(() =>
  homeDashboardModule.then(({ HomeDashboard: Component }) => ({ default: Component })),
);
const SchoolVacationMonthSummary = lazy(() =>
  import("./SchoolVacationUi").then(({ SchoolVacationMonthSummary: Component }) => ({ default: Component })),
);
import { useWorkTimeUiState } from "./useWorkTimeUiState";
import { useWorkTimeActions } from "./useWorkTimeActions";
import { useAuthenticationActions } from "./useAuthenticationActions";
import { useAccountDataActions } from "./useAccountDataActions";
import { usePlanningUiState } from "./usePlanningUiState";
import { useCalendarDataState } from "./useCalendarDataState";
import { usePlanningEntryActions } from "./usePlanningEntryActions";
import { usePlanningEditorActions } from "./usePlanningEditorActions";
import { usePlanningInteractionActions } from "./usePlanningInteractionActions";
import { usePlanningRequestActions } from "./usePlanningRequestActions";
import { useWorkExchangeActions } from "./useWorkExchangeActions";
import { useWorkAccidentActions } from "./useWorkAccidentActions";
import { useAppShellUiState } from "./useAppShellUiState";
import { useFeedbackMessaging } from "./useFeedbackMessaging";
import { AppDialogLayer } from "./AppDialogLayer";
import { DayDetailDialog } from "./DayDetailDialog";
import { BalanceDetailDialog } from "./BalanceDetailDialog";
import { RequestSelectionPanel } from "./RequestSelectionPanel";
import {
  GroupChooserDialog,
  NoteSelectionPanel,
  RecoveryDatePickingPanel,
  RequestChooserDialog,
} from "./PlanningRequestPanels";
import {
  AppHeader,
  AdaptiveNavigation,
  MainMenu,
  MAIN_SECTION_ORDER,
  type MainSection,
} from "./AppNavigation";
import { PlanningCommandCenter } from "./PlanningCommandCenter";
import { CalendarCleanupPanel, CalendarCleanupTrigger } from "./CalendarCleanup";
import { PlanningDayCell } from "./PlanningDayCell";
import { MonthCalendar } from "./PlanningView";
import { WorkExchangeDialog } from "./WorkExchangeDialog";
import { WorkExchangePanel } from "./WorkExchangePanel";
import { UsefulResourcesHub } from "./UsefulResourcesHub";
import { workExchangeForDate } from "./workExchange";
import { requestRecoveryMinutes, zeroLeaveBalanceType } from "./RequestValidationSummary";
import { visibleAbsencePeriod } from "./absenceReplacement";
import {
  CetSection,
  ColleaguePlanningPage,
  ColleagueRequestNotice,
  DocumentAnnouncementNotice,
  FeedbackMessenger,
  FeedbackResolutionAlert,
  GrandPalaisProgramSection,
  LeaveBalancesSection,
  LeaveManagementPage,
  PayAllowancesSection,
  PayEstimateDetails,
  PayPage,
  PayslipCheckSection,
  PdfDownloadPage,
  UsefulContactsSection,
  UsefulFormsSection,
} from "./appSections";
import {
  CalendarApiError,
  calendarErrorMessage,
  getCalendar,
  notifyGuestSession,
  postCalendar,
  postCalendarBatch,
} from "./calendarApi";
import { parseCalendarSnapshot } from "./calendarPayload";
import { splitNoteItemsIntoColumns } from "./noteColumns";
import { matchesSearch } from "./searchMatching";
import { sickLeaveSummaryForYear } from "./sickLeaveSummary";
import { AppleInstallNotice } from "./AppleInstallNotice";
import { monthGross, strikeDeduction } from "./payMonth";
import {
  emptyEntry,
  euros,
  groupNoteItemsByDate,
  noteDateLabel,
  notePeriodFor,
  personalPresenceForDate,
  attendanceDayMinutes,
  rangeKeys,
  roundCurrency,
  workedDayCount,
  workedDayCountBetween,
  type BalanceType,
  type FormProfile,
  type LeavePeriod,
  type ManualYearAdjustments,
  type NoteListItem,
  type PayProfile,
  type PayStatus,
  type RequestKind,
  type ViewMode,
} from "./appModel";
import { useAnnualPdfExport } from "./useAnnualPdfExport";
import {
  canEnableInstallation,
  setInstallMetadataEnabled,
  useInstallPrompt,
} from "./useInstallPrompt";
import { useConnectionStatus } from "./useConnectionStatus";
import { useModalAccessibility } from "./useModalAccessibility";
import { useRequestArchive } from "./useRequestArchive";
import {
  defaultNetRatiosForPeriod,
  inspectNetRatioCalibration,
  payCalibrationRegime,
  readingsForCalibrationRegime,
} from "./payslip";
import {
  isUnplannedPayslipCarence,
  summarizePayslipReview,
} from "./payslipReview";
import { PayslipSuccessCelebration } from "./PayslipSuccessCelebration";
import { strikePayEstimate } from "./strike";
import {
  payEstimateReadiness,
  type PayEstimateField,
} from "./payEstimate";
import {
  calculateMecenatVacation,
  mecenatForPayMonth,
} from "./mecenat";
import {
  allocateRecoveryUses,
  calculatePaidOvertime,
  DEFAULT_WORK_SCHEDULE,
  defaultRecoveryMinutes,
  dailyMinutesForQuota,
  holidayRecoveryEntries,
  minutesLabel,
  monthlyRecoveryBalance,
  recoveryRequestMinutes,
  trainingRecoveryMinutes,
  workScheduleHalfTimes,
  type RecoveryUse,
  type RecoveryRequestType,
  type WorkQuota,
  type WorkSchedule,
} from "./overtime";
import { useToast } from "./useToast";
import { type CetAccount } from "./cet";
import {
  COUNTED_ONLY_TYPES,
  DAY_LABELS,
  LEAVE_ALLOWANCES,
  MONTHS,
  RESIDENCE_ALLOWANCE_RATE,
  SUNDAY_ALLOWANCE,
  sundayTierFor,
  holidayAllowance,
  holidayPayslip,
  sundayAllowance,
  sundayPayslip,
  wasPompidouHolidayWorked,
  yearThirdFor,
  yearThirdRange,
  YEAR_THIRDS,
  TYPE_LABELS,
  applyManualSundayLeave,
  addDays,
  coWorkingGroupsForDate,
  dateKey,
  fromKey,
  getDayInfo,
  halfMomentFromStart,
  leaveTypeLabel,
  s,
  localDate,
  monthDays,
  nextAttendanceDay,
  periodLabel,
  sameDate,
  schoolVacationsForZone,
  selectionRemovesAttendance,
  type CountedOnlyType,
  type HolidayPay,
  type SelectionType,
  type SchoolVacation,
} from "./planningLogic";

function keyedNoteLines(value: string) {
  const occurrences = new Map<string, number>();
  return value
    .split("\n")
    .map((line) => line.replace(/^[–—\-•>]\s*/, "").trim())
    .filter(Boolean)
    .map((label) => {
      const occurrence = (occurrences.get(label) ?? 0) + 1;
      occurrences.set(label, occurrence);
      return { key: `${label}-${occurrence}`, label };
    });
}

// Conservé prêt à être réactivé lorsque le parcours d’accompagnement sera finalisé.
const HOME_SETUP_GUIDANCE_ENABLED = false;

function DeferredSection({ label }: { label: string }) {
  return <div className="deferred-section-loading" role="status">Chargement de {label}…</div>;
}

const HANDOFF_KEY = "planning:form-handoff-v1";

const EMPTY_MANUAL_ADJUSTMENTS: ManualYearAdjustments = {
  annualUsed: 0,
  rttUsed: 0,
  fractionUsed: 0,
  sundayLeaveJanJun: 0,
  sundayLeaveJulSep: 0,
  sundayLeaveOctNov: 0,
  sundayLeaveDec: 0,
};

export default function Home() {
  useModalAccessibility();
  const connectionStatus = useConnectionStatus();
  const publicDemoAccess = resolvePublicDemoAccess(
    import.meta.env.VITE_PUBLIC_DEMO_UNTIL,
  );
  // Le jeu de données sans compte est réservé aux tests E2E locaux. Aucun
  // paramètre d'URL public ne peut désormais activer ce mode. L'accès depuis
  // un téléphone reste possible en développement sur le Wi-Fi privé.
  const localTestHost =
    ["127.0.0.1", "localhost"].includes(location.hostname) ||
    /^192\.168\./.test(location.hostname) ||
    /^10\./.test(location.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname);
  const demoMode =
    publicDemoAccess.active ||
    (import.meta.env.DEV &&
      localTestHost &&
      (new URLSearchParams(location.search).get("local-test") === "1" ||
        (import.meta.env.VITE_E2E_DEMO === "true" &&
          localStorage.getItem("planning:e2e-demo-enabled") === "1")));
  const feedbackPreviewRole = import.meta.env.DEV && localTestHost
    ? new URLSearchParams(location.search).get("preview-feedback-role")
    : null;
  const localDemoAdmin = feedbackPreviewRole !== "user";
  const previewPayEffect =
    import.meta.env.DEV && localTestHost
      ? new URLSearchParams(location.search).get("preview-pay-effect")
      : null;
  const [now, setNow] = useState(() => localDate(2026, 6, 31));
  const [view, setView] = useState(() => localDate(2026, 6, 1));
  const [group, setGroup] = useState(2);
  const [mode, setMode] = useState<ViewMode>("month");
  const {
    authStatus, setAuthStatus, userEmail, setUserEmail,
    isProgramAdmin: actualProgramAdmin, setIsProgramAdmin, loginEmail, setLoginEmail,
    loginPassword, setLoginPassword, passwordConfirmation, setPasswordConfirmation,
    inviteToken, setInviteToken, authBusy, setAuthBusy,
    authError, setAuthError, authNotice, setAuthNotice,
  } = useAuthUiState();
  const [guestPreview, setGuestPreview] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [adminRevision, setAdminRevision] = useState(0);
  const isProgramAdmin = actualProgramAdmin && !guestPreview;
  const installationEnabled = canEnableInstallation(
    authStatus,
    demoMode,
    location.hostname,
  );
  const { installPrompt, installApp } = useInstallPrompt(installationEnabled);
  const {
    entries, setEntries, periods, setPeriods, formProfile, setFormProfile,
    payProfiles, setPayProfiles, overtimeEntries, setOvertimeEntries,
    recoveryUses, setRecoveryUses, mecenatEntries, setMecenatEntries,
    partnerEntries, setPartnerEntries, partnerPeriods, setPartnerPeriods,
    partnerSharingStatus, setPartnerSharingStatus,
  } = useCalendarDataState();
  const workTimeUi = useWorkTimeUiState();
  const {
    setOvertimeDialogOpen, setSolidarityDialogOpen,
    setRecoveryDialogOpen,
    recoveryDatePicking, setRecoveryDatePicking, trainingRecoveryMode,
    overtimeHistoryOpen, setOvertimeHistoryOpen, setMecenatDialogOpen,
    mecenatHistoryOpen, setMecenatHistoryOpen, setSavingMecenat,
    savingOvertime, setSavingOvertime, overtimeDraft,
    solidarityDraft, setSolidarityDraft, recoveryDraft, setRecoveryDraft,
    mecenatDraft, setMecenatDraft, overtimeSaveInFlightRef, mecenatSaveInFlightRef,
    lastOvertimeSubmissionRef, lastRecoverySubmissionRef, lastMecenatSubmissionRef,
  } = workTimeUi;
  const planningUi = usePlanningUiState();
  const {
    dayDate, setDayDate, noteText, setNoteText, noteColor,
    noteSelecting, noteDates,
    dayPersonalLeave,
    savingDay, setSavingDay,
    rangeLeaveType,
    rangeSelecting, separateDates,
    setRecoveryRangeOpen, recoveryRangeSelecting, setRecoveryRangeSelecting,
    recoveryRangePrefillDate, setRecoveryRangePrefillDate, recoveryRangeDates, setRecoveryRangeDates,
    separatePeople,
    savingRange, requestChooser, setRequestChooser, requestChooserDate, setRequestChooserDate, requestSeedDate,
    requestKind, setRequestKind, sickRequest, setSickRequest, savingRequest,
    activeType, setActiveType, selections, setSelections, setTimeDate, setTimeStart, setTimeEnd,
    setWarningDate,
  } = planningUi;
  const showLeaves = true;
  const showNotes = true;
  const toastUi = useToast();
  const {
    notify,
    confirm,
    offerUndo,
  } = toastUi;
  const {
    archiveOpen,
    setArchiveOpen,
    archivedRequests,
    openArchivedRequest,
    deleteArchivedRequest,
  } = useRequestArchive(authStatus, isProgramAdmin, userEmail, notify);
  const [balanceDetailType, setBalanceDetailType] = useState<
    BalanceType | CountedOnlyType | null
  >(null);
  const [calendarDeleteMode, setCalendarDeleteMode] = useState(false);
  const [calendarDeleteDates, setCalendarDeleteDates] = useState<string[]>([]);
  const [deletingMultipleDates, setDeletingMultipleDates] = useState(false);
  const [holidayChoiceEditing, setHolidayChoiceEditing] = useState<string | null>(null);
  const [absenceYear, setAbsenceYear] = useState(() => now.getFullYear());
  const [manualAdjustmentsOpen, setManualAdjustmentsOpen] = useState(false);
  const [savingManualAdjustments, setSavingManualAdjustments] = useState(false);
  const [savingCet, setSavingCet] = useState(false);
  const [manualAdjustmentDraft, setManualAdjustmentDraft] = useState<
    Record<keyof ManualYearAdjustments, string>
  >(() =>
    Object.fromEntries(
      Object.keys(EMPTY_MANUAL_ADJUSTMENTS).map((key) => [key, "0"]),
    ) as Record<keyof ManualYearAdjustments, string>,
  );
  const {
    payView, setPayView, payScreen, setPayScreen, payProfileOpen, setPayProfileOpen,
    payProfileFocusRequested, setPayProfileFocusRequested,
    payPeriodOpen, setPayPeriodOpen, payMonthSlide, setPayMonthSlide,
    payMonthSlideTimer, payslipCheck, setPayslipCheck, payslipError, setPayslipError,
    payslipImportBusy, setPayslipImportBusy, payslipImportError, setPayslipImportError,
    payslipImportResult, setPayslipImportResult, payslipImportMode, setPayslipImportMode,
    payslipNeedsPeriod, setPayslipNeedsPeriod, payslipFallbackMonth, setPayslipFallbackMonth,
    payslipFallbackYear, setPayslipFallbackYear, payslipRateSamples, setPayslipRateSamples,
    payslipHelpOpen, setPayslipHelpOpen, payslipResultDetailsOpen, setPayslipResultDetailsOpen,
    paySettingsOpen, setPaySettingsOpen, payAdvancedOpen, setPayAdvancedOpen,
    payDrafts, setPayDrafts, savingPay, setSavingPay,
  } = usePayUiState();
  const appShellUi = useAppShellUiState();
  const {
    quickNoteMode,
    homeSection, setHomeSection, prefetchedContacts, setPrefetchedContacts,
    approvedGrandPalaisUpdates, setApprovedGrandPalaisUpdates, sectionSwipeStartRef,
    mainMenuOpen, setMainMenuOpen, groupChooserOpen, setGroupChooserOpen,
    feedbackOpen, setFeedbackOpen,
    noteQuery, setNoteQuery, narrowScreen, setNarrowScreen, pdfOpen, setPdfOpen,
    accountMenuOpen, setAccountMenuOpen, checkingAppUpdate, setCheckingAppUpdate,
    appUpdateAvailable, setAppUpdateAvailable, setAppUpdatePromptOpen,
    setDataManagementOpen, setDataManagementBusy,
    accountMenuRef, accountButtonRef, viewportDebugEnabled, viewportSize, setViewportSize,
    showSchoolVacationsOnPdf, setShowSchoolVacationsOnPdf,
    showSchoolVacations, setShowSchoolVacations, schoolZone, setSchoolZone, calendarSlide,
    monthRefs, allowancesSwipeStart,
  } = appShellUi;
  const feedbackMessaging = useFeedbackMessaging(isProgramAdmin, demoMode, authStatus === "ready");

  useEffect(() => {
    const requestedView = new URLSearchParams(location.search).get("feedback");
    if (authStatus !== "ready" || (requestedView !== "compose" && requestedView !== "inbox")) return;
    if (requestedView === "inbox" && !isProgramAdmin) return;
    setFeedbackOpen(true);
    const url = new URL(location.href);
    url.searchParams.delete("feedback");
    history.replaceState(history.state, "", url);
  }, [authStatus, isProgramAdmin, setFeedbackOpen]);
  useEffect(() => {
    if (authStatus !== "ready" || new URLSearchParams(location.search).get("section") !== "forms") return;
    setHomeSection("forms");
    const url = new URL(location.href);
    url.searchParams.delete("section");
    history.replaceState(history.state, "", url);
  }, [authStatus, setHomeSection]);
  const visibleSchoolVacations = useMemo<SchoolVacation[]>(
    () => showSchoolVacations ? schoolVacationsForZone(schoolZone) : [],
    [schoolZone, showSchoolVacations],
  );
  const monthFirstKey = dateKey(localDate(view.getFullYear(), view.getMonth(), 1));
  const monthLastKey = dateKey(localDate(view.getFullYear(), view.getMonth() + 1, 0));
  const monthSchoolVacations = visibleSchoolVacations.filter(
    ({ from, to }) => from <= monthLastKey && to >= monthFirstKey,
  );
  const {
    deleteMultiplePlanningDates,
    saveOtherDateDirect,
    saveSickDateDirect,
    saveStrikeDateDirect,
    saveWishDateDirect,
  } = usePlanningEntryActions({
    entries,
    periods,
    recoveryUses,
    group,
    demoMode,
    setEntries,
    setPeriods,
    setRecoveryUses,
    setSavingDay,
    closeDay: () => setDayDate(null),
    reloadCalendar: loadCalendar,
    cancelRequest,
    notify,
    showSuccess: confirm,
    setDeletingMultipleDates,
    closeCalendarCleanup: () => {
      setCalendarDeleteMode(false);
      setCalendarDeleteDates([]);
    },
    clearBalanceDetail: () => setBalanceDetailType(null),
  });
  useEffect(() => {
    setInstallMetadataEnabled(installationEnabled);
    return () => setInstallMetadataEnabled(false);
  }, [installationEnabled]);

  useEffect(() => {
    if (authStatus !== "ready" || publicDemoAccess.active) return;
    let active = true;
    void getSharedGrandPalaisProgram()
      .then((payload) => {
        if (!active) return;
        setApprovedGrandPalaisUpdates(payload.approved ?? []);
        setIsProgramAdmin(import.meta.env.DEV && demoMode ? localDemoAdmin : payload.isAdmin);
      })
      .catch(() => {
        if (active) setIsProgramAdmin(import.meta.env.DEV && demoMode && localDemoAdmin);
      });
    return () => { active = false; };
  }, [authStatus, demoMode, localDemoAdmin, publicDemoAccess.active]);

  useEffect(() => {
    const expiresAt = import.meta.env.VITE_PUBLIC_DEMO_UNTIL;
    if (publicDemoAccess.active && expiresAt)
      localStorage.setItem("planning:public-demo-until", expiresAt);
  }, [publicDemoAccess.active]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setNarrowScreen(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (authStatus !== "ready" || publicDemoAccess.active) return;
    let active = true;
    void getUsefulContacts()
      .then((payload) => {
        if (active) setPrefetchedContacts(payload);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authStatus, publicDemoAccess.active]);
  useEffect(() => {
    if (authStatus !== "ready" || publicDemoAccess.active) return;
    void getColleagueGroups().catch(() => undefined);
  }, [authStatus, publicDemoAccess.active]);
  useEffect(() => {
    const showUpdateAlert = () => {
      setAppUpdateAvailable(true);
      setAppUpdatePromptOpen(true);
    };
    window.addEventListener("planning-app-update-available", showUpdateAlert);
    return () => window.removeEventListener("planning-app-update-available", showUpdateAlert);
  }, []);
  useEffect(() => {
    if (!mainMenuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMainMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mainMenuOpen]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      accountButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);
  useEffect(() => {
    if (!viewportDebugEnabled) return;
    const update = () =>
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [viewportDebugEnabled]);
  const wishDates = useMemo(
    () =>
      new Set(
        Object.entries(entries)
          .filter(([, entry]) => entry.wish)
          .map(([key]) => key),
      ),
    [entries],
  );
  const legacyOtherDates = useMemo(
    () =>
      new Set(
        Object.entries(entries)
          .filter(([, entry]) => entry.leave)
          .map(([key]) => key),
      ),
    [entries],
  );
  const { pdfExporting, exportAnnualPlanning } = useAnnualPdfExport(
    view,
    group,
    periods,
    recoveryUses,
    legacyOtherDates,
    wishDates,
    entries,
    (key) => Boolean(exceptionalClosureFor(key)),
    notify,
  );
  useEffect(
    () => () => {
      if (payMonthSlideTimer.current)
        window.clearTimeout(payMonthSlideTimer.current);
    },
    [],
  );
  const ignoreNextDayClick = useRef(false);
  const openedNotificationDate = useRef("");
  const noteFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  useEffect(() => {
    if (!dayDate) return;
    setNoteEditorOpen(!entries[dayDate]?.noteText);
  }, [dayDate]);
  /** Ouvre une entrée sous la note existante : une ligne vide pour aérer, puis
   *  un tiret qui marque le début de l'ajout. */
  function appendNoteLine() {
    setNoteEditorOpen(true);
    setNoteText((current) => {
      // La note déjà présente reçoit son tiret elle aussi : sans quoi la
      // première ligne se distinguerait des suivantes sans raison.
      const previous = current
        .replace(/\s+$/, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => (/^[–—\-•>]\s*/.test(line) ? line : `– ${line}`))
        .join("\n");
      return `${previous}\n\n– `;
    });
    // Le champ n'a pas encore la nouvelle valeur au moment du clic : on attend
    // le rendu pour poser le curseur à la fin.
    requestAnimationFrame(() => {
      const field = noteFieldRef.current;
      if (!field) return;
      field.focus();
      const end = field.value.length;
      field.setSelectionRange(end, end);
    });
  }

  const initializeApplication = useEffectEvent(async () => {
      const actualToday = new Date();
      setNow(actualToday);
      setView(localDate(actualToday.getFullYear(), actualToday.getMonth(), 1));
      if (demoMode) {
        if (import.meta.env.DEV) {
          const dates = [1, 2, 3].map((days) => dateKey(addDays(actualToday, days)));
          setEntries((current) => ({
            ...current,
            [dates[0]]: { ...emptyEntry(), noteText: "Préparer les documents pour notre rendez-vous", noteColor: "#d65e68", noteUpdatedAt: new Date().toISOString() },
            [dates[1]]: { ...emptyEntry(), noteText: "Penser à appeler le médecin", noteColor: "#d65e68", noteUpdatedAt: new Date().toISOString() },
          }));
          setPartnerEntries((current) => ({
            ...current,
            [dates[0]]: { noteText: "Je réserve la table pour 19 h 30", noteColor: "#f2c84b", noteAuthor: "agnes", noteUpdatedAt: new Date().toISOString(), noteGroupId: "", agnesLeave: false },
            [dates[2]]: { noteText: "Récupérer le colis après le travail", noteColor: "#f2c84b", noteAuthor: "agnes", noteUpdatedAt: new Date().toISOString(), noteGroupId: "", agnesLeave: false },
          }));
        }
        try {
          const seededProfile = JSON.parse(
            localStorage.getItem("planning:e2e-pay-profile") || "null",
          ) as FormProfile | null;
          const seededPayProfiles = JSON.parse(
            localStorage.getItem("planning:e2e-pay-profiles") || "null",
          ) as Record<string, PayProfile> | null;
          if (seededProfile) setFormProfile(seededProfile);
          if (seededPayProfiles) setPayProfiles(seededPayProfiles);
          const completed = parseDemoCompletedRequestJson(
            localStorage.getItem("planning:demo-completed-request-v1"),
          );
          if (completed?.requestId) {
            if (completed.requestKind === "recovery") {
              const quota: WorkQuota = completed.profile.workQuota;
              const recoverySelections: Array<{
                date: string;
                type: RecoveryRequestType;
                start: string;
                end: string;
              }> = [
                ...completed.periods.flatMap((item) =>
                  item.type === "recovery_day"
                    ? rangeKeys(item.from, item.to || item.from).map((date) => ({
                        date,
                        type: "recovery_day" as const,
                        start: "",
                        end: "",
                      }))
                    : [],
                ),
                ...completed.timed.map((item) => ({
                    date: item.date,
                    type: item.type,
                    start: item.start || "",
                    end: item.end || "",
                  })),
              ];
              const mappedUses: RecoveryUse[] = recoverySelections.map(
                (item, index) => ({
                  id: `${completed.requestId}-recovery-${index + 1}`,
                  date: item.date,
                  minutes: recoveryRequestMinutes(
                    item.type,
                    quota,
                    item.start,
                    item.end,
                  ),
                  start: item.start || undefined,
                  end: item.end || undefined,
                  kind: item.type === "recovery_training" ? "training" : undefined,
                  updatedAt: new Date().toISOString(),
                }),
              );
              setRecoveryUses((current) => [
                ...current.filter(
                  (item) => !item.id.startsWith(`${completed.requestId}-recovery-`),
                ),
                ...mappedUses,
              ]);
            } else {
              const mapped: LeavePeriod[] = [
                ...completed.periods.map((item, index) => ({
                  id: `${completed.requestId}-${index + 1}`,
                  from: item.from,
                  to: item.to || item.from,
                  leaveType: item.type,
                  group: completed.group,
                  updatedAt: new Date().toISOString(),
                })),
                ...completed.timed.map((item, index) => ({
                    id: `${completed.requestId}-timed-${index + 1}`,
                    from: item.date,
                    to: item.date,
                    leaveType: "half" as const,
                    halfMoment: halfMomentFromStart(item.start || "13:30"),
                    group: completed.group,
                    updatedAt: new Date().toISOString(),
                  })),
              ];
              setPeriods((current) => [
                ...current.filter((item) => !item.id.startsWith(completed.requestId)),
                ...mapped,
              ]);
            }
            localStorage.removeItem("planning:demo-completed-request-v1");
          }
        } catch {}
        setUserEmail("demo@demo.local");
        setIsProgramAdmin(import.meta.env.DEV && localDemoAdmin);
        setAuthStatus("ready");
        if (new URLSearchParams(location.search).get("request") === "saved")
          confirm("La demande est enregistrée : le planning et les soldes sont à jour.");
        return;
      }
      try {
        const callback = await handleAuthCallback();
        if (callback?.type === "invite" && callback.token) {
          setInviteToken(callback.token);
          setAuthStatus("invite");
          return;
        }
        if (callback?.type === "recovery" && callback.user) {
          setUserEmail(callback.user.email || "Compte connecté");
          setLoginEmail(callback.user.email || "");
          setLoginPassword("");
          setPasswordConfirmation("");
          setAuthStatus("recovery");
          return;
        }
        const user = await getUser();
        if (!user) {
          setAuthStatus("guest");
          return;
        }
        setUserEmail(user.email || "Compte connecté");
        await loadCalendar();
        if (new URLSearchParams(location.search).get("request") === "saved") {
          confirm("La demande est enregistrée : le planning et les soldes sont à jour.");
          history.replaceState({}, "", location.pathname);
        }
      } catch {
        setAuthStatus("guest");
        setAuthError("La connexion n’a pas pu être vérifiée. Réessayez.");
      }
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void initializeApplication();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "ready") return;
    const key = new URLSearchParams(location.search).get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || openedNotificationDate.current)
      return;
    openedNotificationDate.current = key;
    const date = fromKey(key);
    setView(localDate(date.getFullYear(), date.getMonth(), 1));
    setMode("month");
    openDay(date);
    history.replaceState({}, "", location.pathname);
  }, [authStatus, entries]);

  async function loadCalendar() {
    let data;
    try {
      data = parseCalendarSnapshot(await getCalendar<unknown>());
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 401) {
        setAuthStatus("guest");
        return;
      }
      throw error;
    }
    void notifyGuestSession().catch(() => undefined);
    setUserEmail(data.email);
    const syncedProfile = data.formProfile;
    setFormProfile(syncedProfile);
    setPayProfiles(data.payProfiles);
    if ([1, 2, 3].includes(Number(syncedProfile?.group)))
      setGroup(Number(syncedProfile?.group));
    setEntries(data.entries);
    setOvertimeEntries(data.overtimeEntries);
    setRecoveryUses(data.recoveryUses);
    setMecenatEntries(data.mecenatEntries);
    setPartnerEntries(data.partnerEntries);
    setPartnerPeriods(data.partnerPeriods);
    setPartnerSharingStatus(data.partnerSharingStatus);
    setAuthStatus("ready");
    setPeriods(data.periods);
  }
  useEffect(() => {
    if (authStatus !== "ready" || demoMode) return;
    let lastRefresh = 0;
    const refreshSharedData = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 5_000) return;
      lastRefresh = Date.now();
      void loadCalendar().catch(() => undefined);
    };
    window.addEventListener("focus", refreshSharedData);
    document.addEventListener("visibilitychange", refreshSharedData);
    return () => {
      window.removeEventListener("focus", refreshSharedData);
      document.removeEventListener("visibilitychange", refreshSharedData);
    };
  }, [authStatus, demoMode]);
  const {
    submitLogin,
    requestPasswordReset,
    submitPasswordReset,
    submitInvite,
    disconnect,
  } = useAuthenticationActions({
    demoMode,
    loginEmail,
    loginPassword,
    passwordConfirmation,
    inviteToken,
    setLoginPassword,
    setPasswordConfirmation,
    setAuthBusy,
    setAuthError,
    setAuthNotice,
    setUserEmail,
    setIsProgramAdmin,
    setAuthStatus,
    handoffKey: HANDOFF_KEY,
    loadCalendar,
    clearCalendarData: () => {
      setEntries({});
      setPeriods([]);
      setOvertimeEntries([]);
      setRecoveryUses([]);
      setMecenatEntries([]);
      setFormProfile(null);
      setPayProfiles({});
      setPartnerEntries({});
      setPartnerPeriods([]);
      setPartnerSharingStatus("disabled");
    },
    confirmMessage: confirm,
  });

  const {
    exportDataBackup,
    importDataBackup,
    deleteAllUserData,
  } = useAccountDataActions({
    setBusy: setDataManagementBusy,
    setOpen: setDataManagementOpen,
    loadCalendar,
    notify,
    showSuccess: confirm,
    get: getCalendar,
    post: postCalendar,
  });
  function changeGroup(nextGroup: number) {
    const previousGroup = group;
    const previousProfile = formProfile;
    setGroup(nextGroup);
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: String(nextGroup),
      signature: formProfile?.signature || "",
      status: formProfile?.status,
      workQuota: formProfile?.workQuota,
      workSchedule: formProfile?.workSchedule,
      baseSalary: formProfile?.baseSalary,
      residenceAllowance: formProfile?.residenceAllowance,
      ifse: formProfile?.ifse,
      carenceDay: formProfile?.carenceDay,
      otherFixed: formProfile?.otherFixed,
      cia: formProfile?.cia,
      ciaMonth: formProfile?.ciaMonth,
      netRatioFixed: formProfile?.netRatioFixed,
      netRatioVariable: formProfile?.netRatioVariable,
      navigo: formProfile?.navigo,
      mealVoucherDeduction: formProfile?.mealVoucherDeduction,
      pasRate: formProfile?.pasRate,
      manualAdjustments: formProfile?.manualAdjustments,
      cetAccount: formProfile?.cetAccount,
    };
    setFormProfile(nextProfile);
    if (demoMode)
      return;
    void postCalendar({
        action: "save-form-profile",
        fullName: nextProfile.fullName,
        group: nextProfile.group,
        signature: nextProfile.signature,
      }).catch((error) => {
        setGroup(previousGroup);
        setFormProfile(previousProfile);
        notify(
          calendarErrorMessage(error, "Le groupe n’a pas pu être enregistré."),
        );
      });
  }
  /** IFSE, CIA et les primes automatiques (dimanche, férié, net estimé) sont
   *  calées sur les règles d'un fonctionnaire. Passer sur « Contractuel »
   *  ne touche à aucun montant déjà saisi : ça change seulement ce qui
   *  s'affiche, au cas où ce statut serait choisi puis annulé. */
  function changeStatus(nextStatus: PayStatus) {
    const previousProfile = formProfile;
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
      signature: formProfile?.signature || "",
      status: nextStatus,
      workQuota: formProfile?.workQuota,
      workSchedule: formProfile?.workSchedule,
      baseSalary: formProfile?.baseSalary,
      residenceAllowance: formProfile?.residenceAllowance,
      ifse: formProfile?.ifse,
      carenceDay: formProfile?.carenceDay,
      otherFixed: formProfile?.otherFixed,
      cia: formProfile?.cia,
      ciaMonth: formProfile?.ciaMonth,
      netRatioFixed: formProfile?.netRatioFixed,
      netRatioVariable: formProfile?.netRatioVariable,
      navigo: formProfile?.navigo,
      mealVoucherDeduction: formProfile?.mealVoucherDeduction,
      pasRate: formProfile?.pasRate,
      manualAdjustments: formProfile?.manualAdjustments,
      cetAccount: formProfile?.cetAccount,
    };
    setFormProfile(nextProfile);
    if (demoMode)
      return;
    void postCalendar({
        action: "save-form-profile",
        fullName: nextProfile.fullName,
        group: nextProfile.group,
        signature: nextProfile.signature,
        status: nextStatus,
      }).catch((error) => {
        setFormProfile(previousProfile);
        notify(
          calendarErrorMessage(error, "Le statut n’a pas pu être enregistré."),
        );
      });
  }
  const selectedList = useMemo(
    () =>
      Object.values(selections).sort((a, b) => a.date.localeCompare(b.date)),
    [selections],
  );
  const selectedCounts = useMemo(
    () =>
      selectedList.reduce(
        (acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [selectedList],
  );
  function selectRecoveryType(type: SelectionType) {
    setActiveType(type);
    if (!requestSeedDate) return;
    const schedule = formProfile?.workSchedule || DEFAULT_WORK_SCHEDULE;
    const start = schedule.start;
    const end = schedule.end;
    setSelections((current) => {
      return {
        ...current,
        [requestSeedDate]: { date: requestSeedDate, type, start, end },
      };
    });
    setTimeStart(start);
    setTimeEnd(end);
    setTimeDate(requestSeedDate);
  }
  function selectLeaveType(type: SelectionType) {
    setActiveType(type);
    if (!requestSeedDate) return;
    const schedule = formProfile?.workSchedule || DEFAULT_WORK_SCHEDULE;
    const halfTimes = workScheduleHalfTimes(schedule, "morning");
    setSelections((current) => {
      if (!current[requestSeedDate]) return current;
      return {
        ...current,
        [requestSeedDate]: type === "half"
          ? { date: requestSeedDate, type, start: halfTimes.start, end: halfTimes.end }
          : { date: requestSeedDate, type },
      };
    });
    if (type !== "half") return;
    setTimeStart(halfTimes.start);
    setTimeEnd(halfTimes.end);
    setTimeDate(requestSeedDate);
  }
  function exceptionalClosureFor(key: string) {
    const override = entries[key]?.closureOverride;
    if (override === "open") return undefined;
    if (override === "closed")
      return { date: key, label: "Fermeture exceptionnelle ajoutée manuellement" };
    return grandPalaisExceptionalClosure(key, approvedGrandPalaisUpdates);
  }

  const workExchangeUi = useWorkExchangeActions({
    group,
    entries,
    setEntries,
    periods,
    recoveryUses,
    demoMode,
    isExceptionallyClosed: (key) => Boolean(exceptionalClosureFor(key)),
    showSuccess: confirm,
  });
  const {
    exchanges: workExchanges,
    openNew: openWorkExchange,
    openEdit: editWorkExchange,
  } = workExchangeUi;

  const totals = useMemo(() => {
    const result = { work: 0, training: 0, workedHoliday: 0 };
    const fullDayMinutes = dailyMinutesForQuota(formProfile?.workQuota || "full");
    const months =
      mode === "year"
        ? Array.from({ length: 12 }, (_, index) => index)
        : [view.getMonth()];
    for (const month of months) {
      for (let day = 1; day <= monthDays(view.getFullYear(), month); day++) {
        const date = localDate(view.getFullYear(), month, day);
        const key = dateKey(date);
        const info = getDayInfo(date, group);
        const exceptionallyClosed = Boolean(
          exceptionalClosureFor(key),
        );
        const exchangeRole = entries[key]?.exchangeRole || "";
        const unavailableWithoutExchange =
          exceptionallyClosed ||
          Boolean(entries[key]?.leave) ||
          periods.some((period) => key >= period.from && key <= period.to) ||
          recoveryUses
            .filter((item) => item.date === key)
            .reduce((total, item) => total + item.minutes, 0) >= fullDayMinutes;
        const notWorked = unavailableWithoutExchange || exchangeRole === "given";
        if ((info.kind === "work" && !notWorked) || (info.kind === "off" && exchangeRole === "return"))
          result.work++;
        if (info.kind === "training") {
          const presence = personalPresenceForDate(date, group, periods, entries, recoveryUses, fullDayMinutes, (key) => Boolean(exceptionalClosureFor(key)));
          if (presence.status === "training" || presence.status === "work") result.training++;
          else if (presence.status === "partial") result.training += 1 - (presence.absentMinutes || 0) / attendanceDayMinutes(date, group, fullDayMinutes);
        }
        // La paie et les droits liés au cycle restent théoriques : l'échange
        // modifie la présence affichée, jamais le férié de référence.
        if (info.holiday && info.kind === "work" && !unavailableWithoutExchange)
          result.workedHoliday++;
      }
    }
    return result;
  }, [view, group, mode, entries, periods, recoveryUses, formProfile?.workQuota, approvedGrandPalaisUpdates]);

  /* Le mois affiché, puis les trois tiers de l'année affichée — tous calculés
     par la même fonction, donc jamais en contradiction entre eux. Le tiers
     « en cours » suit la date du jour, pas le mois affiché : on peut consulter
     un autre mois sans perdre de vue où en est le cycle actuel. */
  const workedDays = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const currentThird =
      now.getFullYear() === year ? yearThirdFor(now.getMonth()) : null;
    return {
      month: workedDayCount(
        year,
        month,
        month,
        group,
        periods,
        entries,
        recoveryUses,
        dailyMinutesForQuota(formProfile?.workQuota || "full"),
        (key) => Boolean(exceptionalClosureFor(key)),
        (key) => entries[key]?.exchangeRole || "",
      ),
      thirds: YEAR_THIRDS.map((third) => ({
        label: third.label,
        range: yearThirdRange(third),
        current: currentThird?.label === third.label,
        ...workedDayCount(
          year,
          third.firstMonth,
          third.lastMonth,
          group,
          periods,
          entries,
          recoveryUses,
          dailyMinutesForQuota(formProfile?.workQuota || "full"),
          (key) => Boolean(exceptionalClosureFor(key)),
          (key) => entries[key]?.exchangeRole || "",
        ),
      })),
    };
  }, [view, group, periods, entries, recoveryUses, formProfile?.workQuota, now, approvedGrandPalaisUpdates]);

  const remainingWorkedDaysThisYear = useMemo(
    () =>
      workedDayCountBetween(
        now,
        localDate(now.getFullYear(), 11, 31),
        group,
        periods,
        entries,
        recoveryUses,
        dailyMinutesForQuota(formProfile?.workQuota || "full"),
        (key) => Boolean(exceptionalClosureFor(key)),
        (key) => entries[key]?.exchangeRole || "",
      ).worked,
    [now, group, periods, entries, recoveryUses, formProfile?.workQuota, approvedGrandPalaisUpdates],
  );

  // Au premier usage, le statut demandé est désormais « contractuel ». Dès
  // qu'un choix est enregistré, la valeur persistée reprend naturellement la
  // priorité lors des ouvertures suivantes.
  const isContractuel = formProfile?.status !== "fonctionnaire";
  const workQuota: WorkQuota = formProfile?.workQuota || "full";
  const workDayMinutes = dailyMinutesForQuota(workQuota);
  const mecenatDraftCalculation = useMemo(
    () =>
      calculateMecenatVacation(
        mecenatDraft.start,
        mecenatDraft.end,
        workQuota,
      ),
    [mecenatDraft.start, mecenatDraft.end, workQuota],
  );
  const payYear = String(payView.getFullYear());
  // Les réglages généraux restent disponibles pour tous les mois. Les valeurs
  // annuelles ou datées ne remplacent que les champs propres à leur période ;
  // le contrôle d'un bulletin reste, lui, filtré sur son mois plus bas.
  const activePayProfile = effectivePayProfile(
    payProfiles,
    payYear,
    payView.getMonth(),
    formProfile || {},
  );
  const hasPayValue = (field: keyof PayProfile) =>
    activePayProfile[field] !== undefined;
  const baseSalary = activePayProfile.baseSalary ?? 0;
  const ifse = activePayProfile.ifse ?? 0;
  const carenceDay = activePayProfile.carenceDay ?? 0;
  // Pour une contractuelle, la seule ligne fixe confirmée est l'indemnité de
  // résidence (3 % du traitement) : calculée toute seule plutôt que saisie,
  // et pas la somme à cinq lignes propre à un fonctionnaire (résidence +
  // SMIC comp. + ICHCSG + MGEN − transfert), dont rien ne dit qu'elle
  // s'applique à elle. Une valeur déjà saisie à la main reste prioritaire,
  // au cas où son bulletin réel montrerait autre chose.
  const otherFixed =
    activePayProfile.otherFixed ??
    (isContractuel ? baseSalary * RESIDENCE_ALLOWANCE_RATE : 0);
  const cia = activePayProfile.cia ?? 0;
  const ciaMonth = activePayProfile.ciaMonth;
  const residenceAllowance =
    activePayProfile.residenceAllowance ??
    (isContractuel ? baseSalary * RESIDENCE_ALLOWANCE_RATE : undefined);
  const viewedPayRegime = payCalibrationRegime(
    payView.getFullYear(),
    payView.getMonth(),
  );
  const defaultNetRatios = defaultNetRatiosForPeriod(
    payView.getFullYear(),
    payView.getMonth(),
  );
  // Les profils antérieurs à ce champ ont tous été calibrés sous le régime
  // collectif actuel : on les traite comme tels pour ne pas changer les
  // estimations récentes déjà validées.
  const storedNetRatioRegime =
    activePayProfile.netRatioRegime ??
    "culture-psc";
  const storedNetRatioFixed = activePayProfile.netRatioFixed;
  const storedNetRatioVariable = activePayProfile.netRatioVariable;
  const netRatioFixed =
    storedNetRatioRegime === viewedPayRegime &&
    storedNetRatioFixed &&
    storedNetRatioFixed > 0
      ? storedNetRatioFixed
      : defaultNetRatios.netRatioFixed;
  const netRatioVariable =
    storedNetRatioRegime === viewedPayRegime &&
    storedNetRatioVariable &&
    storedNetRatioVariable > 0
      ? storedNetRatioVariable
      : defaultNetRatios.netRatioVariable;
  const payslipRateCalibration = inspectNetRatioCalibration(
    readingsForCalibrationRegime(
      payslipRateSamples.map((item) => item.reading),
      viewedPayRegime,
    ),
  );
  const navigo = activePayProfile.navigo ?? 0;
  const mealVoucherDeduction =
    activePayProfile.mealVoucherDeduction ??
    0;
  const pasRate = activePayProfile.pasRate ?? 0;
  /** Première année de mise à disposition au Grand Palais, où le jour de
   *  fermeture est le lundi et non le mardi comme à Pompidou — tout est
   *  décalé d'un jour, et les fériés compensés (voir plus bas) s'appliquent.
   *  En cours depuis, sans fin prévue : pas de borne de fin. */
  const SECONDMENT_START_YEAR = 2026;
  /** L'administration prélève le PAS sur une assiette « net imposable »
   *  toujours un peu plus large que le net avant impôt reconstitué ici —
   *  jamais détaillée sur le bulletin. Facteur correcteur calibré sur 3
   *  bulletins réels (2026), stable à ± 0,7 point près sur les trois : sans
   *  lui, appliquer le taux affiché tel quel sous-estime l'impôt retenu. */
  const PAS_BASE_ADJUSTMENT = 1.057;
  const sundayCarryover = formProfile?.sundayCarryover || 0;
  const sundayCarryoverYear = formProfile?.sundayCarryoverYear;
  const sundayCarryoverMonth = formProfile?.sundayCarryoverMonth;
  const sundayCarryoverFromYear = formProfile?.sundayCarryoverFromYear;
  const sundayCarryoverFromMonth = formProfile?.sundayCarryoverFromMonth;

  /* Les arrêts maladie de l'année affichée.
   *
   *  Un arrêt vaut une carence, et un arrêt est une suite de jours consécutifs
   *  — pas une période enregistrée : poser douze jours depuis « Choisir
   *  plusieurs dates » crée douze périodes d'un jour, qui ne font pourtant
   *  qu'un seul arrêt. Deux arrêts séparés dans le mois donnent bien deux
   *  carences.
   */
  const sickLeaves = useMemo(() => {
    return sickLeaveSummaryForYear(periods, payView.getFullYear(), baseSalary, ifse, carenceDay);
  }, [payView, periods, baseSalary, ifse, carenceDay]);

  /* Le choix ne s'affiche que sur un férié effectivement travaillé : ni posé
     en congé, ni tombé sur un repos ou une formation — `getDayInfo` a déjà
     écarté ces deux cas en renvoyant « off ». */
  const dayHolidayChoiceVisible = useMemo(() => {
    if (!dayDate) return false;
    const info = getDayInfo(fromKey(dayDate), group);
    if (!info.holiday || info.kind !== "work") return false;
    if (dayPersonalLeave) return false;
    return !periods.some(
      (period) => dayDate >= period.from && dayDate <= period.to,
    );
  }, [dayDate, group, dayPersonalLeave, periods]);

  /* Les dimanches et fériés réellement travaillés d'une année, plus les
   *  fériés compensés.
   *
   *  Un dimanche ne compte que s'il est prévu au cycle, non férié (les
   *  dimanches fériés relèvent de l'autre indemnité) et non posé en congé. Un
   *  férié ne compte que s'il est travaillé, ce que `getDayInfo` tranche déjà
   *  en renvoyant « off » pour les fériés toujours fermés et ceux qui tombent
   *  sur un repos ou une formation.
   *
   *  Un férié « compensé » est l'inverse : le cycle ne le fait pas travailler,
   *  mais la veille était travaillée — c'est le décalage d'un jour entre les
   *  deux maisons, Pompidou fermant le mardi et le Grand Palais le lundi. Ces
   *  fériés-là sont payés en prime seule, sur la paie de février de l'année
   *  suivante. C'est déjà la définition qui marque les fériés « offerts » sur
   *  les plannings PDF.
   */
  function collectWorkedDays(year: number) {
    const todayKey = dateKey(now);
    const onLeave = (key: string) =>
      Boolean(entries[key]?.leave) ||
      periods.some(
        (period) =>
          key >= period.from &&
          key <= period.to,
      );
    const sundays: Array<{ key: string; rank: number; past: boolean }> = [];
    const holidays: Array<{
      key: string;
      name: string;
      choice: HolidayPay | "";
      past: boolean;
    }> = [];
    const compensated: Array<{
      key: string;
      name: string;
      choice: HolidayPay | "";
    }> = [];
    const cancelledHolidays: Array<{ key: string; name: string }> = [];
    // Dimanches que le cycle programme jusqu'à aujourd'hui, sans tenir compte
    // des congés ni des arrêts maladie : le repère pour « combien j'en aurais
    // fait sans rien avoir posé », à comparer à `sundayDone` plus bas, qui lui
    // exclut les dimanches couverts par un congé.
    let sundaysScheduledPast = 0;
    for (let month = 0; month < 12; month++)
      for (let day = 1; day <= monthDays(year, month); day++) {
        const date = localDate(year, month, day);
        const info = getDayInfo(date, group);
        const key = dateKey(date);
        if (info.kind !== "work") {
          if (info.holiday && wasPompidouHolidayWorked(date, group))
            compensated.push({
              key,
              name: info.holiday,
              choice: entries[key]?.holidayPay || "",
            });
          continue;
        }
        if (!info.holiday && date.getDay() === 0 && key <= todayKey)
          sundaysScheduledPast++;
        if (onLeave(key)) {
          if (info.holiday)
            cancelledHolidays.push({ key, name: info.holiday });
          continue;
        }
        if (info.holiday) {
          holidays.push({
            key,
            name: info.holiday,
            choice: entries[key]?.holidayPay || "",
            past: key <= todayKey,
          });
          continue;
        }
        if (date.getDay() === 0)
          sundays.push({ key, rank: sundays.length + 1, past: key <= todayKey });
      }
    // Les personnes qui commencent à utiliser l'application en cours d'année
    // peuvent reprendre uniquement un nombre de dimanches déjà posés, sans
    // ressaisir toutes les dates. On retire ces dimanches des périodes de paie
    // correspondantes ; les congés datés enregistrés ensuite ont déjà été
    // écartés par `onLeave` et continuent donc de s'ajouter naturellement.
    const manual =
      formProfile?.manualAdjustments?.[String(year)] ??
      EMPTY_MANUAL_ADJUSTMENTS;
    const adjustedSundays = applyManualSundayLeave(sundays, {
      janJun: manual.sundayLeaveJanJun,
      julSep: manual.sundayLeaveJulSep,
      octNov: manual.sundayLeaveOctNov,
      dec: manual.sundayLeaveDec,
    });
    const worked = adjustedSundays.length;
    const decided = holidays.filter((item) => item.choice);
    return {
      year,
      sundays: adjustedSundays,
      sundayCount: worked,
      sundayTotal: sundayAllowance(worked),
      sundaysScheduledPast,
      holidays,
      holidayPending: holidays.length - decided.length,
      cancelledHolidays,
      compensated,
      recoveryDaysEarned: holidays.filter(
        (item) => item.choice === "recovery",
      ).length,
    };
  }

  /* Ce qui tombera sur chacune des douze paies de l'année affichée.
   *
   *  Deux décalages à respecter : les dimanches de décembre sont payés en
   *  janvier de l'année suivante, et un férié est payé le mois suivant. La
   *  paie de janvier porte donc du décembre de l'année précédente, qu'il faut
   *  aller chercher.
   */
  const allowances = useMemo(() => {
    const year = payView.getFullYear();
    const current = collectWorkedDays(year);
    const previous = collectWorkedDays(year - 1);
    // Le versement mensuel du forfait n'entre pas ici : il tombe tous les mois
    // quoi qu'il arrive, ce ne sont pas les primes à suivre de près.
    const monthly = Array.from({ length: 12 }, () => ({
      sunday: 0,
      sundayCount: 0,
      holiday: 0,
      holidayCount: 0,
      compensated: 0,
      compensatedCount: 0,
      carryover: 0,
      reported: 0,
    }));
    // Seuls les dimanches du onzième au trente-et-unième se versent ; les
    // suivants ne sont pas majorés, ils n'apparaissent donc sur aucune paie.
    const payoutMonth = [6, 9, 11, 0];
    for (const sunday of current.sundays.slice(
      SUNDAY_ALLOWANCE.flatUntil,
      SUNDAY_ALLOWANCE.paidUntil,
    )) {
      const order = sundayPayslip(sunday.key).order;
      // Décembre relève de la paie de janvier de l'année suivante : hors de
      // l'année affichée, il n'est pas montré ici.
      if (order === 3) continue;
      const slot = monthly[payoutMonth[order]];
      slot.sunday += SUNDAY_ALLOWANCE.perSunday;
      slot.sundayCount++;
    }
    for (const sunday of previous.sundays.slice(
      SUNDAY_ALLOWANCE.flatUntil,
      SUNDAY_ALLOWANCE.paidUntil,
    )) {
      if (sundayPayslip(sunday.key).order !== 3) continue;
      monthly[0].sunday += SUNDAY_ALLOWANCE.perSunday;
      monthly[0].sundayCount++;
    }
    // Un dimanche manqué sur un bulletin, reporté depuis « Vérifier mon
    // bulletin » : la paie a un délai de traitement, il n'apparaît qu'au
    // rappel suivant plutôt que d'être perdu.
    if (
      sundayCarryover &&
      sundayCarryoverYear === year &&
      sundayCarryoverMonth !== undefined
    ) {
      const slot = monthly[sundayCarryoverMonth];
      slot.sunday += sundayCarryover * SUNDAY_ALLOWANCE.perSunday;
      slot.sundayCount += sundayCarryover;
      slot.carryover = sundayCarryover;
    }
    // Le bulletin d'où vient le report n'a, lui, pas payé ces dimanches : sa
    // propre case doit le montrer plutôt que d'afficher ce que le cycle
    // laissait attendre.
    if (
      sundayCarryover &&
      sundayCarryoverFromYear === year &&
      sundayCarryoverFromMonth !== undefined
    ) {
      const slot = monthly[sundayCarryoverFromMonth];
      slot.sunday = Math.max(
        0,
        slot.sunday - sundayCarryover * SUNDAY_ALLOWANCE.perSunday,
      );
      slot.sundayCount = Math.max(0, slot.sundayCount - sundayCarryover);
      slot.reported = sundayCarryover;
    }
    const addHoliday = (
      item: { key: string; choice: HolidayPay | "" },
      monthIndex: number,
    ) => {
      const slot = monthly[monthIndex];
      slot.holidayCount++;
      if (item.choice)
        slot.holiday += holidayAllowance(baseSalary, item.choice);
    };
    for (const item of current.holidays) {
      // Un férié de décembre est payé en janvier de l'année suivante.
      if (Number(item.key.slice(5, 7)) === 12) continue;
      addHoliday(item, holidayPayslip(item.key).monthIndex);
    }
    for (const item of previous.holidays)
      if (Number(item.key.slice(5, 7)) === 12) addHoliday(item, 0);
    /* Les fériés compensés de l'année précédente tombent sur la paie de
       février, en prime seule — ligne « Compens. Indem jf ac public n-1 » du
       bulletin. Seules les années de mise à disposition comptent : avant
       elle, le jour de fermeture était le mardi et non le lundi, si bien que
       le décalage d'un jour ne s'appliquait pas. */
    const compensatedYear = year - 1;
    const compensatedCount =
      compensatedYear >= SECONDMENT_START_YEAR
        ? previous.compensated.length
        : 0;
    if (compensatedCount) {
      monthly[1].compensatedCount = compensatedCount;
      // Comme un férié travaillé : la prime seule et la prime + récup ne
      // valent pas le même montant, donc rien n'est compté tant que le choix
      // n'a pas été fait, plutôt que de supposer la prime seule par défaut.
      monthly[1].compensated = previous.compensated.reduce(
        (total, item) =>
          item.choice
            ? total + holidayAllowance(baseSalary, item.choice)
            : total,
        0,
      );
    }
    const done = current.sundays.filter((item) => item.past).length;
    const months = monthly
      .map((slot, index) => ({
        ...slot,
        index,
        total: slot.sunday + slot.holiday + slot.compensated,
      }))
      // Seuls les mois qui portent une prime méritent une ligne : les autres
      // ne reçoivent que le forfait, identique toute l'année.
      .filter(
        (slot) =>
          slot.sundayCount > 0 ||
          slot.holidayCount > 0 ||
          slot.compensatedCount > 0,
      );
    return {
      ...current,
      sundayDone: done,
      sundayLeft: current.sundays.length - done,
      // Le socle se lit sur les dimanches déjà faits. Tant qu'aucun n'est
      // travaillé, on annonce le premier socle plutôt que rien.
      tier: sundayTierFor(Math.max(1, done)),
      // Ceux de l'année précédente, ceux qui se paient en février : la carte
      // les liste, l'année affichée ne les verra qu'un an plus tard.
      compensatedPrevious: previous.compensated,
      compensatedYear,
      compensatedPaid: compensatedCount > 0,
      monthly: months,
      monthlyTotal: months.reduce((total, slot) => total + slot.total, 0),
      sundayMonthsTotal: months.reduce((total, slot) => total + slot.sunday, 0),
    };
  }, [
    payView,
    group,
    entries,
    periods,
    baseSalary,
    now,
    sundayCarryover,
    sundayCarryoverYear,
    sundayCarryoverMonth,
    sundayCarryoverFromYear,
    sundayCarryoverFromMonth,
    formProfile?.manualAdjustments,
  ]);

  const holidayRecoveryEarnings = useMemo(
    () =>
      holidayRecoveryEntries(
        Object.entries(entries)
          .filter(([, entry]) => entry.holidayPay === "recovery")
          .map(([date, entry]) => ({ date, minutes: entry.holidayRecoveryMinutes })),
      ),
    [entries],
  );
  const unresolvedHolidayRecoveryCount = useMemo(
    () => Object.values(entries).filter((entry) =>
      entry.holidayPay === "recovery" && !entry.holidayRecoveryMinutes
    ).length,
    [entries],
  );
  const recoveryEarnings = useMemo(
    () => [...overtimeEntries, ...holidayRecoveryEarnings],
    [overtimeEntries, holidayRecoveryEarnings],
  );
  const recoveryBalance = useMemo(
    () => monthlyRecoveryBalance(recoveryEarnings, recoveryUses, (key) => {
      const date = fromKey(key);
      return date.getDay() === 0 || Boolean(getDayInfo(date, group).holiday);
    }),
    [recoveryEarnings, recoveryUses, group],
  );
  const recoverySelectionInsufficient = requestKind === "recovery" &&
    requestRecoveryMinutes(selectedList, workQuota) > recoveryBalance.remaining;
  const recoverySelectionIncomplete = requestKind === "recovery" && selectedList.some((item) =>
    item.type.startsWith("recovery_") && requestRecoveryMinutes([item], workQuota) <= 0
  );
  const recoveryEarningStates = useMemo(
    () =>
      new Map(
        allocateRecoveryUses(recoveryEarnings, recoveryUses, (key) => {
          const date = fromKey(key);
          return date.getDay() === 0 || Boolean(getDayInfo(date, group).holiday);
        }).map((item) => [
          item.entryId,
          item,
        ]),
      ),
    [recoveryEarnings, recoveryUses, group],
  );

  function paidOvertimeForPayPeriod(payYear: number, payMonth: number) {
    const performedMonth = (payMonth + 11) % 12;
    const performedYear = payYear - (payMonth === 0 ? 1 : 0);
    const performedProfile = payProfiles[String(performedYear)];
    const performedBase =
      performedProfile?.baseSalary ?? formProfile?.baseSalary ?? 0;
    const performedResidence =
      performedProfile?.residenceAllowance ??
      formProfile?.residenceAllowance ??
      performedBase * RESIDENCE_ALLOWANCE_RATE;
    return {
      performedMonth,
      performedYear,
      ...calculatePaidOvertime(
        overtimeEntries,
        performedYear,
        performedMonth,
        workQuota,
        performedBase,
        performedResidence,
        (key) => {
          const date = fromKey(key);
          return date.getDay() === 0 || Boolean(getDayInfo(date, group).holiday);
        },
      ),
    };
  }

  async function checkForAppUpdate() {
    if (checkingAppUpdate) return;
    setCheckingAppUpdate(true);
    try {
      if (!demoMode && "serviceWorker" in navigator) {
        const registration =
          (await navigator.serviceWorker.getRegistration()) ??
          (await navigator.serviceWorker.register("/sw.js", {
            updateViaCache: "none",
          }));
        await registration.update();
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      }
    } catch {
      // Le rechargement ci-dessous reste utile même si le contrôle du service
      // worker échoue (hors connexion, navigateur ancien ou cache corrompu).
    } finally {
      window.setTimeout(() => window.location.reload(), 250);
    }
  }

  const overtimeForPayMonth = useMemo(() => {
    return paidOvertimeForPayPeriod(payView.getFullYear(), payView.getMonth());
  }, [payView, payProfiles, formProfile, overtimeEntries, workQuota]);
  const mecenatForCurrentPayMonth = useMemo(
    () => mecenatForPayMonth(mecenatEntries, payView.getFullYear(), payView.getMonth()),
    [mecenatEntries, payView],
  );
  const strikeForCurrentPayMonth = useMemo(
    () =>
      strikePayEstimate(
        periods,
        group,
        payProfiles,
        payView.getFullYear(),
        payView.getMonth(),
        { entries, recoveryUses },
      ),
    [periods, group, payProfiles, payView, entries, recoveryUses],
  );

  /* La paie du mois affiché : les primes de ce mois-là, retenues déduites.
     C'est la question qu'on se pose en ouvrant un mois. */
  const monthPay = useMemo(() => {
    if (!allowances || !sickLeaves) return null;
    const index = payView.getMonth();
    const month = allowances.monthly.find((slot) => slot.index === index);
    // Maladie et grève se retiennent à l'identique quel que soit le statut
    // (voir src/payMonth.ts) : seules l'IFSE et le CIA sont réservés aux
    // fonctionnaires.
    const sick = sickLeaves.byMonth[index];
    const strikeMonthDeduction = strikeDeduction(
      strikeForCurrentPayMonth.totalDeduction,
    );
    const sunday = month?.sunday || 0;
    const holiday = month?.holiday || 0;
    const compensated = month?.compensated || 0;
    return {
      index,
      flat: SUNDAY_ALLOWANCE.monthlyFlat,
      sunday,
      sundayCount: month?.sundayCount || 0,
      carryover: month?.carryover || 0,
      reported: month?.reported || 0,
      holiday,
      holidayCount: month?.holidayCount || 0,
      compensated,
      compensatedCount: month?.compensatedCount || 0,
      sick: sick.total,
      sickDays: sick.days,
      strike: strikeMonthDeduction,
      strikeDays: strikeForCurrentPayMonth.days.length,
      strikeDeductedDays:
        strikeForCurrentPayMonth.days.length +
        strikeForCurrentPayMonth.automaticAdditionalDays.length,
      strikeAutomaticDays: strikeForCurrentPayMonth.automaticAdditionalDays.length,
      strikePotentialDays: strikeForCurrentPayMonth.potentialAdditionalDays.length,
      cia: index === ciaMonth ? cia : 0,
      ...monthGross({
        baseSalary,
        ifse,
        otherFixed,
        cia: index === ciaMonth ? cia : 0,
        monthlyFlat: SUNDAY_ALLOWANCE.monthlyFlat,
        sunday,
        holiday,
        compensated,
        sickTotal: sick.total,
        strikeDeduction: strikeMonthDeduction,
        overtimeAmount: overtimeForPayMonth.amount,
        mecenatGross: mecenatForCurrentPayMonth.grossAmountCents / 100,
      }),
    };
  }, [
    allowances,
    sickLeaves,
    payView,
    baseSalary,
    ifse,
    otherFixed,
    cia,
    ciaMonth,
    isContractuel,
    overtimeForPayMonth,
    mecenatForCurrentPayMonth,
    strikeForCurrentPayMonth,
  ]);

  /* Le forfait dominical existe même lorsque le traitement n'a jamais été
   * renseigné. L'afficher seul comme « brut estimé » donnerait donc un
   * montant précis mais trompeur. Le calcul reste intact et n'est présenté
   * qu'une fois les éléments fixes indispensables connus. */
  const availablePayEstimateFields = new Set<PayEstimateField>(
    (["baseSalary", "ifse", "otherFixed", "carenceDay", "pasRate"] as const)
      .filter((field) => hasPayValue(field)),
  );
  const estimateReadiness = payEstimateReadiness({
    isContractuel,
    availableFields: availablePayEstimateFields,
    sickDays: monthPay?.sickDays || 0,
  });
  const strikeEstimateReady =
    !(strikeForCurrentPayMonth.days.length + strikeForCurrentPayMonth.automaticAdditionalDays.length) ||
    strikeForCurrentPayMonth.totalDeduction !== null;
  const strikeMissing =
    strikeForCurrentPayMonth.days.length + strikeForCurrentPayMonth.automaticAdditionalDays.length && !strikeEstimateReady
      ? ["traitement et indemnité de résidence connus avant la grève"]
      : [];
  const grossEstimateComplete = estimateReadiness.grossReady && strikeEstimateReady;
  const netEstimateMissing = [...estimateReadiness.netMissing, ...strikeMissing];
  const netEstimateComplete = estimateReadiness.netReady && strikeEstimateReady;

  /** Le net estimé du mois affiché : cotisations d'abord, avec deux taux —
   *  le traitement porte la pension civile, les primes non —, puis l'impôt à
   *  part, pour qu'un changement de taux se corrige sans tout recalibrer.
   *  `null` tant que les taux ne sont pas renseignés. */
  const netCalculation =
    netEstimateComplete &&
    monthPay &&
    netRatioFixed > 0 &&
    netRatioVariable > 0
      ? (() => {
          const netFromGross = roundCurrency(
            monthPay.grossFixed * (netRatioFixed / 100) +
            monthPay.grossVariable * (netRatioVariable / 100),
          );
          // Jamais prélevés en décembre, confirmé sur les bulletins de 2024
          // et 2025 : la ligne « Titres repas carte » y est absente.
          const mealVouchers = monthPay.index === 11 ? 0 : mealVoucherDeduction;
          const netBeforeTax = roundCurrency(netFromGross + navigo - mealVouchers);
          const incomeTax = roundCurrency(netBeforeTax * (pasRate / 100) * PAS_BASE_ADJUSTMENT);
          return {
            netFromGross,
            estimatedContributions: roundCurrency(monthPay.gross - netFromGross),
            mealVouchers,
            netBeforeTax,
            incomeTax,
            net: roundCurrency(netBeforeTax - incomeTax),
          };
        })()
      : null;
  const monthNet = netCalculation?.net ?? null;

  const leaveStats = useMemo(() => {
    const year = absenceYear;
    const todayKey = dateKey(now);
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    const counted = new Set<string>();
    const manual =
      formProfile?.manualAdjustments?.[String(year)] ??
      EMPTY_MANUAL_ADJUSTMENTS;
    const used: Record<BalanceType, number> = {
      annual: manual.annualUsed,
      rtt: manual.rttUsed,
      fraction: manual.fractionUsed,
    };
    const details: Record<
      BalanceType,
      Array<{ date: string; units: number; period: LeavePeriod }>
    > = {
      annual: [],
      rtt: [],
      fraction: [],
    };
    // Suivis à part : comptés, mais sans droit à consommer.
    const countedOnly: Record<
      CountedOnlyType,
      { used: number; details: Array<{ date: string; units: number; period: LeavePeriod }> }
    > = {
      sick: { used: 0, details: [] },
      strike: { used: 0, details: [] },
      childcare: { used: 0, details: [] },
      exceptional: { used: 0, details: [] },
      other: { used: 0, details: [] },
      cet: { used: 0, details: [] },
      work_accident: { used: 0, details: [] },
    };
    for (const period of periods) {
      if (
        !period.leaveType ||
        period.to < first ||
        period.from > last
      )
        continue;
      // Une récupération rend des heures déjà travaillées : rien n'est déduit,
      // et elle n'alimente aucun compteur non plus.
      if (period.leaveType === "recovery")
        continue;
      const countedType = COUNTED_ONLY_TYPES.includes(
        period.leaveType as CountedOnlyType,
      )
        ? (period.leaveType as CountedOnlyType)
        : null;
      const category =
        period.leaveType === "half" ? "annual" : period.leaveType;
      const units = period.leaveType === "half" ? 0.5 : 1;
      const from = period.from < first ? first : period.from;
      const to = period.to > last ? last : period.to;
      for (
        let date = fromKey(from);
        dateKey(date) <= to;
        date = addDays(date, 1)
      ) {
        const key = dateKey(date);
        const info = getDayInfo(date, period.group || group);
        if (info.holiday || info.kind === "off") continue;
        const countKey = `${category}:${key}:${units}`;
        if (counted.has(countKey)) continue;
        counted.add(countKey);
        if (countedType) {
          countedOnly[countedType].used += units;
          countedOnly[countedType].details.push({ date: key, units, period });
          continue;
        }
        used[category as BalanceType] += units;
        details[category as BalanceType].push({ date: key, units, period });
      }
    }
    return {
      balances: (["annual", "rtt", "fraction"] as const).map((type) => {
        const manualUsed = manual[`${type}Used` as "annualUsed" | "rttUsed" | "fractionUsed"];
        const sortedDetails = details[type].sort((a, b) => a.date.localeCompare(b.date));
        return {
          type,
          allowance: LEAVE_ALLOWANCES[type],
          manualUsed,
          used: used[type],
          taken: manualUsed + sortedDetails.filter((detail) => detail.date <= todayKey).reduce((sum, detail) => sum + detail.units, 0),
          upcoming: sortedDetails.filter((detail) => detail.date > todayKey).reduce((sum, detail) => sum + detail.units, 0),
          remaining: LEAVE_ALLOWANCES[type] - used[type],
          details: sortedDetails,
        };
      }),
      countedOnly,
    };
  }, [periods, absenceYear, group, formProfile?.manualAdjustments, now]);

  const activeManualAdjustments =
    formProfile?.manualAdjustments?.[String(absenceYear)] ??
    EMPTY_MANUAL_ADJUSTMENTS;
  const manualSundayLeaveTotal =
    activeManualAdjustments.sundayLeaveJanJun +
    activeManualAdjustments.sundayLeaveJulSep +
    activeManualAdjustments.sundayLeaveOctNov +
    activeManualAdjustments.sundayLeaveDec;

  // Totaux des seuls congés à quota : la maladie n'y entre pas.
  const totalLeaveRemaining = leaveStats.balances.reduce(
    (total, balance) => total + balance.remaining,
    0,
  );
  const cetLeaveBalances = {
    annual:
      leaveStats.balances.find((balance) => balance.type === "annual")?.remaining || 0,
    rtt:
      leaveStats.balances.find((balance) => balance.type === "rtt")?.remaining || 0,
    fraction:
      leaveStats.balances.find((balance) => balance.type === "fraction")?.remaining || 0,
  };
  const leaveRemainingByType = Object.fromEntries(
    leaveStats.balances.map((balance) => [balance.type, balance.remaining]),
  ) as Partial<Record<BalanceType, number>>;
  const leaveSelectionZeroBalance = requestKind === "leave" && Boolean(
    zeroLeaveBalanceType(selectedList, group, leaveRemainingByType),
  );
  const cetAnnualDaysTaken =
    leaveStats.balances.find((balance) => balance.type === "annual")?.used || 0;
  const cetPlannedLeaveDays = useMemo(() => {
    const dates = new Set<string>();
    for (const period of periods) {
      if (period.leaveType !== "cet") continue;
      for (let date = fromKey(period.from); dateKey(date) <= period.to; date = addDays(date, 1)) {
        const info = getDayInfo(date, period.group || group);
        if (!info.holiday && info.kind !== "off") dates.add(dateKey(date));
      }
    }
    return dates.size;
  }, [periods, group]);
  const balanceDetail = useMemo(() => {
    if (!balanceDetailType) return null;
    if (balanceDetailType !== "annual" && balanceDetailType !== "rtt" &&
      balanceDetailType !== "fraction") {
      const counted = leaveStats.countedOnly[balanceDetailType];
      return {
        title: TYPE_LABELS[balanceDetailType],
        quota: false,
        allowance: 0,
        manualUsed: 0,
        remaining: 0,
        used: counted.used,
        details: counted.details,
      };
    }
    const balance = leaveStats.balances.find(
      (item) => item.type === balanceDetailType,
    );
    return balance
      ? { title: leaveTypeLabel(balance.type), quota: true, ...balance }
      : null;
  }, [balanceDetailType, leaveStats]);
  const recentBalanceDetailDates = useMemo(
    () =>
      new Set(
        (balanceDetail?.details ?? [])
          .map((detail) => detail.date)
          .sort((a, b) => b.localeCompare(a))
          .slice(0, 3),
      ),
    [balanceDetail],
  );
  const balanceDetailPeriods = useMemo(() => {
    const todayKey = dateKey(now);
    const details = balanceDetail?.details ?? [];
    return [
      {
        key: "taken",
        label: "Congés déjà pris",
        details: details
          .filter((detail) => detail.date <= todayKey)
          .sort((a, b) => b.date.localeCompare(a.date)),
      },
      {
        key: "upcoming",
        label: "Congés à venir",
        details: details
          .filter((detail) => detail.date > todayKey)
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
    ].map((period) => ({
      ...period,
      units: period.details.reduce((total, detail) => total + detail.units, 0),
    }));
  }, [balanceDetail, now]);

  const agnesLeaveDates = useMemo(() => {
    const dates = new Set(
      Object.entries(partnerEntries)
        .filter(([, entry]) => entry.agnesLeave)
        .map(([date]) => date),
    );
    for (const period of partnerPeriods)
      for (const date of rangeKeys(period.from, period.to)) dates.add(date);
    return dates;
  }, [partnerEntries, partnerPeriods]);
  const ownNoteAuthorLabel = partnerSharingStatus !== "disabled" || demoMode
    ? "Mika"
    : formProfile?.fullName.trim().split(/\s+/)[0] || "Moi";

  const upcoming = useMemo(() => {
    const todayKey = dateKey(now);
    const lastKey = dateKey(addDays(now, 365));
    const datedEntries = Object.entries(entries).filter(
      ([key]) => key >= todayKey && key <= lastKey,
    );
    const items: NoteListItem[] = [];
    if (showNotes) {
      const seenGroups = new Set<string>();
      for (const [key, entry] of datedEntries) {
        if (
          !entry.noteText ||
          (entry.noteGroupId && seenGroups.has(entry.noteGroupId))
        )
          continue;
        if (entry.noteGroupId) seenGroups.add(entry.noteGroupId);
        const notePeriod = notePeriodFor(entries, key, entry);
        items.push({
          key: `note-${entry.noteGroupId || key}`,
          date: key,
          label: entry.noteText,
          detail: periodLabel(notePeriod.from, notePeriod.to),
          kind: "note",
          color: "#d65e68",
          author: "mika",
        });
      }
      const seenPartnerGroups = new Set<string>();
      for (const [key, entry] of Object.entries(partnerEntries)) {
        if (
          key < todayKey ||
          key > lastKey ||
          entry.noteAuthor !== "agnes" ||
          !entry.noteText ||
          (entry.noteGroupId && seenPartnerGroups.has(entry.noteGroupId))
        ) continue;
        if (entry.noteGroupId) seenPartnerGroups.add(entry.noteGroupId);
        items.push({
          key: `agnes-note-${entry.noteGroupId || key}`,
          date: key,
          label: entry.noteText,
          detail: periodLabel(key, key),
          kind: "note",
          color: "#f2c84b",
          author: "agnes",
        });
      }
    }
    return groupNoteItemsByDate(items
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind),
      )
    );
  }, [entries, now, partnerEntries]);

  const hasAnyNote = useMemo(
    () =>
      Object.values(entries).some((entry) => entry.noteText) ||
      Object.values(partnerEntries).some(
        (entry) => entry.noteAuthor === "agnes" && entry.noteText,
      ),
    [entries, partnerEntries],
  );

  /** Recherche sur toutes les notes enregistrées, passées comme à venir
      (contrairement à `upcoming`, borné aux 365 prochains jours). */
  const noteSearchResults = useMemo(() => {
    const query = noteQuery.trim();
    if (!query) return [];
    const items: NoteListItem[] = [];
    const seenGroups = new Set<string>();
    for (const [key, entry] of Object.entries(entries).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!entry.noteText || !matchesSearch(entry.noteText, query))
        continue;
      if (entry.noteGroupId) {
        if (seenGroups.has(entry.noteGroupId)) continue;
        seenGroups.add(entry.noteGroupId);
      }
      const notePeriod = notePeriodFor(entries, key, entry);
      items.push({
        key: `search-${entry.noteGroupId || key}`,
        date: key,
        label: entry.noteText,
        detail: periodLabel(notePeriod.from, notePeriod.to),
        kind: "note",
        color: "#d65e68",
        author: "mika",
      });
    }
    const seenPartnerGroups = new Set<string>();
    for (const [key, entry] of Object.entries(partnerEntries).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (
        entry.noteAuthor !== "agnes" ||
        !matchesSearch(entry.noteText, query) ||
        (entry.noteGroupId && seenPartnerGroups.has(entry.noteGroupId))
      ) continue;
      if (entry.noteGroupId) seenPartnerGroups.add(entry.noteGroupId);
      items.push({
        key: `search-agnes-${entry.noteGroupId || key}`,
        date: key,
        label: entry.noteText,
        detail: periodLabel(key, key),
        kind: "note",
        color: "#f2c84b",
        author: "agnes",
      });
    }
    return groupNoteItemsByDate(items);
  }, [entries, noteQuery, partnerEntries]);

  const todayOverview = useMemo(() => {
    const key = dateKey(now);
    const info = getDayInfo(now, group);
    const coWorkingGroups = coWorkingGroupsForDate(now, group);
    const coWorkingLabel =
      coWorkingGroups.length === 1
        ? `avec le groupe ${coWorkingGroups[0]}`
        : coWorkingGroups.length > 1
          ? `avec les groupes ${coWorkingGroups.join(" et ")}`
          : "sans autre groupe programmé";
    const period = visibleAbsencePeriod(periods, key);
    const entry = entries[key];
    const todayExchange = workExchangeForDate(entries, key);
    const todayRecoveryMinutes = recoveryUses
      .filter((item) => item.date === key)
      .reduce((total, item) => total + item.minutes, 0);
    const todayExceptionalClosure = exceptionalClosureFor(key);
    const scheduledStatus =
      info.kind === "work"
        ? DAY_LABELS[info.kind]
        : DAY_LABELS[info.kind];
    let status = scheduledStatus;
    let tone: string = info.kind;
    if (todayExceptionalClosure && info.kind === "work") {
      status = "Fermeture exceptionnelle";
      tone = "off";
    } else if (todayExchange) {
      status = entry?.exchangeRole === "given"
        ? `Repos · remplacé par ${todayExchange.partnerName}`
        : `Travail · remplacement de ${todayExchange.partnerName}`;
      tone = "exchange";
    } else if (todayRecoveryMinutes) {
      status =
        todayRecoveryMinutes >= workDayMinutes
          ? `Récupération · ${minutesLabel(todayRecoveryMinutes)}`
          : `${scheduledStatus} + récup. ${minutesLabel(todayRecoveryMinutes)}`;
      tone = "recovery";
    } else if (period && info.kind !== "off") {
      status =
        period.leaveType === "half"
          ? `1/2 journée posée ${period.halfMoment === "afternoon" ? "l’après-midi" : "le matin"}`
        : period.leaveType === "other"
          ? "Divers"
          : period.leaveType === "strike"
            ? "Grève"
          : leaveTypeLabel(period.leaveType || "annual");
      tone = period.leaveType === "recovery" ? "recovery" : "leave";
    } else if (entry?.leave) {
      status = "Divers";
      tone = "leave";
    } else if (info.holiday) {
      status = `${scheduledStatus} · ${info.holiday}`;
    }

    const nextWork = nextAttendanceDay(now, group, (candidateKey) => {
      if (exceptionalClosureFor(candidateKey)) {
        return true;
      }
      return entries[candidateKey]?.exchangeRole === "given" ||
        Boolean(entries[candidateKey]?.leave) ||
        Boolean(
          selections[candidateKey] &&
          selections[candidateKey].type !== "half" &&
          selectionRemovesAttendance(selections[candidateKey].type),
        ) ||
        periods.some(
          (item) =>
            item.leaveType !== "half" &&
            candidateKey >= item.from &&
            candidateKey <= item.to,
        ) ||
        personalPresenceForDate(new Date(`${candidateKey}T12:00:00`), group, periods, entries, recoveryUses, dailyMinutesForQuota(formProfile?.workQuota || "full")).status === "absence";
    }, 366, (candidateKey) => entries[candidateKey]?.exchangeRole === "return");
    const nextWorkKind = nextWork ? getDayInfo(nextWork, group).kind : null;
    const nextWorkExceptionalClosure = nextWork
      ? exceptionalClosureFor(dateKey(nextWork))
      : undefined;
    const nextWorkExchange = nextWork
      ? workExchangeForDate(entries, dateKey(nextWork))
      : null;
    const nextWorkHalfLeave = nextWork
      ? periods.find((item) =>
          item.leaveType === "half" &&
          dateKey(nextWork) >= item.from &&
          dateKey(nextWork) <= item.to,
        )
      : null;
    const nextWorkHalfLeaveLabel = nextWorkHalfLeave
      ? `1/2 journée posée ${nextWorkHalfLeave.halfMoment === "afternoon" ? "l’après-midi" : "le matin"}`
      : "";
    const nextWorkGroups = nextWork
      ? coWorkingGroupsForDate(nextWork, group)
      : [];
    const nextWorkGroupLabel = nextWorkExchange
      ? entries[dateKey(nextWork!)]?.exchangeRole === "return"
        ? `Remplacement de ${nextWorkExchange.partnerName}`
        : `Remplacé par ${nextWorkExchange.partnerName}`
      : nextWorkExceptionalClosure
      ? "Journée normalement prévue au cycle"
      : nextWorkGroups.length === 1
      ? `Avec le groupe ${nextWorkGroups[0]}`
      : nextWorkGroups.length > 1
        ? `Avec les groupes ${nextWorkGroups.join(" et ")}`
        : nextWorkKind === "work"
          ? "Sans autre groupe programmé"
          : "";
    const isTodayOther =
      period?.leaveType === "other" || Boolean(entry?.leave);

    return {
      status: isTodayOther ? "Je ne travaille pas" : status,
      tone,
      todayGroupLabel:
        info.kind === "work" &&
        !todayExceptionalClosure &&
        !todayExchange &&
        (!period || period.leaveType === "half") &&
        !entry?.leave &&
        todayRecoveryMinutes < workDayMinutes
          ? coWorkingLabel.charAt(0).toUpperCase() + coWorkingLabel.slice(1)
          : "",
      nextWork,
      nextWorkKind,
      nextWorkExceptionalClosure: Boolean(nextWorkExceptionalClosure),
      nextWorkGroupLabel,
      nextWorkHalfLeaveLabel,
    };
  }, [now, group, periods, entries, recoveryUses, selections, workDayMinutes, approvedGrandPalaisUpdates]);

  const importantAlert =
    payView.getFullYear() === now.getFullYear() && sundayCarryover
      ? `${sundayCarryover} dimanche${s(sundayCarryover)} en attente${
          sundayCarryoverMonth !== undefined && sundayCarryoverYear !== undefined
            ? ` pour ${MONTHS[sundayCarryoverMonth]} ${sundayCarryoverYear}`
            : " pour un prochain bulletin"
        }`
      : payView.getFullYear() === now.getFullYear() && allowances?.holidayPending
        ? `${allowances.holidayPending} jour${s(allowances.holidayPending)} férié${s(allowances.holidayPending)} à préciser pour la paie`
        : "";

  const showCalendarWorkspace =
    homeSection === "home" ||
    Boolean(requestKind) ||
    rangeSelecting ||
    recoveryRangeSelecting ||
    noteSelecting;

  const {
    openDay,
    beginQuickNote,
    beginNoteDateSelection,
    cancelNoteSelection,
    beginRangeSelection,
    cancelRangeSelection,
    beginMultipleDateSelectionFromDay,
    beginRequest,
    handleDay,
    confirmWarning,
    commitTime,
    goToday,
    startMonthSwipe,
    endMonthSwipe,
    startCalendarCleanup,
    cancelCalendarCleanup,
  } = usePlanningInteractionActions({
    planningUi,
    appShellUi,
    workTimeUi,
    entries,
    group,
    view,
    setView,
    mode,
    workQuota,
    workSchedule: formProfile?.workSchedule || DEFAULT_WORK_SCHEDULE,
    calendarDeleteMode,
    setCalendarDeleteMode,
    setCalendarDeleteDates,
    ignoreNextDayClick,
    cancelRequest,
    saveStrikeDateDirect,
    notify,
    isExchangeDate: (key) => Boolean(entries[key]?.exchangeId),
  });
  function changePayMonth(delta: 1 | -1) {
    setPayView((current) =>
      localDate(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }
  function goPayToday() {
    const today = new Date();
    setPayView(localDate(today.getFullYear(), today.getMonth(), 1));
  }
  function changeWorkQuota(nextQuota: WorkQuota) {
    const previousProfile = formProfile;
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
      signature: formProfile?.signature || "",
      status: formProfile?.status,
      workQuota: nextQuota,
      workSchedule: formProfile?.workSchedule,
      baseSalary: formProfile?.baseSalary,
      residenceAllowance: formProfile?.residenceAllowance,
      ifse: formProfile?.ifse,
      carenceDay: formProfile?.carenceDay,
      otherFixed: formProfile?.otherFixed,
      cia: formProfile?.cia,
      ciaMonth: formProfile?.ciaMonth,
      netRatioFixed: formProfile?.netRatioFixed,
      netRatioVariable: formProfile?.netRatioVariable,
      navigo: formProfile?.navigo,
      mealVoucherDeduction: formProfile?.mealVoucherDeduction,
      pasRate: formProfile?.pasRate,
      manualAdjustments: formProfile?.manualAdjustments,
      cetAccount: formProfile?.cetAccount,
    };
    setFormProfile(nextProfile);
    if (demoMode)
      return;
    void postCalendar({
      action: "save-form-profile",
      fullName: nextProfile.fullName,
      group: nextProfile.group,
      signature: nextProfile.signature,
      workQuota: nextQuota,
    }).catch((error) => {
      setFormProfile(previousProfile);
      notify(
        calendarErrorMessage(error, "La quotité n’a pas pu être enregistrée."),
      );
    });
  }

  async function changeWorkSchedule(nextSchedule: WorkSchedule) {
    const previousProfile = formProfile;
    const nextProfile: FormProfile = {
      ...(formProfile || { fullName: "", group: String(group), signature: "" }),
      workSchedule: nextSchedule,
    };
    setFormProfile(nextProfile);
    if (demoMode) return true;
    try {
      await postCalendar({
        action: "save-form-profile",
        fullName: nextProfile.fullName,
        group: nextProfile.group,
        signature: nextProfile.signature,
        workSchedule: nextSchedule,
      });
      return true;
    } catch (error) {
      setFormProfile(previousProfile);
      notify(calendarErrorMessage(error, "Les horaires habituels n’ont pas pu être enregistrés."));
      return false;
    }
  }

  async function saveCalculationProfile() {
    const saved = await changeWorkSchedule(formProfile?.workSchedule || DEFAULT_WORK_SCHEDULE);
    if (!saved) return;
    setPayProfileOpen(false);
  }

  const {
    saveOvertimeEntry,
    saveSolidarityHours,
    deleteOvertimeEntry,
    saveRecoveryUse,
    beginRecoveryRangeSelection,
    cancelRecoveryRangeSelection,
    saveRecoveryRangeDates,
    deleteRecoveryUse,
    saveMecenatEntry,
    deleteMecenatEntry,
  } = useWorkTimeActions({
    demoMode,
    userEmail,
    group,
    formProfile,
    workQuota,
    recoveryBalanceRemaining: recoveryBalance.remaining,
    setOvertimeEntries,
    setRecoveryUses,
    setMecenatEntries,
    overtimeDraft,
    solidarityDraft,
    setSolidarityDraft,
    recoveryDraft,
    mecenatDraft,
    trainingRecoveryMode,
    recoveryRangeDates,
    setRecoveryRangeDates,
    recoveryRangePrefillDate,
    setRecoveryRangePrefillDate,
    setRecoveryRangeOpen,
    setRecoveryRangeSelecting,
    savingOvertime,
    setSavingOvertime,
    setSavingMecenat,
    setOvertimeDialogOpen,
    setSolidarityDialogOpen,
    setRecoveryDialogOpen,
    setMecenatDialogOpen,
    setHomeSection,
    setMode,
    overtimeSaveInFlightRef,
    mecenatSaveInFlightRef,
    lastOvertimeSubmissionRef,
    lastRecoverySubmissionRef,
    lastMecenatSubmissionRef,
    handoffKey: HANDOFF_KEY,
    notify,
    confirmMessage: confirm,
    post: postCalendar,
    postBatch: postCalendarBatch,
  });
  const {
    editDayLeavePeriod,
    saveDay,
    saveNoteAcrossDates,
    saveSeparateLeaveDates,
    deleteLeavePeriod,
  } = usePlanningEditorActions({
    planningUi,
    entries,
    periods,
    group,
    demoMode,
    setEntries,
    setPeriods,
    reloadCalendar: loadCalendar,
    cancelRangeSelection,
    notify,
    showSuccess: confirm,
    offerUndo,
  });
  const { saveWorkAccident, deleteWorkAccident } = useWorkAccidentActions({
    demoMode,
    group,
    periods,
    setPeriods,
    reloadCalendar: loadCalendar,
    notify,
    showSuccess: confirm,
  });
  function cancelRequest() {
    setRequestKind(null);
    setSickRequest(false);
    setSelections({});
    setWarningDate(null);
    setTimeDate(null);
  }

  function openManualAdjustments() {
    const current =
      formProfile?.manualAdjustments?.[String(absenceYear)] ??
      EMPTY_MANUAL_ADJUSTMENTS;
    setManualAdjustmentDraft(
      Object.fromEntries(
        Object.entries(current).map(([key, value]) => [key, String(value)]),
      ) as Record<keyof ManualYearAdjustments, string>,
    );
    setBalanceDetailType(null);
    setManualAdjustmentsOpen(true);
  }

  async function saveManualAdjustments() {
    const parseDays = (key: keyof ManualYearAdjustments) =>
      Number(manualAdjustmentDraft[key].replace(",", "."));
    const next: ManualYearAdjustments = {
      annualUsed: parseDays("annualUsed"),
      rttUsed: parseDays("rttUsed"),
      fractionUsed: parseDays("fractionUsed"),
      sundayLeaveJanJun: parseDays("sundayLeaveJanJun"),
      sundayLeaveJulSep: parseDays("sundayLeaveJulSep"),
      sundayLeaveOctNov: parseDays("sundayLeaveOctNov"),
      sundayLeaveDec: parseDays("sundayLeaveDec"),
    };
    const leaveValues = [next.annualUsed, next.rttUsed, next.fractionUsed];
    const sundayValues = [
      next.sundayLeaveJanJun,
      next.sundayLeaveJulSep,
      next.sundayLeaveOctNov,
      next.sundayLeaveDec,
    ];
    if (
      leaveValues.some((value) => !Number.isFinite(value) || value < 0 || value * 2 % 1 !== 0) ||
      sundayValues.some((value) => !Number.isInteger(value) || value < 0 || value > 53)
    ) {
      notify("Indiquez des jours entiers ou des demi-journées, et un nombre entier de dimanches.");
      return;
    }
    if (
      next.annualUsed > LEAVE_ALLOWANCES.annual ||
      next.rttUsed > LEAVE_ALLOWANCES.rtt ||
      next.fractionUsed > LEAVE_ALLOWANCES.fraction
    ) {
      notify("Le nombre de jours déjà pris ne peut pas dépasser le droit annuel de la catégorie.");
      return;
    }
    const nextProfile: FormProfile = {
      ...(formProfile || {
        fullName: "",
        group: String(group),
        signature: "",
      }),
      manualAdjustments: {
        ...(formProfile?.manualAdjustments || {}),
        [String(absenceYear)]: next,
      },
    };
    setSavingManualAdjustments(true);
    try {
      if (!demoMode)
        await postCalendar({
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          manualYear: absenceYear,
          manualAnnualUsed: next.annualUsed,
          manualRttUsed: next.rttUsed,
          manualFractionUsed: next.fractionUsed,
          manualSundayLeaveJanJun: next.sundayLeaveJanJun,
          manualSundayLeaveJulSep: next.sundayLeaveJulSep,
          manualSundayLeaveOctNov: next.sundayLeaveOctNov,
          manualSundayLeaveDec: next.sundayLeaveDec,
        });
      setFormProfile(nextProfile);
      setManualAdjustmentsOpen(false);
      confirm(`Le rattrapage ${absenceYear} est enregistré et les calculs sont à jour.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "Le rattrapage n’a pas pu être enregistré."));
    } finally {
      setSavingManualAdjustments(false);
    }
  }

  async function saveCetAccount(nextAccount: CetAccount) {
    if (savingCet) return false;
    const previousProfile = formProfile;
    const nextProfile: FormProfile = {
      ...(formProfile || {
        fullName: "",
        group: String(group),
        signature: "",
      }),
      cetAccount: nextAccount,
    };
    setSavingCet(true);
    try {
      if (!demoMode)
        await postCalendar({
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          cetAccount: nextAccount,
        });
      setFormProfile(nextProfile);
      return true;
    } catch (error) {
      setFormProfile(previousProfile);
      notify(calendarErrorMessage(error, "Le CET n’a pas pu être enregistré."));
      return false;
    } finally {
      setSavingCet(false);
    }
  }
  function slideAllowancesMonth(delta: 1 | -1) {
    if (
      payMonthSlide ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      changePayMonth(delta);
      return;
    }
    if (payMonthSlideTimer.current)
      window.clearTimeout(payMonthSlideTimer.current);
    setPayMonthSlide(delta > 0 ? "out-left" : "out-right");
    payMonthSlideTimer.current = window.setTimeout(() => {
      changePayMonth(delta);
      setPayMonthSlide(delta > 0 ? "in-right" : "in-left");
      payMonthSlideTimer.current = window.setTimeout(() => {
        setPayMonthSlide("");
        payMonthSlideTimer.current = null;
      }, 190);
    }, 150);
  }
  function startAllowancesSwipe(event: React.TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    allowancesSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function endAllowancesSwipe(event: React.TouchEvent<HTMLElement>) {
    if (!allowancesSwipeStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - allowancesSwipeStart.current.x;
    const deltaY = touch.clientY - allowancesSwipeStart.current.y;
    allowancesSwipeStart.current = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25)
      return;
    slideAllowancesMonth(deltaX < 0 ? 1 : -1);
  }
  const {
    validateAndOpenForm,
    saveRequestToPlanning,
  } = usePlanningRequestActions({
    planningUi,
    selectedList,
    formProfile,
    cetPlannedLeaveDays,
    group,
    demoMode,
    userEmail,
    workQuota,
    recoveryBalanceRemaining: recoveryBalance.remaining,
    leaveRemaining: leaveRemainingByType,
    periods,
    recoveryUses,
    setPeriods,
    setRecoveryUses,
    reloadCalendar: loadCalendar,
    cancelRequest,
    notify,
    showSuccess: confirm,
    handoffKey: HANDOFF_KEY,
  });

  function renderDay(date: Date, compact = false) {
    const key = dateKey(date);
    const partnerEntry = partnerEntries[key];
    const schoolVacation = mode === "month"
      ? visibleSchoolVacations.find(({ from, to }) => key >= from && key <= to)
      : undefined;
    const inPendingRange = Boolean(
      (rangeSelecting && separateDates.includes(key)) ||
        (recoveryRangeSelecting && recoveryRangeDates.includes(key)) ||
        (noteSelecting && noteDates.includes(key)),
    );
    return (
      <PlanningDayCell
        key={key}
        date={date}
        group={group}
        compact={compact}
        entry={entries[key]}
        selected={selections[key]}
        cleanupSelected={calendarDeleteMode && calendarDeleteDates.includes(key)}
        today={sameDate(date, now)}
        recoveryEntries={recoveryUses.filter((item) => item.date === key)}
        leavePeriod={visibleAbsencePeriod(periods, key)}
        showLeaves={showLeaves}
        showNotes={showNotes}
        inPendingRange={inPendingRange}
        rangeSelecting={rangeSelecting}
        recoveryRangeSelecting={recoveryRangeSelecting}
        noteSelecting={noteSelecting}
        noteColor={noteColor}
        exceptionalClosure={exceptionalClosureFor(key)}
        exchange={workExchangeForDate(entries, key)}
        workAccident={periods.some((period) => period.leaveType === "work_accident" && key >= period.from && key <= period.to)}
        agnesLeave={agnesLeaveDates.has(key)}
        sharedNoteText={partnerEntry?.noteAuthor === "agnes" ? partnerEntry.noteText : ""}
        schoolVacation={schoolVacation}
        onClick={() => handleDay(date)}
      />
    );
  }
  async function deleteAgnesNote(date: string) {
      const partnerEntry = partnerEntries[date];
      if (!partnerEntry?.noteText) return;
      const groupedDates = partnerEntry.noteGroupId
        ? Object.entries(partnerEntries)
            .filter(([, entry]) => entry.noteGroupId === partnerEntry.noteGroupId && Boolean(entry.noteText))
            .map(([key]) => key)
        : [date];
      const periodLabel = groupedDates.length > 1 ? " sur toute sa période" : "";
      if (!window.confirm(
        `Supprimer la note d’Agnès du ${noteDateLabel(date)}${periodLabel} ?`,
      )) return;
      try {
        if (!demoMode) {
          await postCalendar({
            action: "delete-shared-partner-note",
            date,
            groupId: partnerEntry.noteGroupId || undefined,
          });
          await loadCalendar();
        } else {
          setPartnerEntries((current) => {
            const next = { ...current };
            for (const key of groupedDates) {
              const entry = next[key];
              if (!entry) continue;
              next[key] = { ...entry, noteText: "", noteGroupId: "" };
            }
            return next;
          });
        }
      } catch (error) {
        notify(calendarErrorMessage(error, "La note d’Agnès n’a pas pu être supprimée."));
      }
  }
  function renderNoteItems(items: NoteListItem[]) {
    const [leftItems, rightItems] = splitNoteItemsIntoColumns(items);
    const renderItem = (item: NoteListItem) => {
      const hasOwnNote = item.author === "mika" || item.notes?.some((note) => note.author === "mika");
      const ownEntry = hasOwnNote ? entries[item.date] : undefined;
      const noteDates = ownEntry?.noteGroupId
        ? Object.entries(entries)
            .filter(([, entry]) => entry.noteGroupId === ownEntry.noteGroupId && Boolean(entry.noteText))
            .map(([date]) => date)
        : hasOwnNote ? [item.date] : [];
      return (
      <article
        className={`upcoming-item ${item.kind}`}
        key={item.key}
        style={
          item.color
            ? ({ "--item-color": item.color } as React.CSSProperties)
            : undefined
        }
      >
        <button
          type="button"
          className="upcoming-item-open"
          onClick={() => {
            const date = fromKey(item.date);
            setView(localDate(date.getFullYear(), date.getMonth(), 1));
            setMode("month");
            openDay(date);
          }}
        >
          {!item.notes ? <i /> : null}
          <span>
          {item.kind === "note" ? (
            <small className="note-date-badge">{noteDateLabel(item.date)}</small>
          ) : null}
          {item.notes ? (
            <span className="shared-note-stack">
              {item.notes.map((note) => (
                <span
                  className={`shared-note-part note-author-${note.author}`}
                  key={`${item.key}-${note.author}`}
                >
                  <b>{note.author === "mika" ? ownNoteAuthorLabel : "Agnès"}</b>
                  <strong>{note.label}</strong>
                </span>
              ))}
            </span>
          ) : item.label.includes("\n") ? (
            <ul className="note-bullets">
              {keyedNoteLines(item.label).map(({ key, label }) => (
                <li key={`${item.key}-${key}`}>{label}</li>
              ))}
            </ul>
          ) : (
            <strong>{item.label}</strong>
          )}
          {item.kind !== "note" ? <small>{item.detail}</small> : null}
          </span>
        </button>
        {item.notes?.map((note, index) => {
          if (note.author === "mika" && !noteDates.length) return null;
          return (
            <button
              key={`${item.key}-delete-${note.author}`}
              className="note-delete-button"
              type="button"
              aria-label={`Supprimer ${note.author === "mika" ? `la note de ${ownNoteAuthorLabel}` : "la note d’Agnès"} du ${noteDateLabel(item.date)}`}
              title={`Supprimer ${note.author === "mika" ? `la note de ${ownNoteAuthorLabel}` : "la note d’Agnès"}`}
              style={item.notes!.length > 1 ? { top: index === 0 ? "33%" : "67%" } : undefined}
              onClick={() => note.author === "mika"
                ? void deleteMultiplePlanningDates(noteDates, "notes")
                : void deleteAgnesNote(item.date)}
            >
              ×
            </button>
          );
        })}
      </article>
      );
    };
    return (
      <div className={`upcoming-list note-column-layout${rightItems.length ? "" : " single"}`}>
        <div className="upcoming-note-column">{leftItems.map(renderItem)}</div>
        {rightItems.length ? <div className="upcoming-note-column">{rightItems.map(renderItem)}</div> : null}
      </div>
    );
  }

  const {
    savePayAmount,
    saveAnnualPayProfile,
    saveCiaMonth,
    nextSundayPayoutSlot,
    reportMissingSundays,
    clearSundayCarryover,
    chooseHolidayPay,
    importPayslips,
    applyPayslipFallbackPeriod,
    grossForMonth,
  } = usePayActions({
    demoMode,
    group,
    payView,
    setPayView,
    formProfile,
    setFormProfile,
    payProfiles,
    setPayProfiles,
    payDrafts,
    setPayDrafts,
    setSavingPay,
    sundayCarryoverYear,
    sundayCarryoverMonth,
    sundayCarryoverFromYear,
    sundayCarryoverFromMonth,
    entries,
    setEntries,
    isContractuel,
    allowances,
    payslipCheck,
    setPayslipCheck,
    payslipFallbackMonth,
    payslipFallbackYear,
    setPayslipFallbackMonth,
    setPayslipFallbackYear,
    payslipRateSamples,
    setPayslipRateSamples,
    setPayslipImportMode,
    setPayslipImportError,
    setPayslipImportResult,
    setPayslipError,
    setPayslipNeedsPeriod,
    setPayslipImportBusy,
    setPayslipResultDetailsOpen,
    baseSalary,
    ifse,
    otherFixed,
    cia,
    ciaMonth,
    sickLeaves,
    paidOvertimeForPayPeriod,
    mecenatEntries,
    periods,
    recoveryUses,
    notify,
    post: postCalendar,
  });

  function openRequestChooser(
    _origin: "general" | "planning" = "general",
    initialDate?: string,
  ) {
    setRequestChooserDate(initialDate || null);
    setRequestChooser(true);
  }

  function beginChosenRequest(kind: RequestKind, requestedType: SelectionType) {
    const initialDate = requestChooserDate || undefined;
    setRequestChooserDate(null);
    beginRequest(kind, initialDate, requestedType);
  }

  function openPlanningRequestMethod(
    kind: RequestKind,
    date?: string,
    requestedType?: SelectionType,
  ) {
    setDayDate(null);
    beginRequest(
      kind,
      date,
      requestedType ||
        (kind === "recovery"
          ? "recovery_day"
          : kind === "other"
            ? "other"
            : kind === "strike"
              ? "strike"
              : "annual"),
    );
  }

  /** Le volet de vérification d'un bulletin, séparé des primes : on y va pour
   *  contrôler, pas pour consulter. */
  function renderPayContent() {
    if (!allowances || !monthPay || !sickLeaves) return null;
    const missing = netEstimateMissing.length > 0;
    const showPayslipHelp = payslipHelpOpen;
    /* Seules les primes qui varient d'un mois à l'autre sont détaillées : le
       traitement, l'IFSE et les éléments fixes se retrouvent dans le brut sans
       qu'il soit utile de les répéter chaque mois. */
    const monthPayRows = [
      monthPay.sundayCount || monthPay.reported
        ? {
            key: "sundays",
            label: `Dimanches (${monthPay.sundayCount})`,
            detail: monthPay.carryover
              ? `dont ${monthPay.carryover} reporté${s(monthPay.carryover)} du bulletin précédent`
              : monthPay.reported
                ? `${monthPay.reported} pas encore payé${s(monthPay.reported)}, en attente sur un prochain bulletin`
                : `${monthPay.sundayCount} × ${euros(SUNDAY_ALLOWANCE.perSunday)}`,
            amount: monthPay.sunday,
          }
        : null,
      monthPay.holidayCount
        ? {
            key: "holidays",
            label: `Jours fériés (${monthPay.holidayCount})`,
            detail: monthPay.holiday
              ? "travaillés le mois précédent"
              : "compensation à décider",
            amount: monthPay.holiday,
          }
        : null,
      monthPay.compensatedCount
        ? {
            key: "compensated",
            label: `Fériés compensés (${monthPay.compensatedCount})`,
            detail: monthPay.compensated
              ? `non travaillés en ${allowances.compensatedYear}`
              : `non travaillés en ${allowances.compensatedYear}, compensation à décider`,
            amount: monthPay.compensated,
          }
        : null,
      monthPay.cia
        ? {
            key: "cia",
            label: "CIA",
            detail: "complément indemnitaire annuel",
            amount: monthPay.cia,
          }
        : null,
      overtimeForPayMonth.totalMinutes
        ? {
            key: "overtime",
            label: `Heures supplémentaires (${minutesLabel(
              overtimeForPayMonth.totalMinutes,
            )})`,
            detail: overtimeForPayMonth.ready
              ? `effectuées en ${MONTHS[overtimeForPayMonth.performedMonth]} · base ${euros(
                  overtimeForPayMonth.hourlyBase,
                )}/h${workQuota === "full" ? " · majorations appliquées" : " · règle temps partiel"}`
              : "traitement de base à compléter pour calculer le montant",
            amount: overtimeForPayMonth.ready
              ? overtimeForPayMonth.amount
              : null,
          }
        : null,
      mecenatForCurrentPayMonth.lines.length
        ? {
            key: "mecenat",
            label: `Mécénats (${mecenatForCurrentPayMonth.lines.length})`,
            detail: `${minutesLabel(mecenatForCurrentPayMonth.totalMinutes)} · tarifs réglementaires fixes`,
            amount: mecenatForCurrentPayMonth.grossAmountCents / 100,
          }
        : null,
      monthPay.sickDays
        ? {
            key: "sick",
            label: `Arrêt maladie (${monthPay.sickDays} j)`,
            detail: "carence et retenue de 10 %",
            amount: -monthPay.sick,
          }
        : null,
      monthPay.strikeDeductedDays || monthPay.strikePotentialDays
        ? {
            key: "strike",
            label: `Grève (${monthPay.strikeDeductedDays} journée${s(monthPay.strikeDeductedDays)} retenue${s(monthPay.strikeDeductedDays)})`,
            detail:
              strikeForCurrentPayMonth.dailyDeduction === null
                  ? "traitement et indemnité de résidence antérieurs à compléter"
                  : strikeForCurrentPayMonth.potentialAdditionalDays.length
                    ? `Attention : ${strikeForCurrentPayMonth.potentialAdditionalDays.length} jour${s(strikeForCurrentPayMonth.potentialAdditionalDays.length)} intermédiaire${s(strikeForCurrentPayMonth.potentialAdditionalDays.length)} à vérifier. Les repos noirs encadrés sont inclus automatiquement ; les autres absences restent hors retenue tant qu’elles ne sont pas confirmées. ${strikeForCurrentPayMonth.exactMonthValues ? "Valeurs exactes du mois." : strikeForCurrentPayMonth.sourcePeriod ? `Dernières valeurs connues : ${strikeForCurrentPayMonth.sourcePeriod}.` : ""}`
                    : `retenue au 1/30 · ${euros(strikeForCurrentPayMonth.dailyDeduction)} brut par jour${strikeForCurrentPayMonth.automaticAdditionalDays.length ? ` · ${strikeForCurrentPayMonth.automaticAdditionalDays.length} repos noir${s(strikeForCurrentPayMonth.automaticAdditionalDays.length)} encadré${s(strikeForCurrentPayMonth.automaticAdditionalDays.length)} inclus` : ""} · ${strikeForCurrentPayMonth.exactMonthValues ? "valeurs exactes du mois" : "dernières valeurs antérieures connues"}`,
            amount:
              strikeForCurrentPayMonth.totalDeduction !== null
                ? -strikeForCurrentPayMonth.totalDeduction
                : null,
          }
        : null,
      // Jamais prélevés en décembre (confirmé sur les bulletins de 2024 et
      // 2025) : signalé ici comme les autres lignes qui varient d'un mois
      // sur l'autre, plutôt que de laisser deviner pourquoi le net grimpe.
      monthPay.index === 11 && mealVoucherDeduction
        ? {
            key: "mealVoucher",
            label: "Titres repas",
            detail: "jamais prélevés en décembre",
            amount: mealVoucherDeduction,
          }
        : null,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row));
    const comparablePayslip =
      payslipCheck?.reading.month !== undefined &&
      payslipCheck.reading.year === allowances.year &&
      payslipCheck.reading.month === payView.getMonth();
    const payslipMonth = comparablePayslip
      ? (payslipCheck.reading.month as number)
      : payView.getMonth();
    const unplannedPayslipCarence = comparablePayslip && isUnplannedPayslipCarence(
      payslipCheck.reading.carenceDay,
      sickLeaves.byMonth[payslipMonth]?.days || 0,
    );
    const payslipExpectedSundays = comparablePayslip
      ? allowances.monthly.find(
          (slot) => slot.index === payslipMonth,
        )?.sundayCount || 0
      : 0;
    const payslipReview = comparablePayslip
      ? summarizePayslipReview([
          {
            key: "gross",
            label: "Cumul brut",
            found: payslipCheck.reading.gross,
            expected: grossForMonth(payslipMonth),
          },
          ...(netCalculation?.netBeforeTax !== undefined
            ? [{
                key: "net-before-tax",
                label: "Net avant impôt",
                found: payslipCheck.reading.netBeforeTax,
                expected: netCalculation.netBeforeTax,
                tolerance: 0.5,
              }]
            : []),
          {
            key: "base",
            label: "Traitement de base",
            found: payslipCheck.reading.baseSalary,
            expected: baseSalary,
          },
          ...(residenceAllowance !== undefined
            ? [{
                key: "residence",
                label: "Indemnité de résidence",
                found: payslipCheck.reading.residenceAllowance,
                expected: residenceAllowance,
              }]
            : []),
          ...(!isContractuel
            ? [
                {
                  key: "ifse",
                  label: "IFSE",
                  found: payslipCheck.reading.ifse,
                  expected: ifse,
                },
              ]
            : []),
          ...(otherFixed || payslipCheck.reading.otherFixed !== undefined
            ? [{
                key: "other-fixed",
                label: "Autres éléments fixes",
                found: payslipCheck.reading.otherFixed,
                expected: otherFixed,
              }]
            : []),
          ...(monthPay.cia || payslipCheck.reading.cia !== undefined
            ? [{
                key: "cia",
                label: "CIA",
                found: payslipCheck.reading.cia,
                expected: monthPay.cia,
              }]
            : []),
          ...(navigo || payslipCheck.reading.navigo !== undefined
            ? [{
                key: "navigo",
                label: "Remboursement Navigo",
                found: payslipCheck.reading.navigo,
                expected: navigo,
              }]
            : []),
          ...((netCalculation?.mealVouchers || 0) || payslipCheck.reading.mealVoucherDeduction !== undefined
            ? [{
                key: "meal-vouchers",
                label: "Titres repas",
                found: payslipCheck.reading.mealVoucherDeduction,
                expected: netCalculation?.mealVouchers || 0,
              }]
            : []),
          ...(pasRate || payslipCheck.reading.pasRate !== undefined
            ? [{
                key: "pas-rate",
                label: "Taux d’imposition (PAS)",
                found: payslipCheck.reading.pasRate,
                expected: pasRate,
                tolerance: 0.01,
              }]
            : []),
          {
            key: "sundays",
            label: "Dimanches payés",
            found: payslipCheck.reading.sundaysBeyondTen,
            expected: payslipExpectedSundays,
            tolerance: 1,
          },
          ...(unplannedPayslipCarence
            ? [
                {
                  key: "carence",
                  label: "Jour de carence non prévu",
                  found: payslipCheck.reading.carenceDay,
                  expected: 0,
                },
              ]
            : []),
          ...(overtimeForPayMonth.totalMinutes
            ? [
                {
                  key: "overtime",
                  label: "Heures supplémentaires",
                  found: undefined,
                  expected: overtimeForPayMonth.amount,
                },
              ]
            : []),
          ...(mecenatForCurrentPayMonth.totalMinutes
            ? [
                {
                  key: "mecenat",
                  label: "Mécénats",
                  found: undefined,
                  expected:
                    mecenatForCurrentPayMonth.grossAmountCents / 100,
                },
              ]
            : []),
        ])
      : null;
    const payReliability = !grossEstimateComplete
      ? {
          tone: "incomplete" as const,
          label: "Données à compléter",
          detail: "Certaines valeurs nécessaires au calcul de la paie sont encore manquantes.",
        }
      : payslipReview?.tone === "ok"
        ? {
            tone: "exact" as const,
            label: "Valeurs vérifiées avec le bulletin",
            detail: `Les lignes lisibles du bulletin de ${MONTHS[monthPay.index]} ${allowances.year} correspondent à l’estimation.`,
          }
        : payslipReview?.tone === "partial"
          ? {
              tone: "estimated" as const,
              label: "Vérification partielle",
              detail: `${payslipReview.verified.length} ligne${s(payslipReview.verified.length)} vérifiée${s(payslipReview.verified.length)} ; des lignes restent non comparables et le net estimé n’est donc pas présenté comme confirmé.`,
            }
        : payProfiles[payYear]
          ? {
              tone: "estimated" as const,
              label: "Valeurs enregistrées pour cette année",
              detail: `Estimation calculée avec le profil de paie ${payYear}.`,
            }
          : {
              tone: "estimated" as const,
              label: "Estimation avec les dernières valeurs connues",
              detail: "Le montant sera recalculé lorsqu’un bulletin plus récent sera renseigné.",
            };

    const otherFixedWithoutResidence =
      residenceAllowance === undefined ? otherFixed : otherFixed - residenceAllowance;
    const grossDeductionRows = monthPayRows
      .filter((row) => row.key === "sick" || row.key === "strike")
      .map((row) => ({
        ...row,
        amount: row.amount === null ? null : Math.abs(row.amount),
      }));
    const payCalculation: PayCalculationBreakdown = {
      grossComposition: [
        {
          key: "base",
          label: isContractuel ? "Traitement de base" : "Traitement indiciaire",
          detail: "montant mensuel enregistré",
          amount: hasPayValue("baseSalary") ? baseSalary : null,
        },
        residenceAllowance !== undefined
          ? {
              key: "residence",
              label: "Indemnité de résidence",
              detail: isContractuel && !hasPayValue("residenceAllowance")
                ? "3 % du traitement de base"
                : "valeur enregistrée",
              amount: residenceAllowance,
            }
          : null,
        !isContractuel && (ifse || hasPayValue("ifse"))
          ? { key: "ifse", label: "IFSE", detail: "indemnité mensuelle", amount: ifse }
          : null,
        otherFixedWithoutResidence
          ? {
              key: "other-fixed",
              label: "Autres éléments fixes",
              detail: residenceAllowance === undefined ? "total enregistré" : "hors indemnité de résidence",
              amount: otherFixedWithoutResidence,
            }
          : null,
        {
          key: "sunday-flat",
          label: "Forfait mensuel de dimanches",
          detail: "montant fixe déjà inclus dans l’estimation",
          amount: SUNDAY_ALLOWANCE.monthlyFlat,
        },
        monthPay.cia
          ? { key: "cia", label: "CIA", detail: "complément indemnitaire annuel", amount: monthPay.cia }
          : null,
        monthPay.sundayCount
          ? { key: "sundays", label: `Dimanches (${monthPay.sundayCount})`, detail: monthPay.carryover ? `dont ${monthPay.carryover} reporté${s(monthPay.carryover)}` : "prime calculée", amount: monthPay.sunday }
          : null,
        monthPay.holidayCount
          ? { key: "holidays", label: `Jours fériés (${monthPay.holidayCount})`, detail: monthPay.holiday ? "compensation choisie" : "compensation à décider", amount: monthPay.holiday || null }
          : null,
        monthPay.compensatedCount
          ? { key: "compensated", label: `Fériés compensés (${monthPay.compensatedCount})`, detail: monthPay.compensated ? "compensation choisie" : "compensation à décider", amount: monthPay.compensated || null }
          : null,
        overtimeForPayMonth.totalMinutes
          ? { key: "overtime", label: "Heures supplémentaires payées", detail: minutesLabel(overtimeForPayMonth.totalMinutes), amount: overtimeForPayMonth.ready ? overtimeForPayMonth.amount : null }
          : null,
        mecenatForCurrentPayMonth.lines.length
          ? { key: "mecenat", label: "Mécénats", detail: minutesLabel(mecenatForCurrentPayMonth.totalMinutes), amount: mecenatForCurrentPayMonth.grossAmountCents / 100 }
          : null,
      ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
      grossDeductions: grossDeductionRows,
      grossBeforeDeductions: monthPay.gross + monthPay.sick + monthPay.strike,
      variableAdditions: monthPay.grossVariable,
      netRatioFixed,
      netRatioVariable,
      estimatedContributions: netCalculation?.estimatedContributions ?? null,
      navigo,
      mealVoucherDeduction: netCalculation?.mealVouchers ?? 0,
      netBeforeTax: netCalculation?.netBeforeTax ?? null,
      pasRate,
      incomeTax: netCalculation?.incomeTax ?? null,
      totalDeductions: netCalculation
        ? monthPay.sick + monthPay.strike + netCalculation.estimatedContributions + netCalculation.mealVouchers + netCalculation.incomeTax
        : null,
    };

    const payEstimateDetails = (
      <Suspense fallback={<DeferredSection label="la paie" />}>
      <PayEstimateDetails
        monthIndex={monthPay.index}
        year={allowances.year}
        gross={monthPay.gross}
        grossEstimateComplete={grossEstimateComplete}
        net={monthNet}
        calculation={payCalculation}
        overtime={overtimeForPayMonth}
        workQuota={workQuota}
        mecenat={mecenatForCurrentPayMonth}
        reliability={payReliability}
        onPreviousMonth={() => changePayMonth(-1)}
        onNextMonth={() => changePayMonth(1)}
        onToday={goPayToday}
      />
      </Suspense>
    );
    const payslipSectionProps: Omit<PayslipCheckSectionProps, "part"> = {
      accountId: demoMode ? "demo" : userEmail,
      payYear,
      hasPayProfile: Boolean(payProfiles[payYear]),
      helpOpen: showPayslipHelp,
      setHelpOpen: setPayslipHelpOpen,
      missing,
      isContractuel,
      importBusy: payslipImportBusy,
      importMode: payslipImportMode,
      importError: payslipImportError,
      importResult: payslipImportResult,
      onImport: (files, importMode) => void importPayslips(files, importMode),
      check: payslipCheck,
      checkError: payslipError,
      needsPeriod: payslipNeedsPeriod,
      fallbackMonth: payslipFallbackMonth,
      setFallbackMonth: setPayslipFallbackMonth,
      fallbackYear: payslipFallbackYear,
      setFallbackYear: setPayslipFallbackYear,
      onApplyFallbackPeriod: applyPayslipFallbackPeriod,
      allowances,
      displayedMonth: payView.getMonth(),
      review: payslipReview,
      unplannedCarence: unplannedPayslipCarence,
      resultDetailsOpen: payslipResultDetailsOpen,
      setResultDetailsOpen: setPayslipResultDetailsOpen,
      grossForMonth,
      baseSalary,
      ifse,
      overtime: overtimeForPayMonth,
      mecenat: mecenatForCurrentPayMonth,
      onReportMissingSundays: (year, month, missingSundays) =>
        void reportMissingSundays(year, month, missingSundays),
      nextSundayPayout: nextSundayPayoutSlot,
      sundayCarryover,
      sundayCarryoverMonth,
      sundayCarryoverYear,
      onClearSundayCarryover: () => void clearSundayCarryover(),
      rateSamples: payslipRateSamples,
      rateCalibration: payslipRateCalibration,
      sickLeaves,
      paySettingsOpen,
      setPaySettingsOpen,
      missingFields: netEstimateMissing,
      carenceDay,
      otherFixed,
      cia,
      netRatioFixed,
      netRatioVariable,
      navigo,
      mealVoucherDeduction,
      pasRate,
      payDrafts,
      setPayDrafts,
      savingPay,
      onSavePayAmount: (field) => void savePayAmount(field),
      onCreatePayProfile: () => saveAnnualPayProfile({
        baseSalary,
        residenceAllowance,
        ifse,
        carenceDay,
        otherFixed,
        cia,
        ciaMonth,
        netRatioFixed,
        netRatioVariable,
        netRatioRegime: viewedPayRegime,
        navigo,
        mealVoucherDeduction,
        pasRate,
      }),
      ciaMonth,
      onSaveCiaMonth: (month) => void saveCiaMonth(month),
    };

    const variables: PayDashboardVariable[] = monthPayRows.map((row) => ({
      key: row.key,
      label: row.label,
      quantity: row.detail,
      amount: row.amount,
    }));

    return {
      gross: monthPay.gross,
      grossComplete: grossEstimateComplete,
      net: monthNet,
      profileLabel: payProfiles[payYear]
        ? `Estimation réalisée avec votre profil de paie ${payYear}.`
        : "Estimation réalisée avec les dernières valeurs connues.",
      reliability: payReliability,
      variables,
      estimateContent: payEstimateDetails,
      verificationContent: <PayslipCheckSection {...payslipSectionProps} part="verification" />,
      settingsContent: <PayslipCheckSection {...payslipSectionProps} part="settings" />,
    };
  }
  const allowancesContent = allowances ? (
    <PayAllowancesSection
      allowances={allowances}
      monthPay={monthPay}
      overtimeForPayMonth={overtimeForPayMonth}
      mecenatForPayMonth={mecenatForCurrentPayMonth}
      strikeForPayMonth={strikeForCurrentPayMonth}
      isContractuel={isContractuel}
      baseSalary={baseSalary}
      month={payView.getMonth()}
      year={payView.getFullYear()}
      payPeriodOpen={payPeriodOpen}
      holidayChoiceEditing={holidayChoiceEditing}
      onTogglePayPeriod={() => setPayPeriodOpen((current) => !current)}
      onChangeMonth={changePayMonth}
      onGoToday={goPayToday}
      onEditHolidayChoice={setHolidayChoiceEditing}
      onChooseHolidayPay={chooseHolidayPay}
    />
  ) : null;
  const payContent = homeSection === "pay" ? renderPayContent() : null;
  // Le titre d'un mois de la vue Année l'ouvre en grand. On bascule sur la
  // vue Mois plutôt que d'agrandir sur place : c'est elle qui porte la barre
  // d'outils, donc « Poser un congé » et le reste restent accessibles.
  function openMonthFromYear(month: number) {
    setView(localDate(view.getFullYear(), month, 1));
    setMode("month");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startSectionSwipe(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "input, textarea, select, [role='dialog'], .modal-backdrop, .main-menu-backdrop, .main-menu-drawer, .choice-picker-menu, .month-card, .pay-dashboard-motion, .pay-dedicated-content, .pay-detail-sticky-header, .variable-pay-heading-actions",
      )
    ) {
      sectionSwipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    sectionSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function navigateFromShell(section: MainSection, record = true) {
    if (section === homeSection) return;
    if (record) history.pushState({ ...(history.state || {}), planningSection: section }, "", location.href);
    setHomeSection(section);
    if (section === "pay") setPayScreen("overview");
    setMainMenuOpen(false);
    setAccountMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    if (!MAIN_SECTION_ORDER.includes(history.state?.planningSection))
      history.replaceState({ ...(history.state || {}), planningSection: homeSection }, "", location.href);
    const onPopState = (event: PopStateEvent) => {
      if (mainMenuOpen) { setMainMenuOpen(false); return; }
      if (accountMenuOpen) { setAccountMenuOpen(false); return; }
      if (feedbackOpen) { setFeedbackOpen(false); return; }
      const section = event.state?.planningSection;
      if (MAIN_SECTION_ORDER.includes(section)) navigateFromShell(section, false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [accountMenuOpen, feedbackOpen, homeSection, mainMenuOpen]);

  function finishSectionSwipe(event: TouchEvent<HTMLElement>) {
    const start = sectionSwipeStartRef.current;
    sectionSwipeStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;

    const currentIndex = MAIN_SECTION_ORDER.indexOf(homeSection === "forms" ? "pdf" : homeSection);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextSection = MAIN_SECTION_ORDER[nextIndex];
    if (!nextSection) return;

    navigateFromShell(nextSection);
  }

  const dayStoredPeriods = dayDate
    ? periods.filter((period) => dayDate >= period.from && dayDate <= period.to)
    : [];
  const dayRecoveryUses = dayDate
    ? recoveryUses.filter((entry) => entry.date === dayDate)
    : [];
  const dayExceptionalClosure = dayDate
    ? exceptionalClosureFor(dayDate)
    : undefined;
  const dayExchange = dayDate ? workExchangeForDate(entries, dayDate) : null;

  if (publicDemoAccess.expired) {
    return (
      <main className="auth-shell">
        <img
          src="/grand-palais-verriere-fast.webp"
          alt=""
          className="auth-shell-image"
          decoding="async"
          fetchPriority="high"
        />
        <section className="auth-card">
          <div className="auth-mark" aria-hidden="true"><span>31</span></div>
          <p className="eyebrow">Planning Solo</p>
          <h1>Essai terminé</h1>
          <p className="auth-intro">
            Ce lien de démonstration a expiré le 15 septembre 2026.
          </p>
        </section>
      </main>
    );
  }

  if (authStatus !== "ready") {
    return (
      <AuthScreen
        status={authStatus}
        email={loginEmail}
        password={loginPassword}
        passwordConfirmation={passwordConfirmation}
        busy={authBusy}
        error={authError}
        notice={authNotice}
        setEmail={setLoginEmail}
        setPassword={setLoginPassword}
        setPasswordConfirmation={setPasswordConfirmation}
        submitLogin={submitLogin}
        submitInvite={submitInvite}
        submitPasswordReset={submitPasswordReset}
        requestPasswordReset={() => void requestPasswordReset()}
      />
    );
  }

  return (
    <main
      className="app-shell"
      onTouchStart={startSectionSwipe}
      onTouchEnd={finishSectionSwipe}
    >
      {previewPayEffect === "money" ? (
        <PayslipSuccessCelebration durationMs={15_000} />
      ) : null}
      <AppHeader
        onOpenAdminTools={isProgramAdmin ? () => { setAccountMenuOpen(false); setAdminToolsOpen(true); } : undefined}
        homeSection={homeSection}
        payScreen={payScreen}
        userEmail={userEmail}
        fullName={formProfile?.fullName || ""}
        accountMenuOpen={accountMenuOpen}
        mainMenuOpen={mainMenuOpen}
        checkingAppUpdate={checkingAppUpdate}
        appUpdateAvailable={appUpdateAvailable}
        demoMode={demoMode}
        unreadFeedbackCount={isProgramAdmin ? feedbackMessaging.unreadCount : 0}
        notify={notify}
        accountMenuRef={accountMenuRef}
        accountButtonRef={accountButtonRef}
        onToggleAccount={() => setAccountMenuOpen((current) => !current)}
        onDisconnect={() => {
          setAccountMenuOpen(false);
          void disconnect();
        }}
        onOpenMainMenu={() => {
          history.pushState({ ...(history.state || {}), planningSection: homeSection, planningOverlay: "menu" }, "", location.href);
          setMainMenuOpen(true);
        }}
        onCheckForUpdate={() => void checkForAppUpdate()}
      />
      <AdaptiveNavigation
        homeSection={homeSection}
        onNavigate={(section) => navigateFromShell(section)}
        onMore={() => {
          history.pushState({ ...(history.state || {}), planningSection: homeSection, planningOverlay: "menu" }, "", location.href);
          setMainMenuOpen(true);
        }}
        unreadFeedbackCount={isProgramAdmin ? feedbackMessaging.unreadCount : 0}
      />
      {/* Placé après la navigation : la marche à suivre s'affiche quelle que
          soit la rubrique ouverte au lancement. */}
      <AppleInstallNotice enabled={installationEnabled} />
      <MainMenu
        open={mainMenuOpen}
        userEmail={userEmail}
        fullName={formProfile?.fullName || ""}
        checkingAppUpdate={checkingAppUpdate}
        appUpdateAvailable={appUpdateAvailable}
        online={connectionStatus.online}
        syncStatus={connectionStatus.syncStatus}
        lastSavedAt={connectionStatus.lastSavedAt}
        showInstallAction={demoMode || Boolean(installPrompt)}
        canInstall={Boolean(installationEnabled && installPrompt)}
        onClose={() => setMainMenuOpen(false)}
        onCheckForUpdate={() => {
          setMainMenuOpen(false);
          void checkForAppUpdate();
        }}
        onOpenDataManagement={() => {
          setMainMenuOpen(false);
          setDataManagementOpen(true);
        }}
        onInstall={() => void installApp()}
        onOpenFeedback={() => {
          setMainMenuOpen(false);
          setFeedbackOpen(true);
        }}
        isAdmin={isProgramAdmin}
        unreadFeedbackCount={isProgramAdmin ? feedbackMessaging.unreadCount : 0}
      />
      {actualProgramAdmin && guestPreview && <div className="admin-preview-banner" role="status">Aperçu invité · Vos données<button type="button" onClick={() => setGuestPreview(false)}>Quitter l’aperçu</button></div>}
      {isProgramAdmin && adminToolsOpen && <Suspense fallback={<p role="status">Ouverture des outils…</p>}><AdminToolsPanel demoMode={demoMode} onClose={() => setAdminToolsOpen(false)} onPreview={() => { setAdminToolsOpen(false); setGuestPreview(true); }} onChanged={() => { clearColleagueGroupsCache(); setAdminRevision(value => value + 1); }} /></Suspense>}
      {homeSection === 'home' && <HomeAdminMessage demoMode={demoMode} />}

      {feedbackMessaging.resolutionNotice ? (
        <Suspense fallback={null}>
          <FeedbackResolutionAlert notice={feedbackMessaging.resolutionNotice} onDismiss={() => void feedbackMessaging.dismissResolution(feedbackMessaging.resolutionNotice!.id)} />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <DocumentAnnouncementNotice
          enabled={authStatus === "ready" && !feedbackMessaging.resolutionNotice}
          demoMode={demoMode}
          isAdmin={isProgramAdmin}
        />
      </Suspense>
      {feedbackOpen ? (
        <Suspense fallback={null}>
          <FeedbackMessenger
            open
            isAdmin={isProgramAdmin}
            demoMode={demoMode}
            onClose={() => setFeedbackOpen(false)}
            onUnreadCountChange={feedbackMessaging.setUnreadCount}
          />
        </Suspense>
      ) : null}

      <ConnectionStatus {...connectionStatus} />
      <Suspense fallback={null}>
        <ColleagueRequestNotice
          demoMode={demoMode}
          onOpen={() => {
            setHomeSection("colleagues");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </Suspense>

      {homeSection === "home" ? (
        <Suspense fallback={<DeferredSection label="votre accueil" />}>
        <HomeDashboard
          now={now}
          group={group}
          hasConfiguredGroup={Boolean(formProfile?.group)}
          today={todayOverview}
          totalLeaveRemaining={totalLeaveRemaining}
          remainingWorkedDaysThisYear={remainingWorkedDaysThisYear}
          importantAlert={importantAlert}
          setupDismissKey={`planning:setup-dismissed-v1:${demoMode ? "demo" : userEmail.trim().toLowerCase()}`}
          setupItems={[
            ...(!formProfile?.workSchedule ? [{
              id: "work-schedule",
              title: "Renseigner vos horaires de travail",
              intro: "Renseignez votre plage de travail habituelle pour que l’application propose des horaires adaptés lorsque vous posez un congé ou une récupération.",
              detail: "Ils permettent de proposer automatiquement les bons horaires pour vos congés et récupérations.",
              actionLabel: "Renseigner",
              dismissible: false,
              onAction: () => {
                setHomeSection("pay");
                setPayScreen("overview");
                setPayProfileOpen(true);
                setPayAdvancedOpen(false);
                setPayProfileFocusRequested(true);
              },
            }] : []),
            ...(HOME_SETUP_GUIDANCE_ENABLED ? [
            ...(!formProfile?.group ? [{
              id: "planning-group",
              title: "Choisir votre groupe de planning",
              intro: "Choisissez votre groupe de planning pour afficher correctement vos jours de travail, de repos et votre calendrier.",
              detail: "Indispensable pour afficher vos jours de travail et de repos.",
              actionLabel: "Choisir",
              onAction: () => setGroupChooserOpen(true),
            }] : []),
            ...(!formProfile?.status || !formProfile?.workQuota ? [{
              id: "pay-profile",
              title: "Compléter votre profil de paie",
              intro: "Complétez votre statut et votre quotité afin d’adapter les calculs de paie et de temps de travail à votre situation.",
              detail: "Indiquez simplement votre statut et votre quotité de travail.",
              actionLabel: "Compléter",
              onAction: () => {
                setHomeSection("pay");
                setPayScreen("overview");
                setPayProfileOpen(true);
                setPayAdvancedOpen(true);
              },
            }] : []),
            ...(allowances.holidayPending > 0 || allowances.compensated.some((item) => !item.choice) ? [{
              id: "holiday-pay",
              title: "Renseigner les jours fériés",
              intro: "Indiquez le traitement de vos jours fériés pour répartir correctement les primes et les récupérations.",
              detail: "Précisez pour chacun le choix entre prime et récupération.",
              actionLabel: "Renseigner",
              onAction: () => {
                setHomeSection("pay");
                setPayScreen("allowances");
              },
            }] : []),
            ...(payslipRateCalibration.reason !== "ready" ? [{
              id: "payslip-calibration",
              title: "Ajouter quelques bulletins de paie",
              intro: "Ajoutez quelques bulletins PDF pour permettre à l’application d’affiner automatiquement vos estimations de paie.",
              detail: "Les éléments de paie seront remplis automatiquement, sans saisie manuelle. Choisissez idéalement des mois avec des primes différentes pour affiner les estimations.",
              actionLabel: "Ajouter des PDF",
              onAction: () => {
                setHomeSection("pay");
                setPayScreen("overview");
                setPayAdvancedOpen(true);
                setPaySettingsOpen(true);
                window.setTimeout(() => document.getElementById("payslip-calibration")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              },
            }] : []),
            ] : []),
          ]}
          hasAnyNote={hasAnyNote}
          noteQuery={noteQuery}
          onNoteQueryChange={setNoteQuery}
          noteSearchResults={noteSearchResults}
          upcoming={upcoming}
          renderNoteItems={renderNoteItems}
          onChooseGroup={() => setGroupChooserOpen(true)}
          onOpenNextWork={(date) => {
            setHomeSection("home");
            setMode("month");
            setView(localDate(date.getFullYear(), date.getMonth(), 1));
          }}
          onOpenLeave={() => setHomeSection("leave")}
          onOpenPayAlert={() => {
            if (sundayCarryoverMonth !== undefined && sundayCarryoverYear !== undefined)
              setPayView(localDate(sundayCarryoverYear, sundayCarryoverMonth, 1));
            setHomeSection("pay");
            setPayScreen("overview");
          }}
          onAddNote={beginQuickNote}
        />
        </Suspense>
      ) : null}

      {homeSection === "leave" ? (
        <Suspense fallback={<DeferredSection label="vos congés et récupérations" />}>
        <LeaveManagementPage
          onRequestLeave={() => openRequestChooser("general")}
          onOpenHolidayAllowances={() => {
            setHomeSection("pay");
            setPayScreen("allowances");
          }}
          balancesContent={
            <Suspense fallback={<DeferredSection label="vos soldes" />}>
              <LeaveBalancesSection
                year={absenceYear}
                totalRemaining={totalLeaveRemaining}
                balances={leaveStats.balances}
                countedOnly={leaveStats.countedOnly}
                manualSundayLeaveTotal={manualSundayLeaveTotal}
                onYearChange={(year) => {
                  setAbsenceYear(year);
                  setBalanceDetailType(null);
                }}
                onSelectBalance={setBalanceDetailType}
                onOpenManualAdjustments={openManualAdjustments}
              />
            </Suspense>
          }
          cetContent={
            <Suspense fallback={<DeferredSection label="votre CET" />}>
              <CetSection
                account={formProfile?.cetAccount}
                status={formProfile?.status || "contractuel"}
                fullName={formProfile?.fullName || ""}
                signature={formProfile?.signature || ""}
                annualDaysTaken={cetAnnualDaysTaken}
                plannedLeaveDays={cetPlannedLeaveDays}
                remaining={cetLeaveBalances}
                saving={savingCet}
                onSave={saveCetAccount}
                onRequestLeave={() => beginRequest("leave", undefined, "cet")}
              />
            </Suspense>
          }
          recoveryBalance={recoveryBalance}
          recoveryEarningsCount={recoveryEarnings.length}
          unresolvedHolidayRecoveryCount={unresolvedHolidayRecoveryCount}
          overtimeEntries={overtimeEntries}
          holidayRecoveryEarnings={holidayRecoveryEarnings}
          recoveryUses={recoveryUses}
          recoveryEarningStates={recoveryEarningStates}
          overtimeHistoryOpen={overtimeHistoryOpen}
          mecenatEntries={mecenatEntries}
          mecenatHistoryOpen={mecenatHistoryOpen}
          isProgramAdmin={isProgramAdmin}
          archiveOpen={archiveOpen}
          archivedRequests={archivedRequests}
          onOpenOvertime={() => setOvertimeDialogOpen(true)}
          onOpenSolidarity={() => setSolidarityDialogOpen(true)}
          onToggleOvertimeHistory={() => setOvertimeHistoryOpen((current) => !current)}
          onDeleteOvertime={(entry) => void deleteOvertimeEntry(entry)}
          onDeleteRecoveryUse={(entry) => void deleteRecoveryUse(entry)}
          onOpenMecenat={() => {
            setMecenatDraft((current) => ({ ...current, date: dateKey(now) }));
            setMecenatDialogOpen(true);
          }}
          onToggleMecenatHistory={() => setMecenatHistoryOpen((current) => !current)}
          onDeleteMecenat={(entry) => void deleteMecenatEntry(entry)}
          onToggleArchive={() => setArchiveOpen((current) => !current)}
          onOpenArchivedRequest={openArchivedRequest}
          onDeleteArchivedRequest={(request) => void deleteArchivedRequest(request)}
        />
        </Suspense>
      ) : null}
      {homeSection === "pay" && allowances && payContent ? (
        <Suspense fallback={<DeferredSection label="votre paie" />}>
        <PayPage
          screen={payScreen}
          month={payView.getMonth()}
          year={payView.getFullYear()}
          profileOpen={payProfileOpen}
          profileFocusRequested={payProfileFocusRequested}
          settingsOpen={payAdvancedOpen}
          workQuota={workQuota}
          workSchedule={formProfile?.workSchedule || DEFAULT_WORK_SCHEDULE}
          status={formProfile?.status || "contractuel"}
          netEstimateComplete={netEstimateComplete}
          missingFields={netEstimateMissing}
          onCompleteEstimate={() => { setPaySettingsOpen(true); setPayAdvancedOpen(true); }}
          gross={payContent.gross}
          grossComplete={payContent.grossComplete}
          net={payContent.net}
          profileLabel={payContent.profileLabel}
          reliability={payContent.reliability}
          variables={payContent.variables}
          monthSlide={payMonthSlide}
          allowancesContent={allowancesContent}
          estimateContent={payContent.estimateContent}
          verificationContent={payContent.verificationContent}
          settingsContent={payContent.settingsContent}
          onScreenChange={setPayScreen}
          onToggleProfile={() => setPayProfileOpen((current) => !current)}
          onProfileFocused={() => setPayProfileFocusRequested(false)}
          onToggleSettings={() => setPayAdvancedOpen((current) => !current)}
          onWorkQuotaChange={changeWorkQuota}
          onWorkScheduleChange={changeWorkSchedule}
          onStatusChange={changeStatus}
          onSaveProfile={() => void saveCalculationProfile()}
          onPreviousMonth={() => slideAllowancesMonth(-1)}
          onNextMonth={() => slideAllowancesMonth(1)}
          onToday={goPayToday}
          onTouchStart={startAllowancesSwipe}
          onTouchEnd={endAllowancesSwipe}
        />
        </Suspense>
      ) : null}

      {homeSection === "pdf" || homeSection === "forms" ? (
        <Suspense fallback={<DeferredSection label="vos contacts et formulaires" />}>
        <UsefulResourcesHub
          initialTab={homeSection === "pdf" ? undefined : "forms"}
          pdf={(
            <PdfDownloadPage
              narrowScreen={narrowScreen}
              year={view.getFullYear()}
              group={group}
              showSchoolVacations={showSchoolVacationsOnPdf}
              exporting={pdfExporting}
              onYearChange={(year) => setView(localDate(year, view.getMonth(), 1))}
              onGroupChange={changeGroup}
              onShowSchoolVacationsChange={setShowSchoolVacationsOnPdf}
              onExport={(scope, includeSchoolVacations) => void exportAnnualPlanning(scope, includeSchoolVacations)}
            />
          )}
          forms={(
            <UsefulFormsSection
              key={adminRevision}
              accountId={userEmail}
              isAdmin={isProgramAdmin}
              demoMode={demoMode}
              today={dateKey(now)}
              status={formProfile?.status || "contractuel"}
              periods={periods}
              onSaveWorkAccident={saveWorkAccident}
              onDeleteWorkAccident={deleteWorkAccident}
            />
          )}
          contacts={<UsefulContactsSection key={adminRevision} accountId={userEmail} initialData={adminRevision ? undefined : prefetchedContacts || undefined} isAdmin={isProgramAdmin} demoMode={demoMode} />}
        />
        </Suspense>
      ) : null}
      {homeSection === "program" ? (
        <Suspense fallback={<DeferredSection label="la programmation GP" />}>
          <GrandPalaisProgramSection guestPreview={guestPreview} />
        </Suspense>
      ) : null}
      {homeSection === "colleagues" ? (
        <Suspense fallback={<DeferredSection label="les plannings de vos collègues" />}>
          <ColleaguePlanningPage
            key={adminRevision}
            demoMode={demoMode}
            initialName={formProfile?.fullName || ""}
            getOwnPresence={(date) => personalPresenceForDate(date, group, periods, entries, recoveryUses, workDayMinutes, (key) => Boolean(exceptionalClosureFor(key)))}
          />
        </Suspense>
      ) : null}

      <div className={`planning-workspace-shell${homeSection === "home" ? " framed" : ""}`}>
      {showCalendarWorkspace ? (
        <>
      <PlanningCommandCenter
        isHome={homeSection === "home"}
        mode={mode}
        view={view}
        setView={setView}
        group={group}
        workQuota={workQuota}
        onGroupChange={changeGroup}
        workedDays={workedDays}
        totals={totals}
        recoveryRangeSelecting={recoveryRangeSelecting}
        recoveryDraft={recoveryDraft}
        setRecoveryDraft={setRecoveryDraft}
        recoveryRangeDates={recoveryRangeDates}
        savingOvertime={savingOvertime}
        onCancelRecoveryRange={cancelRecoveryRangeSelection}
        onSaveRecoveryRange={() => void saveRecoveryRangeDates()}
        rangeSelecting={rangeSelecting}
        separatePeople={separatePeople}
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
        onModeChange={setMode}
        onExportPdf={homeSection === "home" ? () => void exportAnnualPlanning("my-leaves", showSchoolVacationsOnPdf) : undefined}
        exportingPdf={pdfExporting === "my-leaves"}
        showSchoolVacations={showSchoolVacations}
        schoolZone={schoolZone}
        onShowSchoolVacationsChange={setShowSchoolVacations}
        onSchoolZoneChange={setSchoolZone}
      />

      {mode === "year" && homeSection === "pdf" && (
          <section
            id="planning-pdf"
            className="annual-pdf-actions"
          aria-label="Enregistrer le planning annuel en PDF"
        >
          {narrowScreen ? (
            <button
              className="request-archive-toggle annual-pdf-toggle"
              type="button"
              onClick={() => setPdfOpen((current) => !current)}
              aria-expanded={pdfOpen}
            >
              <span className="request-archive-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
                </svg>
              </span>
              <span className="request-archive-copy">
                <span className="step-label">Exports PDF</span>
                <strong>Plannings annuels</strong>
                <small>3 formats prêts à imprimer</small>
              </span>
              <span className="request-archive-caret" aria-hidden="true">
                <svg viewBox="0 0 20 20">
                  <path d="m5 7.5 5 5 5-5" />
                </svg>
              </span>
            </button>
          ) : (
            <div className="annual-pdf-heading">
              <span className="step-label">Exports PDF</span>
              <small>Plannings annuels prêts à imprimer</small>
            </div>
          )}
          <div
            className="annual-pdf-buttons"
            hidden={narrowScreen && !pdfOpen}
          >
            <div className="school-vacation-choice">
              <button
                type="button"
                className={
                  showSchoolVacationsOnPdf
                    ? "school-vacation-toggle active"
                    : "school-vacation-toggle"
                }
                aria-pressed={showSchoolVacationsOnPdf}
                onClick={() =>
                  setShowSchoolVacationsOnPdf((current) => !current)
                }
              >
                <i aria-hidden="true" />
                Afficher les vacances scolaires
              </button>
              {showSchoolVacationsOnPdf && (
                <small>Zones A, B et C incluses dans le récapitulatif.</small>
              )}
            </div>
            <button
              type="button"
              className="pdf-action selected-group"
              disabled={pdfExporting !== null}
              onClick={() =>
                void exportAnnualPlanning(
                  "selected",
                  showSchoolVacationsOnPdf,
                )
              }
            >
              <span className="pdf-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
                </svg>
              </span>
              <span className="pdf-action-copy">
                <strong>
                  {pdfExporting === "selected"
                    ? "Création…"
                    : `Groupe ${group}`}
                </strong>
                <small>1 page</small>
              </span>
            </button>
            <button
              type="button"
              className="pdf-action all-groups"
              disabled={pdfExporting !== null}
              onClick={() =>
                void exportAnnualPlanning(
                  "all",
                  showSchoolVacationsOnPdf,
                )
              }
            >
              <span className="pdf-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
                </svg>
              </span>
              <span className="pdf-action-copy">
                <strong>
                  {pdfExporting === "all" ? "Création…" : "Les 3 groupes"}
                </strong>
                <small>3 pages</small>
              </span>
            </button>
            <button
              type="button"
              className="pdf-action my-leaves"
              disabled={pdfExporting !== null}
              onClick={() =>
                void exportAnnualPlanning(
                  "my-leaves",
                  showSchoolVacationsOnPdf,
                )
              }
            >
              <span className="pdf-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
                </svg>
              </span>
              <span className="pdf-action-copy">
                <strong>
                  {pdfExporting === "my-leaves"
                    ? "Création…"
                    : `Groupe ${group} + mes congés`}
                </strong>
                <small>1 page</small>
              </span>
            </button>
          </div>
        </section>
      )}

      <NoteSelectionPanel
        open={noteSelecting}
        noteColor={noteColor}
        noteText={noteText}
        noteDates={noteDates}
        savingDay={savingDay}
        onCancel={cancelNoteSelection}
        onSave={saveNoteAcrossDates}
      />

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
        savingRequest={savingRequest}
        selectionBlocked={
          recoverySelectionInsufficient ||
          recoverySelectionIncomplete ||
          leaveSelectionZeroBalance
        }
        onCancel={cancelRequest}
        onSelectLeaveType={selectLeaveType}
        onSelectRecoveryType={selectRecoveryType}
        onValidateAndOpenForm={() => void validateAndOpenForm()}
        onSaveToPlanning={() => void saveRequestToPlanning()}
      />

      <RecoveryDatePickingPanel
        open={recoveryDatePicking}
        onCancel={() => {
          setRecoveryDatePicking(false);
          setRecoveryDialogOpen(true);
        }}
      />

      <section className="planning-calendar-section" aria-label="Planning et congés">
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

      {showSchoolVacations && mode === "month" ? (
        <Suspense fallback={null}>
          <SchoolVacationMonthSummary zone={schoolZone} vacations={monthSchoolVacations} />
        </Suspense>
      ) : null}

      {mode === "month" ? (
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
      ) : (
        <section className="year-grid">
          {MONTHS.map((month, index) => (
            <article
              className="mini-month"
              id={`month-${index}`}
              key={month}
              ref={(node) => {
                monthRefs.current[index] = node;
              }}
            >
              <h3>
                <button
                  className="mini-month-open"
                  type="button"
                  onClick={() => openMonthFromYear(index)}
                  title={`Ouvrir ${month} en grand`}
                >
                  {month}
                </button>
              </h3>
              <MonthCalendar
                year={view.getFullYear()}
                month={index}
                compact
                renderDay={renderDay}
              />
            </article>
          ))}
        </section>
      )}
      {homeSection === "home" && mode === "month" ? (
        <WorkExchangePanel exchanges={workExchanges} onEdit={editWorkExchange} />
      ) : null}
      {homeSection === "home" && mode === "month" ? (
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
      <WorkExchangeDialog
        open={workExchangeUi.open}
        group={group}
        draft={workExchangeUi.draft}
        setDraft={workExchangeUi.setDraft}
        error={workExchangeUi.error}
        saving={workExchangeUi.saving}
        onClose={workExchangeUi.close}
        onSave={() => void workExchangeUi.save()}
        onDelete={() => void workExchangeUi.remove()}
      />
      <RequestChooserDialog
        open={requestChooser}
        requestChooserDate={requestChooserDate}
        onClose={() => setRequestChooser(false)}
        onChoose={beginChosenRequest}
      />

      <GroupChooserDialog
        open={groupChooserOpen}
        group={group}
        onClose={() => setGroupChooserOpen(false)}
        onChange={(value) => {
          changeGroup(value);
          setGroupChooserOpen(false);
        }}
      />

      <DayDetailDialog
        planning={planningUi}
        quickNoteMode={quickNoteMode}
        entries={entries}
        partnerEntries={partnerEntries}
        dayExchange={dayExchange}
        dayStoredPeriods={dayStoredPeriods}
        dayRecoveryUses={dayRecoveryUses}
        dayExceptionalClosure={Boolean(dayExceptionalClosure)}
        dayHolidayChoiceVisible={dayHolidayChoiceVisible}
        baseSalary={baseSalary}
        approvedGrandPalaisUpdates={approvedGrandPalaisUpdates}
        noteEditorOpen={noteEditorOpen}
        setNoteEditorOpen={setNoteEditorOpen}
        noteFieldRef={noteFieldRef}
        ownNoteAuthorLabel={ownNoteAuthorLabel}
        editWorkExchange={editWorkExchange}
        openRequestChooser={openRequestChooser}
        openPlanningRequestMethod={openPlanningRequestMethod}
        saveWishDateDirect={saveWishDateDirect}
        saveSickDateDirect={saveSickDateDirect}
        saveOtherDateDirect={saveOtherDateDirect}
        saveStrikeDateDirect={saveStrikeDateDirect}
        saveDay={saveDay}
        beginMultipleDateSelectionFromDay={beginMultipleDateSelectionFromDay}
        beginNoteDateSelection={beginNoteDateSelection}
        editDayLeavePeriod={editDayLeavePeriod}
        deleteRecoveryUse={deleteRecoveryUse}
        deleteAgnesNote={deleteAgnesNote}
        appendNoteLine={appendNoteLine}
      />

      <BalanceDetailDialog
        balanceDetail={balanceDetail}
        balanceDetailType={balanceDetailType}
        balanceDetailPeriods={balanceDetailPeriods}
        recentBalanceDetailDates={recentBalanceDetailDates}
        absenceYear={absenceYear}
        now={now}
        onClose={() => setBalanceDetailType(null)}
        onOpenDate={(date) => {
          setBalanceDetailType(null);
          setView(localDate(date.getFullYear(), date.getMonth(), 1));
          setMode("month");
          openDay(date);
        }}
        onOpenManualAdjustments={openManualAdjustments}
        strikeEstimateFor={(year, monthIndex) =>
          strikePayEstimate(periods, group, payProfiles, year, monthIndex, {
            entries,
            recoveryUses,
          })
        }
      />

      <AppDialogLayer
        manualAdjustments={{
          open: manualAdjustmentsOpen,
          year: absenceYear,
          draft: manualAdjustmentDraft,
          setDraft: setManualAdjustmentDraft,
          saving: savingManualAdjustments,
          onClose: () => setManualAdjustmentsOpen(false),
          onSave: () => void saveManualAdjustments(),
        }}
        planning={planningUi}
        workTime={workTimeUi}
        shell={appShellUi}
        toast={toastUi}
        group={group}
        workQuota={workQuota}
        workSchedule={formProfile?.workSchedule || DEFAULT_WORK_SCHEDULE}
        mecenatCalculation={mecenatDraftCalculation}
        recoveryRemainingMinutes={recoveryBalance.remaining}
        onStartRangeSelection={beginRangeSelection}
        onSaveMecenat={() => void saveMecenatEntry()}
        onSaveOvertime={() => void saveOvertimeEntry()}
        onSaveSolidarityHours={() => void saveSolidarityHours()}
        onChangeRecoveryRangeKind={(kind) =>
          setRecoveryDraft((current) => ({
            ...current,
            kind,
            durationMinutes: defaultRecoveryMinutes(kind, workQuota),
            trainingMinutes:
              kind === "training"
                ? trainingRecoveryMinutes(workQuota)
                : current.trainingMinutes,
          }))
        }
        onCloseRecoveryRange={() => {
          setRecoveryRangeOpen(false);
          setRecoveryRangePrefillDate(null);
        }}
        onStartRecoveryRangeSelection={beginRecoveryRangeSelection}
        onSelectRecoveryInCalendar={() => {
          setRecoveryDialogOpen(false);
          setRecoveryDatePicking(true);
          setHomeSection("home");
          setMode("month");
          window.setTimeout(
            () => document.querySelector(".month-card")?.scrollIntoView({ behavior: "smooth", block: "center" }),
            0,
          );
        }}
        onSaveRecoveryUse={() => void saveRecoveryUse()}
        onConfirmTime={commitTime}
        onConfirmNonWorkingDay={confirmWarning}
        onDeletePeriod={deleteLeavePeriod}
        onCheckForUpdate={() => {
          setAppUpdatePromptOpen(false);
          void checkForAppUpdate();
        }}
        onExportData={() => void exportDataBackup()}
        onImportData={(file) => void importDataBackup(file)}
        onDeleteAllData={() => void deleteAllUserData()}
      />
      {viewportDebugEnabled && (
        <div
          style={{
            position: "fixed",
            bottom: 8,
            left: 8,
            zIndex: 9999,
            padding: "4px 8px",
            borderRadius: 6,
            background: "#000",
            color: "#0f0",
            fontFamily: "monospace",
            fontSize: 11,
            pointerEvents: "none",
          }}
        >
          {viewportSize.width}×{viewportSize.height} · dpr{" "}
          {window.devicePixelRatio} · ratio{" "}
          {(viewportSize.width / viewportSize.height).toFixed(3)}
        </div>
      )}
    </main>
  );
}
