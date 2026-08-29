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
import { ChoicePicker } from "./ChoicePicker";
import { AuthScreen } from "./AuthScreen";
import { grandPalaisExceptionalClosure } from "./grandPalaisClosures";
import { getSharedGrandPalaisProgram } from "./grandPalaisProgramApi";
import { getUsefulContacts } from "./contactsApi";
import { resolvePublicDemoAccess } from "./demoAccess";
import { parseDemoCompletedRequestJson } from "./demoCompletedRequest";
import { ConnectionStatus } from "./ConnectionStatus";
import { HomeDashboard } from "./HomeDashboard";
import { useAuthUiState } from "./useAuthUiState";
import { usePayUiState } from "./usePayUiState";
import { usePayActions } from "./usePayActions";
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
import { useAppShellUiState } from "./useAppShellUiState";
import { AppDialogLayer } from "./AppDialogLayer";
import {
  AppHeader,
  MainMenu,
  MAIN_SECTION_ORDER,
} from "./AppNavigation";
import { PlanningCommandCenter } from "./PlanningCommandCenter";
import { PlanningDayCell } from "./PlanningDayCell";
import { MonthCalendar } from "./PlanningView";
import { RequestValidationSummary } from "./RequestValidationSummary";
import {
  CalendarApiError,
  calendarErrorMessage,
  getCalendar,
  notifyGuestSession,
  postCalendar,
  postCalendarBatch,
} from "./calendarApi";
import { parseCalendarSnapshot } from "./calendarPayload";
import {
  HOLIDAY_PAY_OPTIONS,
  euros,
  notePeriodFor,
  rangeKeys,
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
import { PayslipWarningEffect } from "./PayslipWarningEffect";
import { strikePayEstimate } from "./strike";
import { StrikeContinuityDetails } from "./StrikeContinuityDetails";
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
  dailyMinutesForQuota,
  holidayRecoveryEntries,
  minutesLabel,
  monthlyRecoveryBalance,
  recoveryRequestMinutes,
  trainingRecoveryMinutes,
  type RecoveryUse,
  type RecoveryRequestType,
  type WorkQuota,
} from "./overtime";
import { useToast } from "./useToast";
import { type CetAccount } from "./cet";
import {
  COUNTED_ONLY_TYPES,
  DAY_LABELS,
  GROUP_OPTIONS,
  HALF_MOMENT_OPTIONS,
  LEAVE_ALLOWANCES,
  LEAVE_TYPE_OPTIONS,
  MONTHS,
  RESIDENCE_ALLOWANCE_RATE,
  SUNDAY_ALLOWANCE,
  sickLeaveDeduction,
  sundayTierFor,
  holidayAllowance,
  holidayPayslip,
  sundayAllowance,
  sundayPayslip,
  wasPompidouHolidayWorked,
  yearThirdFor,
  yearThirdRange,
  YEAR_THIRDS,
  TYPE_COLORS,
  TYPE_LABELS,
  applyManualSundayLeave,
  addDays,
  coWorkingGroupsForDate,
  dateKey,
  dateTimeLabel,
  fromKey,
  getDayInfo,
  groupConsecutive,
  halfMomentFromStart,
  leaveTypeLabel,
  s,
  localDate,
  longDate,
  monthDays,
  nextAttendanceDay,
  periodLabel,
  sameDate,
  selectionRemovesAttendance,
  type CountedOnlyType,
  type HolidayPay,
  type LeaveType,
  type SelectionType,
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

const LeaveBalancesSection = lazy(() =>
  import("./LeaveBalancesSection").then((module) => ({ default: module.LeaveBalancesSection })),
);
const CetSection = lazy(() =>
  import("./CetSection").then((module) => ({ default: module.CetSection })),
);
const PayEstimateDetails = lazy(() =>
  import("./PayEstimateDetails").then((module) => ({ default: module.PayEstimateDetails })),
);
const UsefulFormsSection = lazy(() =>
  import("./UsefulFormsSection").then((module) => ({ default: module.UsefulFormsSection })),
);
const UsefulContactsSection = lazy(() =>
  import("./UsefulContactsSection").then((module) => ({ default: module.UsefulContactsSection })),
);
const GrandPalaisProgramSection = lazy(() =>
  import("./GrandPalaisProgramSection").then((module) => ({ default: module.GrandPalaisProgramSection })),
);
const UserGuideDialogs = lazy(() =>
  import("./UserGuideDialogs").then((module) => ({ default: module.UserGuideDialogs })),
);
const LeaveManagementPage = lazy(() =>
  import("./LeaveManagementPage").then((module) => ({ default: module.LeaveManagementPage })),
);
const PayPage = lazy(() =>
  import("./PayPage").then((module) => ({ default: module.PayPage })),
);
const PayAllowancesSection = lazy(() =>
  import("./PayAllowancesSection").then((module) => ({ default: module.PayAllowancesSection })),
);
const PayslipCheckSection = lazy(() =>
  import("./PayslipCheckSection").then((module) => ({ default: module.PayslipCheckSection })),
);
const PdfDownloadPage = lazy(() =>
  import("./PdfDownloadPage").then((module) => ({ default: module.PdfDownloadPage })),
);
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
      import.meta.env.VITE_E2E_DEMO === "true" &&
      localTestHost &&
      (localStorage.getItem("planning:e2e-demo-enabled") === "1" ||
        new URLSearchParams(location.search).get("local-test") === "1"));
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
    isProgramAdmin, setIsProgramAdmin, loginEmail, setLoginEmail,
    loginPassword, setLoginPassword, passwordConfirmation, setPasswordConfirmation,
    inviteToken, setInviteToken, authBusy, setAuthBusy,
    authError, setAuthError, authNotice, setAuthNotice,
  } = useAuthUiState();
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
  } = useCalendarDataState();
  const workTimeUi = useWorkTimeUiState();
  const {
    setOvertimeDialogOpen, setSolidarityDialogOpen,
    setRecoveryDialogOpen,
    recoveryDatePicking, setRecoveryDatePicking, trainingRecoveryMode, setTrainingRecoveryMode,
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
    noteGroupId, noteSelecting, noteDates,
    dayLeave, setDayLeave, dayPersonalLeave, dayWish, setDayWish,
    dayLeaveType, setDayLeaveType, dayHalfMoment, setDayHalfMoment,
    dayHolidayPay, setDayHolidayPay, setLeaveRangeEnabled,
    setLeaveRangeFrom, setLeaveRangeTo, savingDay, setSavingDay,
    rangeLeaveType,
    rangeSelecting, separateDates,
    setRecoveryRangeOpen, recoveryRangeSelecting, setRecoveryRangeSelecting,
    recoveryRangePrefillDate, setRecoveryRangePrefillDate, recoveryRangeDates, setRecoveryRangeDates,
    separatePeople, setDeletingPeriod,
    savingRange, requestChooser, setRequestChooser,
    planningRequestMethod, setPlanningRequestMethod, planningRequestDate, setPlanningRequestDate,
    pendingRecoveryType, setPendingRecoveryType, pendingLeaveType, setPendingLeaveType,
    requestKind, setRequestKind, sickRequest, setSickRequest, savingRequest,
    activeType, setActiveType, selections, setSelections, setTimeDate,
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
    payScreen, setPayScreen, payProfileOpen, setPayProfileOpen,
    payPeriodOpen, setPayPeriodOpen, payMonthSlide, setPayMonthSlide,
    payMonthSlideTimer, payslipCheck, setPayslipCheck, payslipError, setPayslipError,
    payslipImportBusy, setPayslipImportBusy, payslipImportError, setPayslipImportError,
    payslipImportResult, setPayslipImportResult, payslipImportMode, setPayslipImportMode,
    payslipNeedsPeriod, setPayslipNeedsPeriod, payslipFallbackMonth, setPayslipFallbackMonth,
    payslipFallbackYear, setPayslipFallbackYear, payslipRateSamples, setPayslipRateSamples,
    payslipHelpOpen, setPayslipHelpOpen, payslipResultDetailsOpen, setPayslipResultDetailsOpen,
    paySettingsOpen, setPaySettingsOpen,
    payDrafts, setPayDrafts, savingPay, setSavingPay,
  } = usePayUiState();
  const appShellUi = useAppShellUiState();
  const {
    quickNoteMode,
    homeSection, setHomeSection, prefetchedContacts, setPrefetchedContacts,
    approvedGrandPalaisUpdates, setApprovedGrandPalaisUpdates, sectionSwipeStartRef,
    mainMenuOpen, setMainMenuOpen, guidePromptOpen, setGuidePromptOpen,
    guideOpen, setGuideOpen, guidePromptCheckedRef, groupChooserOpen, setGroupChooserOpen,
    noteQuery, setNoteQuery, narrowScreen, setNarrowScreen, pdfOpen, setPdfOpen,
    accountMenuOpen, setAccountMenuOpen, checkingAppUpdate, setCheckingAppUpdate,
    appUpdateAvailable, setAppUpdateAvailable, setAppUpdatePromptOpen,
    setDataManagementOpen, setDataManagementBusy,
    accountMenuRef, accountButtonRef, viewportDebugEnabled, viewportSize, setViewportSize,
    showSchoolVacationsOnPdf, setShowSchoolVacationsOnPdf, calendarSlide,
    monthRefs, allowancesSwipeStart,
  } = appShellUi;
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
    if (authStatus !== "ready") return;
    let active = true;
    void getSharedGrandPalaisProgram()
      .then((payload) => {
        if (!active) return;
        setApprovedGrandPalaisUpdates(payload.approved ?? []);
        setIsProgramAdmin(import.meta.env.DEV && demoMode ? true : payload.isAdmin);
      })
      .catch(() => {
        if (active) setIsProgramAdmin(import.meta.env.DEV && demoMode);
      });
    return () => { active = false; };
  }, [authStatus, demoMode]);

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
    if (authStatus !== "ready") return;
    let active = true;
    const warmSecondarySections = () => {
      [
        "/forms-header-art-fast.webp",
        "/grand-palais-verriere-fast.webp",
        "/contacts-header-art-black-fast.webp",
      ].forEach((source) => {
        const image = new Image();
        image.decoding = "async";
        image.src = source;
      });
      void getUsefulContacts()
        .then((payload) => {
          if (active) setPrefetchedContacts(payload);
        })
        .catch(() => undefined);
    };
    const idleId = window.requestIdleCallback
      ? window.requestIdleCallback(warmSecondarySections, { timeout: 1_500 })
      : window.setTimeout(warmSecondarySections, 500);
    return () => {
      active = false;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [authStatus]);
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
    if (authStatus !== "ready" || !userEmail || guidePromptCheckedRef.current)
      return;
    guidePromptCheckedRef.current = true;
    const demo = demoMode;
    const identity = demo
      ? "demo"
      : userEmail.trim().toLowerCase();
    if (!demo && !localStorage.getItem(`planning:guide-pending-v1:${identity}`))
      return;
    if (!localStorage.getItem(`planning:guide-seen-v1:${identity}`))
      setGuidePromptOpen(true);
  }, [authStatus, userEmail, demoMode]);
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
  /** Ouvre une entrée sous la note existante : une ligne vide pour aérer, puis
   *  un tiret qui marque le début de l'ajout. */
  function appendNoteLine() {
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
        setIsProgramAdmin(import.meta.env.DEV);
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
    setAuthStatus("ready");
    setPeriods(data.periods);
  }
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
    guidePromptCheckedRef,
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
    },
    confirmMessage: confirm,
  });

  const {
    exportDataBackup,
    importDataBackup,
    archiveLegacyData,
    deleteAllUserData,
  } = useAccountDataActions({
    setBusy: setDataManagementBusy,
    setOpen: setDataManagementOpen,
    loadCalendar,
    notify,
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

  function exceptionalClosureFor(key: string) {
    const override = entries[key]?.closureOverride;
    if (override === "open") return undefined;
    if (override === "closed")
      return { date: key, label: "Fermeture exceptionnelle ajoutée manuellement" };
    return grandPalaisExceptionalClosure(key, approvedGrandPalaisUpdates);
  }

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
        const notWorked =
          exceptionallyClosed ||
          Boolean(entries[key]?.leave) ||
          periods.some((period) => key >= period.from && key <= period.to) ||
          recoveryUses
            .filter((item) => item.date === key)
            .reduce((total, item) => total + item.minutes, 0) >= fullDayMinutes;
        if (info.kind === "work" && !notWorked) result.work++;
        if (info.kind === "training" && !exceptionallyClosed) result.training++;
        if (info.holiday && info.kind === "work" && !notWorked)
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
  const payYear = String(view.getFullYear());
  const activePayProfile = payProfiles[payYear];
  const hasPayValue = (field: keyof PayProfile) =>
    activePayProfile?.[field] !== undefined || formProfile?.[field] !== undefined;
  const baseSalary = activePayProfile?.baseSalary ?? formProfile?.baseSalary ?? 0;
  const ifse = activePayProfile?.ifse ?? formProfile?.ifse ?? 0;
  const carenceDay = activePayProfile?.carenceDay ?? formProfile?.carenceDay ?? 0;
  // Pour une contractuelle, la seule ligne fixe confirmée est l'indemnité de
  // résidence (3 % du traitement) : calculée toute seule plutôt que saisie,
  // et pas la somme à cinq lignes propre à un fonctionnaire (résidence +
  // SMIC comp. + ICHCSG + MGEN − transfert), dont rien ne dit qu'elle
  // s'applique à elle. Une valeur déjà saisie à la main reste prioritaire,
  // au cas où son bulletin réel montrerait autre chose.
  const otherFixed =
    activePayProfile?.otherFixed ??
    formProfile?.otherFixed ??
    (isContractuel ? baseSalary * RESIDENCE_ALLOWANCE_RATE : 0);
  const cia = activePayProfile?.cia ?? formProfile?.cia ?? 0;
  const ciaMonth = activePayProfile?.ciaMonth ?? formProfile?.ciaMonth;
  const viewedPayRegime = payCalibrationRegime(
    view.getFullYear(),
    view.getMonth(),
  );
  const defaultNetRatios = defaultNetRatiosForPeriod(
    view.getFullYear(),
    view.getMonth(),
  );
  // Les profils antérieurs à ce champ ont tous été calibrés sous le régime
  // collectif actuel : on les traite comme tels pour ne pas changer les
  // estimations récentes déjà validées.
  const storedNetRatioRegime =
    activePayProfile?.netRatioRegime ??
    formProfile?.netRatioRegime ??
    "culture-psc";
  const storedNetRatioFixed =
    activePayProfile?.netRatioFixed ?? formProfile?.netRatioFixed;
  const storedNetRatioVariable =
    activePayProfile?.netRatioVariable ?? formProfile?.netRatioVariable;
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
  const navigo = activePayProfile?.navigo ?? formProfile?.navigo ?? 0;
  const mealVoucherDeduction =
    activePayProfile?.mealVoucherDeduction ??
    formProfile?.mealVoucherDeduction ??
    0;
  const pasRate = activePayProfile?.pasRate ?? formProfile?.pasRate ?? 0;
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
    const year = String(view.getFullYear());
    const sickDays = new Set<string>();
    for (const period of periods) {
      if (period.leaveType !== "sick") continue;
      for (const key of rangeKeys(period.from, period.to)) sickDays.add(key);
    }
    const arrets = groupConsecutive([...sickDays])
      .filter((arret) => arret.from.slice(0, 4) === year)
      .map((arret) => {
        const days = rangeKeys(arret.from, arret.to).length;
        return {
          id: arret.from,
          from: arret.from,
          to: arret.to,
          days,
          ...sickLeaveDeduction(days, baseSalary, ifse, carenceDay),
        };
      })
      .sort((a, b) => a.from.localeCompare(b.from));
    // La retenue est rattachée au mois où l'arrêt commence. L'administration
    // la passe parfois le mois suivant, en rappel — impossible à prévoir.
    const byMonth = Array.from({ length: 12 }, () => ({ days: 0, total: 0 }));
    for (const arret of arrets) {
      const slot = byMonth[Number(arret.from.slice(5, 7)) - 1];
      slot.days += arret.days;
      slot.total += arret.total;
    }
    return {
      arrets,
      byMonth,
      days: arrets.reduce((total, arret) => total + arret.days, 0),
      total: arrets.reduce((total, arret) => total + arret.total, 0),
    };
  }, [view, periods, baseSalary, ifse, carenceDay]);

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
    const year = view.getFullYear();
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
    view,
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
          .map(([date]) => date),
        workQuota,
      ),
    [entries, workQuota],
  );
  const recoveryEarnings = useMemo(
    () => [...overtimeEntries, ...holidayRecoveryEarnings],
    [overtimeEntries, holidayRecoveryEarnings],
  );
  const recoveryBalance = useMemo(
    () => monthlyRecoveryBalance(recoveryEarnings, recoveryUses),
    [recoveryEarnings, recoveryUses],
  );
  const recoveryEarningStates = useMemo(
    () =>
      new Map(
        allocateRecoveryUses(recoveryEarnings, recoveryUses).map((item) => [
          item.entryId,
          item,
        ]),
      ),
    [recoveryEarnings, recoveryUses],
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

  function rememberGuideSeen() {
    const demo = demoMode;
    const identity = demo
      ? "demo"
      : userEmail.trim().toLowerCase();
    localStorage.setItem(`planning:guide-seen-v1:${identity}`, "1");
    localStorage.removeItem(`planning:guide-pending-v1:${identity}`);
  }

  function openGuideFromPrompt() {
    rememberGuideSeen();
    setGuidePromptOpen(false);
    setGuideOpen(true);
  }

  function skipGuidePrompt() {
    rememberGuideSeen();
    setGuidePromptOpen(false);
  }

  const overtimeForPayMonth = useMemo(() => {
    return paidOvertimeForPayPeriod(view.getFullYear(), view.getMonth());
  }, [view, payProfiles, formProfile, overtimeEntries, workQuota]);
  const mecenatForCurrentPayMonth = useMemo(
    () => mecenatForPayMonth(mecenatEntries, view.getFullYear(), view.getMonth()),
    [mecenatEntries, view],
  );
  const strikeForCurrentPayMonth = useMemo(
    () =>
      strikePayEstimate(
        periods,
        group,
        payProfiles,
        view.getFullYear(),
        view.getMonth(),
        { entries, recoveryUses },
      ),
    [periods, group, payProfiles, view, entries, recoveryUses],
  );

  /* La paie du mois affiché : les primes de ce mois-là, retenues déduites.
     C'est la question qu'on se pose en ouvrant un mois. */
  const monthPay = useMemo(() => {
    if (!allowances || !sickLeaves) return null;
    const index = view.getMonth();
    const month = allowances.monthly.find((slot) => slot.index === index);
    // La retenue maladie d'un fonctionnaire (carence + 10 %/jour) ne
    // s'applique pas telle quelle à une contractuelle (IJSS, subrogation) :
    // ignorée ici, pas seulement cachée, pour ne pas fausser le brut/net en
    // silence dès qu'un arrêt est posé au calendrier.
    const sickForMonth = sickLeaves.byMonth[index];
    const sick = isContractuel
      ? { days: sickForMonth.days, total: 0 }
      : sickForMonth;
    const strikeDeduction =
      !isContractuel && strikeForCurrentPayMonth.totalDeduction !== null
        ? strikeForCurrentPayMonth.totalDeduction
        : 0;
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
      strike: strikeDeduction,
      strikeDays: strikeForCurrentPayMonth.days.length,
      strikeDeductedDays:
        strikeForCurrentPayMonth.days.length +
        strikeForCurrentPayMonth.automaticAdditionalDays.length,
      strikeAutomaticDays: strikeForCurrentPayMonth.automaticAdditionalDays.length,
      strikePotentialDays: strikeForCurrentPayMonth.potentialAdditionalDays.length,
      cia: index === ciaMonth ? cia : 0,
      premiums:
        SUNDAY_ALLOWANCE.monthlyFlat +
        sunday +
        holiday +
        compensated -
        sick.total -
        strikeDeduction +
        mecenatForCurrentPayMonth.grossAmountCents / 100,
      // Le brut du bulletin est la somme de toutes ces lignes : c'est
      // reconstituable exactement, contrairement au net qui suppose de
      // modéliser une dizaine de cotisations. Scindé en deux pour
      // l'estimation du net : le traitement porte la pension civile, les
      // primes n'y sont pas soumises et en gardent bien plus.
      grossFixed: baseSalary + ifse + otherFixed - sick.total - strikeDeduction,
      grossVariable:
        (index === ciaMonth ? cia : 0) +
        SUNDAY_ALLOWANCE.monthlyFlat +
        sunday +
        holiday +
        compensated +
        overtimeForPayMonth.amount +
        mecenatForCurrentPayMonth.grossAmountCents / 100,
      gross:
        baseSalary +
        ifse +
        otherFixed +
        (index === ciaMonth ? cia : 0) +
        SUNDAY_ALLOWANCE.monthlyFlat +
        sunday +
        holiday +
        compensated -
        sick.total -
        strikeDeduction +
        overtimeForPayMonth.amount +
        mecenatForCurrentPayMonth.grossAmountCents / 100,
    };
  }, [
    allowances,
    sickLeaves,
    view,
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
    (!isContractuel && strikeForCurrentPayMonth.totalDeduction !== null);
  const strikeMissing =
    strikeForCurrentPayMonth.days.length + strikeForCurrentPayMonth.automaticAdditionalDays.length && !strikeEstimateReady
      ? [
          isContractuel
            ? "règle de retenue de grève pour une contractuelle"
            : "traitement et indemnité de résidence connus avant la grève",
        ]
      : [];
  const grossEstimateComplete = estimateReadiness.grossReady && strikeEstimateReady;
  const netEstimateMissing = [...estimateReadiness.netMissing, ...strikeMissing];
  const netEstimateComplete = estimateReadiness.netReady && strikeEstimateReady;

  /** Le net estimé du mois affiché : cotisations d'abord, avec deux taux —
   *  le traitement porte la pension civile, les primes non —, puis l'impôt à
   *  part, pour qu'un changement de taux se corrige sans tout recalibrer.
   *  `null` tant que les taux ne sont pas renseignés. */
  const monthNet =
    netEstimateComplete &&
    monthPay &&
    netRatioFixed > 0 &&
    netRatioVariable > 0
      ? (monthPay.grossFixed * (netRatioFixed / 100) +
          monthPay.grossVariable * (netRatioVariable / 100) +
          navigo -
          // Jamais prélevés en décembre, confirmé sur les bulletins de 2024
          // et 2025 : la ligne « Titres repas carte » y est absente.
          (monthPay.index === 11 ? 0 : mealVoucherDeduction)) *
        (1 - (pasRate / 100) * PAS_BASE_ADJUSTMENT)
      : null;

  const leaveStats = useMemo(() => {
    const year = absenceYear;
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
      balances: (["annual", "rtt", "fraction"] as const).map((type) => ({
        type,
        allowance: LEAVE_ALLOWANCES[type],
        manualUsed: manual[`${type}Used` as "annualUsed" | "rttUsed" | "fractionUsed"],
        used: used[type],
        remaining: LEAVE_ALLOWANCES[type] - used[type],
        details: details[type].sort((a, b) => a.date.localeCompare(b.date)),
      })),
      countedOnly,
    };
  }, [periods, absenceYear, group, formProfile?.manualAdjustments]);

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
  const balanceDetailMonths = useMemo(() => {
    const months = MONTHS.map((label, monthIndex) => ({
      key: `${absenceYear}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: `${label} ${absenceYear}`,
      units: 0,
      details: [] as NonNullable<typeof balanceDetail>["details"],
    }));
    for (const detail of balanceDetail?.details ?? []) {
      const month = months[Number(detail.date.slice(5, 7)) - 1];
      if (!month) continue;
      month.units += detail.units;
      month.details.push(detail);
    }
    return months.map((month) => ({
      ...month,
      details: month.details.sort((a, b) => b.date.localeCompare(a.date)),
    }));
  }, [absenceYear, balanceDetail]);

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
          color: "#D3943D",
        });
      }
    }
    return items
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind),
      )
      .slice(0, 8);
  }, [entries, now]);

  const hasAnyNote = useMemo(
    () => Object.values(entries).some((entry) => entry.noteText),
    [entries],
  );

  /** Recherche sur toutes les notes enregistrées, passées comme à venir
      (contrairement à `upcoming`, borné aux 365 prochains jours). */
  const noteSearchResults = useMemo(() => {
    const query = noteQuery.trim().toLowerCase();
    if (!query) return [];
    const items: NoteListItem[] = [];
    const seenGroups = new Set<string>();
    for (const [key, entry] of Object.entries(entries).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!entry.noteText?.toLowerCase().includes(query))
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
        color: "#D3943D",
      });
    }
    return items.slice(0, 50);
  }, [entries, noteQuery]);

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
    const period = periods.find((item) => key >= item.from && key <= item.to);
    const entry = entries[key];
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
    } else if (todayRecoveryMinutes) {
      status =
        todayRecoveryMinutes >= workDayMinutes
          ? `Récupération · ${minutesLabel(todayRecoveryMinutes)}`
          : `${scheduledStatus} + récup. ${minutesLabel(todayRecoveryMinutes)}`;
      tone = "recovery";
    } else if (period && info.kind !== "off") {
      status =
        period.leaveType === "other"
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
        return false;
      }
      return Boolean(entries[candidateKey]?.leave) ||
        Boolean(
          selections[candidateKey] &&
          selectionRemovesAttendance(selections[candidateKey].type),
        ) ||
        periods.some(
          (item) =>
            candidateKey >= item.from &&
            candidateKey <= item.to,
        ) ||
        recoveryUses.some((item) => item.date === candidateKey);
    });
    const nextWorkKind = nextWork ? getDayInfo(nextWork, group).kind : null;
    const nextWorkExceptionalClosure = nextWork
      ? exceptionalClosureFor(dateKey(nextWork))
      : undefined;
    const nextWorkGroups = nextWork
      ? coWorkingGroupsForDate(nextWork, group)
      : [];
    const nextWorkGroupLabel = nextWorkExceptionalClosure
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
        !period &&
        !entry?.leave &&
        todayRecoveryMinutes < workDayMinutes
          ? coWorkingLabel.charAt(0).toUpperCase() + coWorkingLabel.slice(1)
          : "",
      nextWork,
      nextWorkKind,
      nextWorkExceptionalClosure: Boolean(nextWorkExceptionalClosure),
      nextWorkGroupLabel,
    };
  }, [now, group, periods, entries, recoveryUses, selections, workDayMinutes, approvedGrandPalaisUpdates]);

  const importantAlert =
    view.getFullYear() === now.getFullYear() && sundayCarryover
      ? `${sundayCarryover} dimanche${s(sundayCarryover)} en attente sur la paye${
          sundayCarryoverMonth !== undefined && sundayCarryoverYear !== undefined
            ? ` de ${MONTHS[sundayCarryoverMonth]}${
                sundayCarryoverYear !== now.getFullYear()
                  ? ` ${sundayCarryoverYear}`
                  : ""
              }`
            : " d’un prochain mois"
        }`
      : view.getFullYear() === now.getFullYear() && allowances?.holidayPending
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
    openRange,
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
    changeAllowancesMonth,
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
    calendarDeleteMode,
    setCalendarDeleteMode,
    setCalendarDeleteDates,
    ignoreNextDayClick,
    cancelRequest,
    saveStrikeDateDirect,
    notify,
  });
  function changeWorkQuota(nextQuota: WorkQuota) {
    const previousProfile = formProfile;
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
      signature: formProfile?.signature || "",
      status: formProfile?.status,
      workQuota: nextQuota,
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
      changeAllowancesMonth(delta);
      return;
    }
    if (payMonthSlideTimer.current)
      window.clearTimeout(payMonthSlideTimer.current);
    setPayMonthSlide(delta > 0 ? "out-left" : "out-right");
    payMonthSlideTimer.current = window.setTimeout(() => {
      changeAllowancesMonth(delta);
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
    openBlankForm,
    validateAndOpenForm,
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
    setPeriods,
    cancelRequest,
    notify,
    showSuccess: confirm,
    handoffKey: HANDOFF_KEY,
  });

  function renderDay(date: Date, compact = false) {
    const key = dateKey(date);
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
        leavePeriod={periods.find((period) => key >= period.from && key <= period.to)}
        showLeaves={showLeaves}
        showNotes={showNotes}
        inPendingRange={inPendingRange}
        rangeSelecting={rangeSelecting}
        recoveryRangeSelecting={recoveryRangeSelecting}
        noteSelecting={noteSelecting}
        noteColor={noteColor}
        exceptionalClosure={exceptionalClosureFor(key)}
        onClick={() => handleDay(date)}
      />
    );
  }
  function renderNoteItems(items: NoteListItem[]) {
    return (
      <div className="upcoming-list">
        {items.map((item) => (
          <button
            type="button"
            className={`upcoming-item ${item.kind}`}
            key={item.key}
            style={
              item.color
                ? ({ "--item-color": item.color } as React.CSSProperties)
                : undefined
            }
            onClick={() => {
              const date = fromKey(item.date);
              setView(localDate(date.getFullYear(), date.getMonth(), 1));
              setMode("month");
              openDay(date);
            }}
          >
            <i />
            <span>
              {/* Deux personnes peuvent écrire sur la même journée : chaque
                  ligne devient une puce pour qu'elles ne se lisent pas comme
                  une seule phrase. */}
              {item.label.includes("\n") ? (
                <ul className="note-bullets">
                  {keyedNoteLines(item.label).map(({ key, label }) => (
                    <li key={`${item.key}-${key}`}>{label}</li>
                  ))}
                </ul>
              ) : (
                <strong>{item.label}</strong>
              )}
              <small>{item.detail}</small>
            </span>
          </button>
        ))}
      </div>
    );
  }

  const {
    savePayAmount,
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
    view,
    setView,
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

  function openRequestChooser(_origin: "general" | "planning" = "general") {
    setRequestChooser(true);
  }

  function openPlanningRequestMethod(
    kind: RequestKind,
    date?: string,
    requestedType?: SelectionType,
  ) {
    setDayDate(null);
    setPlanningRequestDate(date || null);
    if (kind === "recovery") setPendingRecoveryType("recovery_day");
    if (kind === "leave" || kind === "other" || kind === "strike")
      setPendingLeaveType(
        requestedType ||
          (kind === "other" ? "other" : kind === "strike" ? "strike" : "annual"),
      );
    setPlanningRequestMethod(kind);
  }

  function closePlanningRequestMethod() {
    setPlanningRequestMethod(null);
    setPlanningRequestDate(null);
  }

  function startManualPlanningRequest() {
    const kind = planningRequestMethod;
    const date = planningRequestDate;
    closePlanningRequestMethod();
    if (kind === "recovery") {
      const manualKind =
        pendingRecoveryType === "recovery_day"
          ? "day"
          : pendingRecoveryType === "recovery_half"
            ? "half"
            : pendingRecoveryType === "recovery_holiday"
              ? "holiday"
              : pendingRecoveryType === "recovery_training"
                ? "training"
              : "hours";
      setRecoveryDraft((current) => ({
        ...current,
        date: date || current.date,
        kind: manualKind,
        durationMinutes: manualKind === "half" ? 240 : 480,
        trainingMinutes:
          manualKind === "training"
            ? trainingRecoveryMinutes(workQuota)
            : current.trainingMinutes,
      }));
      setTrainingRecoveryMode("manual");
      setRecoveryRangePrefillDate(date);
      setRecoveryRangeDates([]);
      setRecoveryRangeOpen(true);
      return;
    }
    if (kind === "other" || kind === "strike") {
      if (date) {
        openDay(fromKey(date));
        setDayLeave(true);
        setDayLeaveType(kind === "strike" ? "strike" : "other");
        setLeaveRangeEnabled(true);
        setLeaveRangeFrom(date);
        setLeaveRangeTo(date);
      } else {
        openRange(kind === "strike" ? "strike" : "other");
      }
      return;
    }
    if (date) {
      openRange(pendingLeaveType as LeaveType, date);
      return;
    }
    openRange(pendingLeaveType as LeaveType);
  }

  /** Le volet de vérification d'un bulletin, séparé des primes : on y va pour
   *  contrôler, pas pour consulter. */
  function renderPayslipCheck() {
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
            detail: isContractuel
              ? "impact à vérifier selon le maintien de salaire, les IJSS et la subrogation"
              : "carence et retenue de 10 %",
            amount: isContractuel ? null : -monthPay.sick,
          }
        : null,
      monthPay.strikeDeductedDays || monthPay.strikePotentialDays
        ? {
            key: "strike",
            label: `Grève (${monthPay.strikeDeductedDays} journée${s(monthPay.strikeDeductedDays)} retenue${s(monthPay.strikeDeductedDays)})`,
            detail:
              isContractuel
                ? "règle de retenue à confirmer pour une contractuelle"
                : strikeForCurrentPayMonth.dailyDeduction === null
                  ? "traitement et indemnité de résidence antérieurs à compléter"
                  : strikeForCurrentPayMonth.potentialAdditionalDays.length
                    ? `Attention : ${strikeForCurrentPayMonth.potentialAdditionalDays.length} jour${s(strikeForCurrentPayMonth.potentialAdditionalDays.length)} intermédiaire${s(strikeForCurrentPayMonth.potentialAdditionalDays.length)} à vérifier. Les repos noirs encadrés sont inclus automatiquement ; les autres absences restent hors retenue tant qu’elles ne sont pas confirmées. ${strikeForCurrentPayMonth.exactMonthValues ? "Valeurs exactes du mois." : strikeForCurrentPayMonth.sourcePeriod ? `Dernières valeurs connues : ${strikeForCurrentPayMonth.sourcePeriod}.` : ""}`
                    : `retenue au 1/30 · ${euros(strikeForCurrentPayMonth.dailyDeduction)} brut par jour${strikeForCurrentPayMonth.automaticAdditionalDays.length ? ` · ${strikeForCurrentPayMonth.automaticAdditionalDays.length} repos noir${s(strikeForCurrentPayMonth.automaticAdditionalDays.length)} encadré${s(strikeForCurrentPayMonth.automaticAdditionalDays.length)} inclus` : ""} · ${strikeForCurrentPayMonth.exactMonthValues ? "valeurs exactes du mois" : "dernières valeurs antérieures connues"}`,
            amount:
              !isContractuel && strikeForCurrentPayMonth.totalDeduction !== null
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
      payslipCheck.reading.month === view.getMonth();
    const payslipMonth = comparablePayslip
      ? (payslipCheck.reading.month as number)
      : view.getMonth();
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
          {
            key: "base",
            label: "Traitement de base",
            found: payslipCheck.reading.baseSalary,
            expected: baseSalary,
          },
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
                  found: 1,
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

    const payEstimateDetails = (
      <Suspense fallback={<DeferredSection label="la paie" />}>
      <PayEstimateDetails
        monthIndex={monthPay.index}
        year={allowances.year}
        gross={monthPay.gross}
        grossEstimateComplete={grossEstimateComplete}
        net={monthNet}
        rows={monthPayRows}
        overtime={overtimeForPayMonth}
        workQuota={workQuota}
        mecenat={mecenatForCurrentPayMonth}
        reliability={payReliability}
        onPreviousMonth={() => changeAllowancesMonth(-1)}
        onNextMonth={() => changeAllowancesMonth(1)}
        onToday={goToday}
      />
      </Suspense>
    );
    return (
      <PayslipCheckSection
        payYear={payYear}
        hasPayProfile={Boolean(payProfiles[payYear])}
        helpOpen={showPayslipHelp}
        setHelpOpen={setPayslipHelpOpen}
        missing={missing}
        estimateDetails={payEstimateDetails}
        isContractuel={isContractuel}
        importBusy={payslipImportBusy}
        importMode={payslipImportMode}
        importError={payslipImportError}
        importResult={payslipImportResult}
        onImport={(files, importMode) => void importPayslips(files, importMode)}
        check={payslipCheck}
        checkError={payslipError}
        needsPeriod={payslipNeedsPeriod}
        fallbackMonth={payslipFallbackMonth}
        setFallbackMonth={setPayslipFallbackMonth}
        fallbackYear={payslipFallbackYear}
        setFallbackYear={setPayslipFallbackYear}
        onApplyFallbackPeriod={applyPayslipFallbackPeriod}
        allowances={allowances}
        displayedMonth={view.getMonth()}
        review={payslipReview}
        unplannedCarence={unplannedPayslipCarence}
        resultDetailsOpen={payslipResultDetailsOpen}
        setResultDetailsOpen={setPayslipResultDetailsOpen}
        grossForMonth={grossForMonth}
        baseSalary={baseSalary}
        ifse={ifse}
        overtime={overtimeForPayMonth}
        mecenat={mecenatForCurrentPayMonth}
        onReportMissingSundays={(year, month, missingSundays) =>
          void reportMissingSundays(year, month, missingSundays)
        }
        nextSundayPayout={nextSundayPayoutSlot}
        sundayCarryover={sundayCarryover}
        sundayCarryoverMonth={sundayCarryoverMonth}
        sundayCarryoverYear={sundayCarryoverYear}
        onClearSundayCarryover={() => void clearSundayCarryover()}
        rateSamples={payslipRateSamples}
        rateCalibration={payslipRateCalibration}
        sickLeaves={sickLeaves}
        paySettingsOpen={paySettingsOpen}
        setPaySettingsOpen={setPaySettingsOpen}
        missingFields={netEstimateMissing}
        carenceDay={carenceDay}
        otherFixed={otherFixed}
        cia={cia}
        netRatioFixed={netRatioFixed}
        netRatioVariable={netRatioVariable}
        navigo={navigo}
        mealVoucherDeduction={mealVoucherDeduction}
        pasRate={pasRate}
        payDrafts={payDrafts}
        setPayDrafts={setPayDrafts}
        savingPay={savingPay}
        onSavePayAmount={(field) => void savePayAmount(field)}
        ciaMonth={ciaMonth}
        onSaveCiaMonth={(month) => void saveCiaMonth(month)}
      />
    );
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
      month={view.getMonth()}
      year={view.getFullYear()}
      payPeriodOpen={payPeriodOpen}
      holidayChoiceEditing={holidayChoiceEditing}
      onTogglePayPeriod={() => setPayPeriodOpen((current) => !current)}
      onChangeMonth={changeAllowancesMonth}
      onGoToday={goToday}
      onEditHolidayChoice={setHolidayChoiceEditing}
      onChooseHolidayPay={chooseHolidayPay}
    />
  ) : null;
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
        "input, textarea, select, [role='dialog'], .modal-backdrop, .main-menu-backdrop, .main-menu-drawer, .choice-picker-menu, .month-card",
      )
    ) {
      sectionSwipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    sectionSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function finishSectionSwipe(event: TouchEvent<HTMLElement>) {
    const start = sectionSwipeStartRef.current;
    sectionSwipeStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    const currentIndex = MAIN_SECTION_ORDER.indexOf(homeSection);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextSection = MAIN_SECTION_ORDER[nextIndex];
    if (!nextSection) return;

    setHomeSection(nextSection);
    if (nextSection === "pay") setPayScreen("overview");
    setMainMenuOpen(false);
    setAccountMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      {previewPayEffect === "lightning" ? (
        <PayslipWarningEffect durationMs={15_000} />
      ) : null}
      <AppHeader
        homeSection={homeSection}
        payScreen={payScreen}
        userEmail={userEmail}
        fullName={formProfile?.fullName || ""}
        accountMenuOpen={accountMenuOpen}
        mainMenuOpen={mainMenuOpen}
        checkingAppUpdate={checkingAppUpdate}
        appUpdateAvailable={appUpdateAvailable}
        accountMenuRef={accountMenuRef}
        accountButtonRef={accountButtonRef}
        onToggleAccount={() => setAccountMenuOpen((current) => !current)}
        onOpenDataManagement={() => {
          setAccountMenuOpen(false);
          setDataManagementOpen(true);
        }}
        onDisconnect={() => {
          setAccountMenuOpen(false);
          void disconnect();
        }}
        onOpenMainMenu={() => setMainMenuOpen(true)}
        onCheckForUpdate={() => void checkForAppUpdate()}
      />
      {homeSection === "home" ? (
        <div className="home-view-mode-bar">
          <div className="view-switch" role="group" aria-label="Mode d’affichage">
            <button
              className={mode === "month" ? "active" : ""}
              aria-pressed={mode === "month"}
              onClick={() => setMode("month")}
              type="button"
            >
              Mois
            </button>
            <button
              className={mode === "year" ? "active" : ""}
              aria-pressed={mode === "year"}
              onClick={() => setMode("year")}
              type="button"
            >
              Année
            </button>
          </div>
        </div>
      ) : null}
      <MainMenu
        open={mainMenuOpen}
        homeSection={homeSection}
        onClose={() => setMainMenuOpen(false)}
        onNavigate={(section) => {
          setHomeSection(section);
          if (section === "pay") setPayScreen("overview");
          setMainMenuOpen(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onOpenGuide={() => {
          setMainMenuOpen(false);
          setGuideOpen(true);
        }}
      />

      <ConnectionStatus {...connectionStatus} />

      {guidePromptOpen || guideOpen ? (
        <Suspense fallback={null}>
          <UserGuideDialogs
            guidePromptOpen={guidePromptOpen}
            guideOpen={guideOpen}
            setGuideOpen={setGuideOpen}
            skipGuidePrompt={skipGuidePrompt}
            openGuideFromPrompt={openGuideFromPrompt}
          />
        </Suspense>
      ) : null}

      {homeSection === "home" ? (
        <HomeDashboard
          now={now}
          group={group}
          hasConfiguredGroup={Boolean(formProfile?.group)}
          today={todayOverview}
          totalLeaveRemaining={totalLeaveRemaining}
          remainingWorkedDaysThisYear={remainingWorkedDaysThisYear}
          importantAlert={importantAlert}
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
            setHomeSection("pay");
            setPayScreen(sundayCarryover ? "payslip" : "allowances");
          }}
          onAddNote={beginQuickNote}
        />
      ) : null}

      {homeSection === "leave" ? (
        <Suspense fallback={<DeferredSection label="vos congés et récupérations" />}>
        <LeaveManagementPage
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
          onRequestLeave={() => openRequestChooser("general")}
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
      {homeSection === "pay" && allowances ? (
        <Suspense fallback={<DeferredSection label="votre paie" />}>
        <PayPage
          screen={payScreen}
          month={view.getMonth()}
          year={view.getFullYear()}
          profileOpen={payProfileOpen}
          workQuota={workQuota}
          status={formProfile?.status || "contractuel"}
          workDayMinutes={workDayMinutes}
          netEstimateComplete={netEstimateComplete}
          monthSlide={payMonthSlide}
          allowancesContent={allowancesContent}
          payslipContent={renderPayslipCheck()}
          onScreenChange={setPayScreen}
          onToggleProfile={() => setPayProfileOpen((current) => !current)}
          onWorkQuotaChange={changeWorkQuota}
          onStatusChange={changeStatus}
          onTouchStart={startAllowancesSwipe}
          onTouchEnd={endAllowancesSwipe}
        />
        </Suspense>
      ) : null}

      {homeSection === "pdf" ? (
        <Suspense fallback={<DeferredSection label="vos documents" />}>
        <PdfDownloadPage
          narrowScreen={narrowScreen}
          year={view.getFullYear()}
          group={group}
          showSchoolVacations={showSchoolVacationsOnPdf}
          exporting={pdfExporting}
          onYearChange={(year) => setView(localDate(year, view.getMonth(), 1))}
          onGroupChange={changeGroup}
          onShowSchoolVacationsChange={setShowSchoolVacationsOnPdf}
          onExport={(scope, includeSchoolVacations) =>
            void exportAnnualPlanning(scope, includeSchoolVacations)
          }
        />
        </Suspense>
      ) : null}

      {homeSection === "forms" ? (
        <Suspense fallback={<DeferredSection label="vos formulaires" />}>
          <UsefulFormsSection />
        </Suspense>
      ) : null}
      {homeSection === "program" ? (
        <Suspense fallback={<DeferredSection label="la programmation GP" />}>
          <GrandPalaisProgramSection />
        </Suspense>
      ) : null}
      {homeSection === "contacts" ? (
        <Suspense fallback={<DeferredSection label="vos contacts" />}>
          <UsefulContactsSection initialData={prefetchedContacts || undefined} />
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
        calendarDeleteMode={calendarDeleteMode}
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
        onStartCleanup={startCalendarCleanup}
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

      {noteSelecting && (
        <section
          className="request-panel calendar-request-panel"
          id="note-selection-panel"
          style={{ "--active-color": noteColor } as React.CSSProperties}
        >
          <div className="request-heading">
            <div>
              <span className="step-label">Note en préparation</span>
              <h2>Choisir plusieurs dates</h2>
            </div>
            <button
              className="text-button danger"
              type="button"
              onClick={cancelNoteSelection}
            >
              Annuler
            </button>
          </div>
          <p className="request-help">{noteText}</p>
          <div className="request-bottom">
            <p>
              <strong>{noteDates.length}</strong>{" "}
              {noteDates.length > 1
                ? "dates sélectionnées"
                : "date sélectionnée"}
              . Cliquez sur une date colorée pour la retirer.
            </p>
            <button
              className="validate-button"
              type="button"
              onClick={saveNoteAcrossDates}
              disabled={!noteDates.length || !noteText.trim() || savingDay}
            >
              {savingDay ? "Synchronisation…" : "Enregistrer la note"}
            </button>
          </div>
        </section>
      )}

      {requestKind && (
        <section
          className={`request-panel calendar-request-panel${sickRequest ? " sick-request-panel" : requestKind === "other" ? " other-request-panel" : requestKind === "strike" ? " strike-request-panel" : ""}`}
          id="request-panel"
          style={
            { "--active-color": TYPE_COLORS[activeType] } as React.CSSProperties
          }
        >
          <div className="request-heading">
            <div>
              <span className="step-label">
                {requestKind === "strike" ? "Ajout direct au planning" : "Demande en préparation"}
              </span>
              <h2>
                {requestKind === "leave"
                  ? sickRequest
                    ? "Sélectionnez votre arrêt maladie"
                    : "Sélectionnez vos congés"
                  : requestKind === "other"
                    ? "Sélectionnez vos dates Divers"
                    : requestKind === "strike"
                      ? "Ajoutez une journée de grève"
                    : "Sélectionnez vos récupérations"}
              </h2>
            </div>
            <button
              className="text-button danger"
              type="button"
              onClick={cancelRequest}
            >
              {requestKind === "strike" ? "Fermer" : "Annuler la demande"}
            </button>
          </div>
          {requestKind === "other" ? (
            <div className="request-option-groups other-request-options">
              <section className="request-option-group">
                <h3>Divers</h3>
                <div className="type-tabs" role="group" aria-label="Divers">
                  <button
                    type="button"
                    className="active"
                    style={{ "--type-color": TYPE_COLORS.other } as React.CSSProperties}
                  >
                    {TYPE_LABELS.other}
                    {selectedCounts.other ? <b>{selectedCounts.other}</b> : null}
                  </button>
                </div>
                <p className="request-help">
                  Ces dates seront visibles dans le planning et déduites des jours travaillés, sans effet sur la paie ni sur les soldes de congés.
                </p>
              </section>
            </div>
          ) : requestKind === "strike" ? (
            <div className="request-option-groups strike-request-options">
              <section className="request-option-group">
                <h3>Grève</h3>
                <div className="type-tabs" role="group" aria-label="Grève">
                  <button
                    type="button"
                    className="active"
                    style={{ "--type-color": TYPE_COLORS.strike } as React.CSSProperties}
                  >
                    <i />
                    {TYPE_LABELS.strike}
                    {selectedCounts.strike ? <b>{selectedCounts.strike}</b> : null}
                  </button>
                </div>
                <p className="request-help">
                  Touchez une journée travaillée : elle sera ajoutée immédiatement, sans déduction de congé, avec retenue brute estimée au trentième.
                </p>
              </section>
            </div>
          ) : requestKind === "leave" ? (
            sickRequest ? (
              <div className="request-option-groups sick-request-options">
                <section className="request-option-group">
                  <h3>Arrêt maladie</h3>
                  <div className="type-tabs" role="group" aria-label="Arrêt maladie">
                    <button
                      type="button"
                      className="active"
                      style={{ "--type-color": TYPE_COLORS.sick } as React.CSSProperties}
                    >
                      <i />
                      {TYPE_LABELS.sick}
                      {selectedCounts.sick ? <b>{selectedCounts.sick}</b> : null}
                    </button>
                  </div>
                  <p className="request-help">
                    L’arrêt sera compté dans votre suivi sans diminuer vos droits à congés.
                  </p>
                </section>
              </div>
            ) : (
            <div className="request-option-groups">
              {([
                ["Congés courants", ["annual", "half", "rtt"]],
                ["Autres congés", ["fraction", "childcare", "exceptional"]],
                ["Compte épargne-temps", ["cet"]],
              ] as Array<[string, SelectionType[]]>).map(([label, types]) => (
                <section className="request-option-group" key={label}>
                  <h3>{label}</h3>
                  <div className="type-tabs" role="group" aria-label={label}>
                    {types.map((type) => (
                      <button
                        type="button"
                        className={activeType === type ? "active" : ""}
                        style={{ "--type-color": TYPE_COLORS[type] } as React.CSSProperties}
                        onClick={() => setActiveType(type)}
                        key={type}
                      >
                        <i />
                        {TYPE_LABELS[type]}
                        {selectedCounts[type] ? <b>{selectedCounts[type]}</b> : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            )
          ) : (
            <div className="request-option-groups">
              {([
                ["Récupération à la journée", ["recovery_day", "recovery_half"]],
                ["Autres récupérations", ["recovery_hours", "recovery_holiday", "recovery_training"]],
              ] as Array<[string, SelectionType[]]>).map(([label, types]) => (
                <section className="request-option-group" key={label}>
                  <h3>{label}</h3>
                  <div className="type-tabs" role="group" aria-label={label}>
                    {types.map((type) => (
                      <button
                        type="button"
                        className={activeType === type ? "active" : ""}
                        style={{ "--type-color": TYPE_COLORS[type] } as React.CSSProperties}
                        onClick={() => setActiveType(type)}
                        key={type}
                      >
                        <i />
                        {TYPE_LABELS[type]}
                        {selectedCounts[type] ? <b>{selectedCounts[type]}</b> : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              <p className="request-help">
                Un horaire sera demandé pour les demi-journées, les heures et
                les récupérations de jours fériés.
              </p>
            </div>
          )}
          {requestKind !== "strike" ? (
            <>
          <RequestValidationSummary
            items={selectedList}
            requestKind={requestKind}
            sickRequest={sickRequest}
          />
          <div className="request-bottom">
            <p>
              <strong>{selectedList.length}</strong>{" "}
              {selectedList.length > 1
                ? "dates sélectionnées"
                : "date sélectionnée"}
              . Cliquez sur une date colorée pour la retirer.
            </p>
            <div className="request-actions">
              {requestKind !== "other" && !sickRequest ? (
                <button
                  className="text-button"
                  type="button"
                  onClick={openBlankForm}
                  disabled={savingRequest}
                >
                  Ouvrir le formulaire vierge
                </button>
              ) : null}
              <button
                className="validate-button"
                type="button"
                onClick={validateAndOpenForm}
                disabled={!selectedList.length || savingRequest}
              >
                {savingRequest
                  ? requestKind === "other" || sickRequest
                    ? "Enregistrement…"
                    : "Ouverture du formulaire…"
                  : requestKind === "other"
                    ? "Enregistrer Divers"
                    : sickRequest
                      ? "Enregistrer l’arrêt maladie"
                      : "Valider et remplir le formulaire"}
              </button>
            </div>
          </div>
            </>
          ) : null}
        </section>
      )}

      {recoveryDatePicking ? (
        <section className="request-panel recovery-date-picking-panel" aria-label="Sélection de la date de récupération">
          <div>
            <span className="step-label">Récupération</span>
            <h2>Sélectionnez une date dans le calendrier</h2>
            <p>Le cycle de votre groupe est affiché normalement. Touchez la date souhaitée pour continuer.</p>
          </div>
          <button
            className="text-button danger"
            type="button"
            onClick={() => {
              setRecoveryDatePicking(false);
              setRecoveryDialogOpen(true);
            }}
          >
            Annuler la sélection
          </button>
        </section>
      ) : null}

      <section className="planning-calendar-section" aria-label="Planning et congés">
      <div className="planning-leave-panel">
        <button
          className="primary-action planning-leave-action"
          type="button"
          onClick={() => openRequestChooser("planning")}
        >
          Poser un congé
        </button>
      </div>

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
      </section>
        </>
      ) : null}
      </div>
      {requestChooser && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setRequestChooser(false)
          }
        >
          <section
            className="modal-card request-choice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-choice-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setRequestChooser(false)}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">Poser un congé</span>
            <h2 id="request-choice-title">Que souhaitez-vous poser ?</h2>
            <div className="choice-grid">
              <button
                type="button"
                onClick={() => {
                  setRequestChooser(false);
                  openPlanningRequestMethod("leave");
                }}
              >
                <strong>Un congé</strong>
                <span>Choisissez les dates puis ouvrez le formulaire de demande prérempli.</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequestChooser(false);
                  openPlanningRequestMethod("recovery");
                }}
              >
                <strong>Une récupération</strong>
                <span>Retrouvez le formulaire complet : journée, demi-journée, heures, jour férié ou formation.</span>
              </button>
              <button
                type="button"
                className="sick-leave-choice"
                onClick={() => {
                  setRequestChooser(false);
                  beginRequest("leave", undefined, "sick");
                }}
              >
                <strong>Un arrêt maladie</strong>
                <span>Comptabilisé dans votre suivi et pris en compte dans l’estimation de paie.</span>
              </button>
              <button
                type="button"
                className="other-leave-choice"
                onClick={() => {
                  setRequestChooser(false);
                  beginRequest("other", undefined, "other");
                }}
              >
                <strong>Divers</strong>
                <span>Visible dans le planning et compté dans les jours non travaillés.</span>
              </button>
              <button
                type="button"
                className="strike-leave-choice"
                onClick={() => {
                  setRequestChooser(false);
                  beginRequest("strike", undefined, "strike");
                }}
              >
                <strong>Grève</strong>
                <span>Sans déduction de congé, avec retenue de paie estimée.</span>
              </button>
              <button
                type="button"
                className="cet-leave-choice"
                onClick={() => {
                  setRequestChooser(false);
                  openPlanningRequestMethod("leave", undefined, "cet");
                }}
              >
                <strong>CET</strong>
                <span>Utilisez votre solde CET avec le formulaire de congé classique.</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {planningRequestMethod ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closePlanningRequestMethod()
          }
        >
          <section
            className="modal-card request-choice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-leave-method-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={closePlanningRequestMethod}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">Depuis le planning</span>
            <h2 id="planning-leave-method-title">
              Comment souhaitez-vous enregistrer {planningRequestMethod === "other" ? "ce Divers" : planningRequestMethod === "strike" ? "cette grève" : "cette demande"} ?
            </h2>
            <div className="choice-grid">
              <button
                type="button"
                onClick={() => {
                  const kind = planningRequestMethod;
                  const date = planningRequestDate || undefined;
                  closePlanningRequestMethod();
                  beginRequest(
                    kind,
                    date,
                    kind === "recovery" ? pendingRecoveryType : pendingLeaveType,
                  );
                }}
              >
                <strong>Remplir le formulaire</strong>
                <span>
                  {planningRequestMethod === "other" || planningRequestMethod === "strike"
                    ? "Sélectionnez les dates puis enregistrez-les dans le planning."
                    : "Le parcours normal, avec demande préremplie et archive."}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  startManualPlanningRequest();
                }}
              >
                <strong>Ajouter manuellement au planning</strong>
                <span>
                  {planningRequestMethod === "leave"
                    ? "Ajoutez directement le congé au planning."
                    : planningRequestMethod === "other"
                      ? "Ajoutez directement une ou plusieurs dates Divers."
                      : planningRequestMethod === "strike"
                        ? "Ajoutez directement une ou plusieurs journées de grève."
                      : "Choisissez journée, demi-journée, heures, jour férié ou formation."}
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {groupChooserOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setGroupChooserOpen(false)
          }
        >
          <section
            className="modal-card group-choice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-choice-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setGroupChooserOpen(false)}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">Cycle de travail</span>
            <h2 id="group-choice-title">Choisir mon groupe</h2>
            <p>Le planning est recalculé immédiatement avec le groupe choisi.</p>
            <div className="group-choice-grid">
              {GROUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={group === option.value ? "active" : ""}
                  aria-pressed={group === option.value}
                  onClick={() => {
                    changeGroup(option.value);
                    setGroupChooserOpen(false);
                  }}
                >
                  <span>Groupe</span>
                  <strong>{option.value}</strong>
                  {group === option.value ? <small>Actuel</small> : null}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {dayDate && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setDayDate(null)
          }
        >
          <section
            className="modal-card note-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setDayDate(null)}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">Mon planning</span>
            <h2 id="day-title">
              {quickNoteMode ? "Ajouter une note" : longDate(fromKey(dayDate))}
            </h2>
            {quickNoteMode ? (
              <p>
                Choisissez une date unique ou une période, puis écrivez la note
                qui apparaîtra sur le planning.
              </p>
            ) : (
              <p>
                Congés, arrêts maladie, congés souhaités et notes se posent
                sur cette journée, y compris pendant un jour de repos.
              </p>
            )}
            {!quickNoteMode && (
              <>
                <div className="leave-choices">
                  <button
                        type="button"
                        className={dayLeave ? "leave active" : "leave"}
                        onClick={() =>
                          openPlanningRequestMethod("leave", dayDate)
                        }
                      >
                        <i />
                        Congé
                        <span>{dayLeave ? "Modifier" : "Choisir"}</span>
                      </button>
                      <button
                        type="button"
                        className="recovery"
                        onClick={() =>
                          openPlanningRequestMethod("recovery", dayDate)
                        }
                      >
                        <i />
                        Récupération
                        <span>Choisir</span>
                      </button>
                      <button
                        type="button"
                        className={dayWish ? "wish active" : "wish"}
                        onClick={() => void saveWishDateDirect(dayDate)}
                        disabled={savingDay}
                      >
                        <i />
                        Congé souhaité
                        <span>{dayWish ? "Ajouté" : "Hors période d’ouverture"}</span>
                      </button>
                      <button
                        type="button"
                        className={
                          dayLeave && dayLeaveType === "sick"
                            ? "sick-day active"
                            : "sick-day"
                        }
                        onClick={() => {
                          const date = dayDate;
                          void saveSickDateDirect(date);
                        }}
                      >
                        <i />
                        Maladie
                        <span>
                          {dayLeave && dayLeaveType === "sick" ? "Sélectionné" : "Ajouter"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={
                          dayLeave && dayLeaveType === "other"
                            ? "other-day active"
                            : "other-day"
                        }
                        onClick={() => void saveOtherDateDirect(dayDate)}
                      >
                        <i />
                        Divers
                        <span>Jour non travaillé</span>
                      </button>
                      <button
                        type="button"
                        className={
                          dayLeave && dayLeaveType === "strike"
                            ? "strike-day active"
                            : "strike-day"
                        }
                        onClick={() => void saveStrikeDateDirect(dayDate)}
                        disabled={savingDay}
                      >
                        <i />
                        Grève
                        <span>Retenue estimée</span>
                      </button>
                      <button
                        type="button"
                        className={dayLeave && dayLeaveType === "cet" ? "cet-day active" : "cet-day"}
                        onClick={() => openPlanningRequestMethod("leave", dayDate, "cet")}
                      >
                        <i />
                        CET
                        <span>{dayLeave && dayLeaveType === "cet" ? "Sélectionné" : "Choisir"}</span>
                      </button>
                      <button
                        type="button"
                        className={
                          dayExceptionalClosure
                            ? "closure-day active"
                            : "closure-day"
                        }
                        onClick={() => {
                          if (!dayDate) return;
                          const automaticClosure = grandPalaisExceptionalClosure(
                            dayDate,
                            approvedGrandPalaisUpdates,
                          );
                          void saveDay({
                            closureOverride: dayExceptionalClosure
                              ? automaticClosure
                                ? "open"
                                : ""
                              : "closed",
                          });
                        }}
                        disabled={savingDay}
                      >
                        <i />
                        Fermeture exceptionnelle
                        <span>
                          {dayExceptionalClosure ? "Retirer CLOSED" : "Ajouter CLOSED"}
                        </span>
                      </button>
                </div>
                {entries[dayDate]?.wish &&
                  !dayLeave && (
                    <div className="wish-decision">
                      <p>
                        Congé souhaité, en attente de validation. Il ne compte
                        pas dans votre solde.
                      </p>
                      <div>
                        <button
                          type="button"
                          className="save-button"
                          onClick={() => {
                            setDayWish(false);
                            setDayLeave(true);
                            setLeaveRangeEnabled(true);
                            setLeaveRangeFrom(dayDate);
                            setLeaveRangeTo(dayDate);
                          }}
                        >
                          Valider ce congé
                        </button>
                        <button
                          type="button"
                          className="warning-button"
                          onClick={() => void saveWishDateDirect(dayDate, false)}
                        >
                          Annuler le souhait
                        </button>
                      </div>
                    </div>
                  )}
                {dayLeave &&
                  (["annual", "half", "rtt", "fraction", "childcare", "exceptional", "cet", "strike"] as LeaveType[]).includes(dayLeaveType) && (
                  <div className="leave-type-field">
                    <span>Type de congé</span>
                    <ChoicePicker
                      value={dayLeaveType}
                      options={LEAVE_TYPE_OPTIONS.filter((option) =>
                        ["annual", "half", "rtt", "fraction", "childcare", "exceptional", "cet", "strike"].includes(option.value),
                      )}
                      onChange={setDayLeaveType}
                      ariaLabel="Sélectionner le type de congé"
                      className="leave-type-picker"
                    />
                  </div>
                )}
                {dayLeave &&
                  dayLeaveType === "half" && (
                    <div className="leave-type-field">
                      <span>Moitié de journée</span>
                      <ChoicePicker
                        value={dayHalfMoment}
                        options={HALF_MOMENT_OPTIONS}
                        onChange={setDayHalfMoment}
                        ariaLabel="Choisir le matin ou l’après-midi"
                        className="leave-type-picker"
                      />
                    </div>
                  )}
                {dayHolidayChoiceVisible && (
                  <div className="leave-type-field">
                    <span>Férié travaillé — compensation</span>
                    <ChoicePicker
                      value={dayHolidayPay}
                      options={HOLIDAY_PAY_OPTIONS}
                      onChange={setDayHolidayPay}
                      ariaLabel="Choisir la compensation du jour férié"
                      className="leave-type-picker"
                      placeholder="À décider"
                    />
                    <small className="holiday-pay-hint">
                      {dayHolidayPay
                        ? `${euros(holidayAllowance(baseSalary, dayHolidayPay))}${
                            dayHolidayPay === "recovery"
                              ? " et un jour de récupération"
                              : ""
                          }`
                        : baseSalary
                          ? `Prime seule ${euros(holidayAllowance(baseSalary, "prime"))}, avec récup ${euros(holidayAllowance(baseSalary, "recovery"))}.`
                          : "Renseignez votre traitement de base pour voir les montants."}
                    </small>
                  </div>
                )}
                {(dayLeave || dayPersonalLeave || dayWish) && (
                  <div className="leave-range-box">
                    <button
                      className="separate-date-button"
                      type="button"
                      onClick={beginMultipleDateSelectionFromDay}
                    >
                      <strong>Choisir plusieurs dates</strong>
                      <span>
                        Sélectionnez plusieurs jours, même dans des mois
                        différents
                      </span>
                    </button>
                  </div>
                )}
                {dayStoredPeriods.length > 0 && (
                  <div className="day-stored-periods">
                    <strong>Périodes concernant cette date</strong>
                    {dayStoredPeriods.map((period) => (
                      <article key={period.id}>
                        <i className="leave" />
                        <span>
                          {periodLabel(period.from, period.to)}
                          <small>{leaveTypeLabel(period.leaveType)}</small>
                        </span>
                        <div className="period-direct-actions" role="group" aria-label={`Gérer ${periodLabel(period.from, period.to)}`}>
                          <button
                            className="period-edit-button"
                            type="button"
                            onClick={() => editDayLeavePeriod(period)}
                          >
                            Modifier
                          </button>
                          <button
                            className="period-delete-button"
                            type="button"
                            onClick={() => {
                              setDayDate(null);
                              setDeletingPeriod(period);
                            }}
                          >
                            {period.leaveType === "strike"
                              ? "Supprimer la grève"
                              : "Annuler le congé"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {dayRecoveryUses.length > 0 && (
                  <div className="day-stored-periods day-recovery-details">
                    <strong>Récupérations prises ce jour</strong>
                    {dayRecoveryUses.map((entry) => (
                      <article key={entry.id}>
                        <i className="recovery" />
                        <span>
                          {entry.kind === "training" ? "Formation" : "Récupération"}
                          <small>{minutesLabel(entry.minutes)} prises sur votre solde</small>
                        </span>
                        <div className="period-direct-actions recovery-direct-actions">
                          <button
                            className="period-delete-button"
                            type="button"
                            onClick={() => void deleteRecoveryUse(entry)}
                          >
                            Effacer la récupération
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="note-field-heading">
              <label className="field-label" htmlFor="note-text">
                {quickNoteMode
                  ? "Contenu de la note"
                  : "Rendez-vous ou note"}
              </label>
              {/* Sans note existante, il n'y a rien à compléter : le bouton ne
                  sert qu'à ouvrir une ligne sous ce qui est déjà écrit. */}
              {entries[dayDate]?.noteText && (
                <button
                  className="add-note-line"
                  type="button"
                  onClick={appendNoteLine}
                >
                  Ajouter une note
                </button>
              )}
            </div>
            <textarea
              id="note-text"
              ref={noteFieldRef}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              maxLength={300}
              placeholder="Ex. Dentiste à 15 h…"
            />
            <div className="leave-range-box note-date-choice">
              <button
                className="separate-date-button"
                type="button"
                onClick={beginNoteDateSelection}
              >
                <strong>Choisir le ou les jours</strong>
                <span>
                  Sélectionnez un seul jour ou plusieurs dates, même dans des
                  mois différents
                </span>
              </button>
            </div>
            {entries[dayDate]?.noteText && entries[dayDate].noteUpdatedAt && (
              <p className="note-meta">
                {dateTimeLabel(entries[dayDate].noteUpdatedAt)}
              </p>
            )}
            <p className="note-hint">
              <span className="note-hint-band" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="m6 18 1.2-4.3L16.4 4.5l3.1 3.1-9.2 9.2L6 18Z" />
                  <path d="m14.8 6.1 3.1 3.1" />
                </svg>
              </span>
              Une bande jaune signale la présence d’une note.
            </p>
            <div className="modal-actions">
              {entries[dayDate]?.noteText && (
                <button
                  className="delete-button"
                  type="button"
                  onClick={() => setNoteText("")}
                >
                  {noteGroupId ? "Effacer toute la période" : "Effacer la note"}
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDayDate(null)}
              >
                Annuler
              </button>
              <button
                className="save-button"
                type="button"
                onClick={() => saveDay()}
                disabled={savingDay}
              >
                {savingDay ? "Synchronisation…" : "Enregistrer"}
              </button>
            </div>
          </section>
        </div>
      )}

      {balanceDetail && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setBalanceDetailType(null)
          }
        >
          <section
            className="modal-card balance-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="balance-detail-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setBalanceDetailType(null)}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">
              {balanceDetail.quota ? "Solde" : "Suivi"} {absenceYear}
            </span>
            <h2 id="balance-detail-title">{balanceDetail.title}</h2>
            <div className="balance-detail-summary">
              <strong>
                {(balanceDetail.quota
                  ? balanceDetail.remaining
                  : balanceDetail.used
                ).toLocaleString("fr-FR")}
              </strong>
              <span>
                {balanceDetail.quota
                  ? `jours restants sur ${balanceDetail.allowance} · ${balanceDetail.used.toLocaleString("fr-FR")} déduit`
                  : balanceDetailType === "strike"
                    ? `${balanceDetail.used > 1 ? "journées" : "journée"} de grève · aucun congé déduit`
                    : `${balanceDetail.used > 1 ? "jours" : "jour"} d’arrêt · aucun congé déduit`}
              </span>
            </div>
            <h3>
              {balanceDetail.quota
                ? "Jours déduits"
                : balanceDetailType === "strike"
                  ? "Journées enregistrées"
                  : "Jours d’arrêt"}
            </h3>
            {balanceDetail.quota && balanceDetail.manualUsed > 0 ? (
              <div className="balance-manual-summary">
                <span>
                  <strong>{balanceDetail.manualUsed.toLocaleString("fr-FR")} jour{s(balanceDetail.manualUsed)}</strong>
                  saisi{s(balanceDetail.manualUsed)} sans date
                </span>
                <button type="button" onClick={openManualAdjustments}>Modifier</button>
              </div>
            ) : null}
            <p className="balance-detail-guidance">
              Ouvrez un mois pour consulter les dates enregistrées. Touchez ensuite une date
              pour la gérer depuis sa fiche.
            </p>
            <div className="balance-detail-months">
            {balanceDetailMonths.map((month) => (
              <details className="balance-detail-month" key={month.key}>
                <summary>
                  <span className="balance-detail-month-label">
                    <strong>{month.label}</strong>
                    <small>{month.units.toLocaleString("fr-FR")} jour{s(month.units)}</small>
                  </span>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
                </summary>
                {month.details.length ? (
                  <div className="balance-detail-list">
                  {month.details.map((detail) => (
                    <article
                      key={`${detail.period.id}-${detail.date}`}
                      className={recentBalanceDetailDates.has(detail.date) ? "recent-leave-date" : ""}
                    >
                      <button
                        className="balance-detail-open"
                        type="button"
                        onClick={() => {
                          const date = fromKey(detail.date);
                          setBalanceDetailType(null);
                          setView(localDate(date.getFullYear(), date.getMonth(), 1));
                          setMode("month");
                          openDay(date);
                        }}
                        aria-label={`Ouvrir la fiche du ${longDate(fromKey(detail.date))} pour gérer cette absence`}
                      >
                        <span className="balance-detail-date-copy">
                          <strong>{longDate(fromKey(detail.date))}</strong>
                          <small>
                            {balanceDetailType === "strike"
                              ? (() => {
                                  const date = fromKey(detail.date);
                                  const deduction = isContractuel
                                    ? null
                                    : strikePayEstimate(
                                        periods,
                                        group,
                                        payProfiles,
                                        date.getFullYear(),
                                        date.getMonth(),
                                        { entries, recoveryUses },
                                      ).dailyDeduction;
                                  return deduction === null
                                    ? "Retenue à calculer · voir et gérer"
                                    : `Retenue estimée : −${euros(deduction)} brut · voir et gérer`;
                                })()
                              : "Voir et gérer cette absence"}
                          </small>
                        </span>
                        <span className="balance-detail-value">
                          <strong>
                            {balanceDetail.quota ? "−" : ""}
                            {detail.units.toLocaleString("fr-FR")} jour
                          </strong>
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="m7 4 6 6-6 6" />
                          </svg>
                        </span>
                      </button>
                    </article>
                  ))}
                  </div>
                ) : (
                  <p className="balance-detail-month-empty">Aucune date enregistrée ce mois-ci.</p>
                )}
                {balanceDetailType === "strike" ? (() => {
                  const [strikeYear, strikeMonth] = month.key.split("-").map(Number);
                  return (
                    <StrikeContinuityDetails
                      estimate={strikePayEstimate(
                        periods,
                        group,
                        payProfiles,
                        strikeYear,
                        strikeMonth - 1,
                        { entries, recoveryUses },
                      )}
                    />
                  );
                })() : null}
              </details>
            ))}
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setBalanceDetailType(null)}
              >
                Fermer
              </button>
            </div>
          </section>
        </div>
      )}

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
            durationMinutes: kind === "half" ? 240 : 480,
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
        onArchiveLegacyData={() => void archiveLegacyData()}
        onDeleteAllData={() => void deleteAllUserData()}
      />
      {installationEnabled && installPrompt && (
        <button
          className="install-app-button"
          type="button"
          onClick={installApp}
        >
          Installer l’application
        </button>
      )}
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
