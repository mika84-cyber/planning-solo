import { HomeAdminMessage } from './HomeAdminMessage';
import { clearColleagueGroupsCache } from './colleagueSharingApi';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthScreen } from "./AuthScreen";
import { grandPalaisExceptionalClosure } from "./grandPalaisClosures";
import { resolvePublicDemoAccess } from "./demoAccess";
import { ConnectionStatus } from "./ConnectionStatus";
import { useAuthUiState } from "./useAuthUiState";
import { usePayUiState } from "./usePayUiState";
import { usePayActions } from "./usePayActions";
import { usePayslipVerifications } from "./usePayslipVerifications";
import { usePayProfileValues } from "./usePayProfileValues";
import { useMonthPayEstimate } from "./useMonthPayEstimate";
import { useLeaveBalances } from "./useLeaveBalances";
import { useNoteLists } from "./useNoteLists";
import { usePayMonthNavigation } from "./usePayMonthNavigation";
import { useWorkProfileActions } from "./useWorkProfileActions";
import { usePartnerNoteActions } from "./usePartnerNoteActions";
import { useSectionNavigation } from "./useSectionNavigation";
import { useApplicationStartup } from "./useApplicationStartup";
import { useShellEffects } from "./useShellEffects";
import { useSharedDataPrefetch } from "./useSharedDataPrefetch";
import { useRequestTypeSelection } from "./useRequestTypeSelection";
import { useWorkedDaysOverview } from "./useWorkedDaysOverview";
import { useMecenatDraftCheck } from "./useMecenatDraftCheck";
import { useDayDetailData } from "./useDayDetailData";
import { DemoExpiredScreen } from "./DemoExpiredScreen";
import { scrollWhenReady } from "./scrollWhenReady";

const AdminToolsPanel = lazy(() => import('./AdminToolsPanel').then(module => ({ default: module.AdminToolsPanel })));
// La rubrique Ma paie construit son contenu à part : son morceau n'est
// chargé qu'à son ouverture.
const PaySectionScreen = lazy(() =>
  import("./deferredScreens").then(({ PaySectionScreen: Component }) => ({ default: Component })),
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
import { DeferredSection } from "./DeferredSection";
import {
  EMPTY_MANUAL_ADJUSTMENTS,
  computePayAllowances,
} from "./payAllowances";
import { HomeSectionScreen } from "./HomeSectionScreen";
import { LeaveSectionScreen } from "./LeaveSectionScreen";
import { DocumentsSectionScreen } from "./DocumentsSectionScreen";
import { PlanningWorkspace } from "./PlanningWorkspace";
import { PlanningDialogLayer } from "./PlanningDialogLayer";
import { useProfileAdjustmentActions } from "./useProfileAdjustmentActions";
import {
  AppHeader,
  AdaptiveNavigation,
  MainMenu,
} from "./AppNavigation";
import { PlanningDayCell } from "./PlanningDayCell";
import { exchangeEntryFields, workExchangeForDate } from "./workExchange";
import { requestRecoveryMinutes } from "./RequestValidationSummary";
import { visibleAbsencePeriod } from "./absenceReplacement";
import {
  ColleagueRequestNotice,
  DocumentAnnouncementNotice,
  FeedbackMessenger,
  FeedbackResolutionAlert,
} from "./appSections";
import {
  getCalendar,
  postCalendar,
  postCalendarBatch,
} from "./calendarApi";
import { AppleInstallNotice } from "./AppleInstallNotice";
import { InstallAppNotice } from "./InstallAppNotice";
import {
  emptyEntry,
  fullDayRecoveryMinutes,
  type BalanceType,
  type ManualYearAdjustments,
  type RequestKind,
} from "./appModel";
import { useAnnualPdfExport } from "./useAnnualPdfExport";
import {
  canEnableInstallation,
  useInstallPrompt,
} from "./useInstallPrompt";
import { useConnectionStatus } from "./useConnectionStatus";
import { useModalAccessibility } from "./useModalAccessibility";
import { useRequestArchive } from "./useRequestArchive";
import {
  DEFAULT_WORK_SCHEDULE,
  usableWorkSchedule,
  defaultRecoveryMinutes,
  trainingRecoveryMinutes,
} from "./overtime";
import { useToast } from "./useToast";
import {
  dateKey,
  fromKey,
  localDate,
  sameDate,
  schoolVacationsForZone,
  type CountedOnlyType,
  type SelectionType,
  type SchoolVacation,
} from "./planningLogic";

const HANDOFF_KEY = "planning:form-handoff-v1";


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
        // Le serveur « demo-solo » de l'aperçu ouvre toujours la démo sans compte.
        import.meta.env.VITE_PREVIEW_DEMO === "true" ||
        (import.meta.env.VITE_E2E_DEMO === "true" &&
          localStorage.getItem("planning:e2e-demo-enabled") === "1")));
  const feedbackPreviewRole = import.meta.env.DEV && localTestHost
    ? new URLSearchParams(location.search).get("preview-feedback-role")
    : null;
  const localDemoAdmin = feedbackPreviewRole !== "user";
  const [now, setNow] = useState(() => localDate(2026, 6, 31));
  const [view, setView] = useState(() => localDate(2026, 6, 1));
  const [group, setGroup] = useState(2);
  /** « Choisir un planning » du calendrier ouvre les plannings à imprimer. */
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
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
  // Le statut d'administrateur arrive avec la programmation GP : tant qu'il
  // n'est pas connu, rien de réservé aux invités ne s'affiche.
  const [programAdminKnown, setProgramAdminKnown] = useState(false);
  const installationEnabled = canEnableInstallation(
    authStatus,
    demoMode,
    location.hostname,
  );
  const { installPrompt, installApp } = useInstallPrompt(installationEnabled);
  const calendarData = useCalendarDataState();
  const {
    entries, setEntries, periods, setPeriods, formProfile, setFormProfile,
    payProfiles, setPayProfiles, overtimeEntries, setOvertimeEntries,
    recoveryUses, setRecoveryUses, mecenatEntries, setMecenatEntries,
    partnerEntries, setPartnerEntries, partnerPeriods, partnerSharingStatus,
  } = calendarData;
  const workTimeUi = useWorkTimeUiState();
  const {
    setOvertimeDialogOpen, setSolidarityDialogOpen,
    setRecoveryDialogOpen,
    setRecoveryDatePicking, trainingRecoveryMode,
    setMecenatDialogOpen, setSavingMecenat,
    savingOvertime, setSavingOvertime, overtimeDraft,
    solidarityDraft, setSolidarityDraft, recoveryDraft, setRecoveryDraft,
    mecenatDraft, overtimeSaveInFlightRef, mecenatSaveInFlightRef,
    lastOvertimeSubmissionRef, lastRecoverySubmissionRef, lastMecenatSubmissionRef,
  } = workTimeUi;
  const planningUi = usePlanningUiState();
  const {
    dayDate, setDayDate, setNoteText, noteColor,
    noteSelecting, noteDates,
    dayPersonalLeave,
    setSavingDay,
    rangeSelecting, separateDates, separateWishMoments,
    setRecoveryRangeOpen, recoveryRangeSelecting, setRecoveryRangeSelecting,
    recoveryRangePrefillDate, setRecoveryRangePrefillDate, recoveryRangeDates, setRecoveryRangeDates,
    separatePeople,
    setRequestChooser, requestChooserDate, setRequestChooserDate, directDurationSave, setDirectDurationSave, timeDate,
    requestKind, setRequestKind, setSickRequest,
    selections, setSelections, setTimeDate,
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
  const requestArchive = useRequestArchive(authStatus, isProgramAdmin, userEmail, notify);
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
  const payUi = usePayUiState();
  const {
    payView, setPayView, payScreen, setPayScreen, setPayProfileOpen,
    payslipCheck, setPayslipCheck, setPayslipError,
    setPayslipImportBusy, setPayslipImportError,
    setPayslipImportResult, setPayslipImportMode,
    setPayslipNeedsPeriod, payslipFallbackMonth, setPayslipFallbackMonth,
    payslipFallbackYear, setPayslipFallbackYear, payslipRateSamples, setPayslipRateSamples,
    setPayslipResultDetailsOpen,
    payDrafts, setPayDrafts, setSavingPay,
  } = payUi;
  const appShellUi = useAppShellUiState();
  const {
    homeSection, setHomeSection,
    approvedGrandPalaisUpdates,
    mainMenuOpen, setMainMenuOpen,
    feedbackOpen, setFeedbackOpen,
    noteQuery,
    accountMenuOpen, setAccountMenuOpen, checkingAppUpdate,
    appUpdateAvailable, appUpdatePromptOpen, setAppUpdatePromptOpen,
    setDataManagementOpen, setDataManagementBusy,
    accountMenuRef, accountButtonRef, viewportDebugEnabled, viewportSize,
    showSchoolVacations, schoolZone,
    allowancesSwipeStart,
  } = appShellUi;
  // Fermeture exceptionnelle d'un jour : celle ajoutée ou retirée à la main,
  // sinon celle annoncée par le Grand Palais. Stable tant que ni l'une ni
  // l'autre ne change, pour servir de dépendance aux calculs qui l'utilisent.
  const exceptionalClosureFor = useCallback(
    (key: string) => {
      const override = entries[key]?.closureOverride;
      if (override === "open") return undefined;
      if (override === "closed")
        return { date: key, label: "Fermeture exceptionnelle ajoutée manuellement" };
      return grandPalaisExceptionalClosure(key, approvedGrandPalaisUpdates);
    },
    [entries, approvedGrandPalaisUpdates],
  );
  const feedbackMessaging = useFeedbackMessaging(isProgramAdmin, demoMode, authStatus === "ready");
  const { checkForAppUpdate } = useShellEffects({ authStatus, isProgramAdmin, demoMode, installationEnabled, appShellUi });
  const visibleSchoolVacations = useMemo<SchoolVacation[]>(
    () => showSchoolVacations ? schoolVacationsForZone(schoolZone) : [],
    [schoolZone, showSchoolVacations],
  );
  const monthFirstKey = dateKey(localDate(view.getFullYear(), view.getMonth(), 1));
  const monthLastKey = dateKey(localDate(view.getFullYear(), view.getMonth() + 1, 0));
  const monthSchoolVacations = visibleSchoolVacations.filter(
    ({ from, to }) => from <= monthLastKey && to >= monthFirstKey,
  );
  const { loadCalendar, clearCalendarData } = useApplicationStartup({
    demoMode,
    localDemoAdmin,
    authUi: { authStatus, setAuthStatus, setUserEmail, setIsProgramAdmin, setInviteToken, setLoginEmail, setLoginPassword, setPasswordConfirmation, setAuthError },
    calendarData,
    setNow,
    setView,
    setGroup,
    confirm,
  });
  const {
    deleteMultiplePlanningDates,
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
  useSharedDataPrefetch({
    authStatus, demoMode, publicDemoAccess, localDemoAdmin, setIsProgramAdmin, setProgramAdminKnown, appShellUi,
  });
  // Un souhait couvert ensuite par un congé posé est réalisé : il ne
  // s'affiche plus comme souhait, ni dans le PDF ni dans les choix.
  const wishDates = useMemo(
    () =>
      new Set(
        Object.entries(entries)
          .filter(([key, entry]) => entry.wish && !periods.some((period) => period.from <= key && key <= period.to))
          .map(([key]) => key),
      ),
    [entries, periods],
  );
  // Souhaits en cours de transformation : la fenêtre choisit leur nature.
  const [wishConversionDates, setWishConversionDates] = useState<string[] | null>(null);
  const pendingWishDates = useMemo(
    () => [...wishDates].filter((key) => key >= dateKey(now)).sort(),
    [wishDates, now],
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
  const annualPdfExport = useAnnualPdfExport(
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
  const ignoreNextDayClick = useRef(false);
  const openedNotificationDate = useRef("");
  const noteFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  useEffect(() => {
    if (!dayDate) return;
    // Le champ de note ne s'ouvre qu'à la demande, par « Ajouter une note ».
    setNoteEditorOpen(false);
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

  const openNotificationDay = useEffectEvent((date: Date) => {
    setView(localDate(date.getFullYear(), date.getMonth(), 1));
    openDay(date);
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: le planning (entries) n'est pas lu ici, il redéclenche l'ouverture une fois chargé.
  useEffect(() => {
    if (authStatus !== "ready") return;
    const key = new URLSearchParams(location.search).get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || openedNotificationDate.current)
      return;
    openedNotificationDate.current = key;
    openNotificationDay(fromKey(key));
    history.replaceState({}, "", location.pathname);
  }, [authStatus, entries]);

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
    clearCalendarData,
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
  const selectedList = useMemo(
    () =>
      Object.values(selections).sort((a, b) => a.date.localeCompare(b.date)),
    [selections],
  );
  const selectedCounts = useMemo(
    () =>
      selectedList.reduce(
        (acc, item) => {
          const type = item.type === "half" && (item.halfBalance === "exceptional" || item.halfBalance === "other") ? item.halfBalance : item.type;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [selectedList],
  );
  const { selectRecoveryType, proposeHalfBalance, selectLeaveType } = useRequestTypeSelection({
    planningUi, formProfile, now, periods, group, selectedList,
  });

  const workExchangeUi = useWorkExchangeActions({
    group,
    entries,
    setEntries,
    periods,
    recoveryUses,
    demoMode,
    isExceptionallyClosed: (key) => Boolean(exceptionalClosureFor(key)),
    showSuccess: confirm,
    formProfile,
    userEmail,
  });
  const { openNew: openWorkExchange } = workExchangeUi;


  const payProfileValues = usePayProfileValues({ formProfile, payProfiles, payView, payslipRateSamples });
  const {
    isContractuel, workQuota, workDayMinutes,
    baseSalary, ifse, otherFixed, cia, ciaMonth,
    sundayCarryover, sundayCarryoverYear, sundayCarryoverMonth, sundayCarryoverFromYear, sundayCarryoverFromMonth,
  } = payProfileValues;
  const workedDaysOverview = useWorkedDaysOverview({
    view, now, group, periods, entries, recoveryUses, formProfile, mecenatEntries, overtimeEntries,
    selections, workDayMinutes, exceptionalClosureFor,
  });
  const { mecenatDraftCalculation, mecenatWarnings } = useMecenatDraftCheck({
    mecenatDraft, workQuota, workDayMinutes, group, periods, entries, recoveryUses, mecenatEntries, formProfile, exceptionalClosureFor,
  });

  const monthPayEstimate = useMonthPayEstimate({
    periods, entries, group, now, payView, formProfile, payProfiles,
    recoveryUses, overtimeEntries, mecenatEntries, overtimeDraft, values: payProfileValues,
  });
  const {
    sickLeaves, allowances, recoveryBalance, paidOvertimeForPayPeriod, overtimePayPreview,
  } = monthPayEstimate;
  const recoverySelectionInsufficient = requestKind === "recovery" &&
    requestRecoveryMinutes(selectedList, workQuota) > recoveryBalance.remaining;
  const recoverySelectionIncomplete = requestKind === "recovery" && selectedList.some((item) =>
    item.type.startsWith("recovery_") && requestRecoveryMinutes([item], workQuota) <= 0
  );

  const leaveBalances = useLeaveBalances({
    absenceYear, now, periods, group, manualAdjustments: formProfile?.manualAdjustments,
    selectedList, requestKind, balanceDetailType,
  });
  const {
    totalLeaveRemaining,
    leaveRemainingByType, leaveRemainingByYear, leaveSelectionOverBalance,
    cetPlannedLeaveDays,
  } = leaveBalances;

  const { agnesLeaveDates, upcoming, hasAnyNote, noteSearchResults } = useNoteLists({
    entries, partnerEntries, partnerPeriods, now, noteQuery, showNotes,
  });
  const ownNoteAuthorLabel = partnerSharingStatus !== "disabled" || demoMode
    ? "Mika"
    : formProfile?.fullName.trim().split(/\s+/)[0] || "Moi";

  /* Ce qui manque encore à l'estimation de paie. Ces trois manques étaient
     annoncés à des endroits différents — une alerte pour les dimanches et
     les fériés, une invitation pour le reste. Ils tiennent désormais dans un
     seul message, que l'on peut écarter une fois pour toutes. */
  /* Ce qui manque encore à l'estimation de paie, et surtout : où chaque
     information se renseigne. Un dimanche reporté sur un prochain bulletin
     n'attend rien de personne — il se règle tout seul, et n'a donc pas sa
     place ici. */
  const currentYearPay = payView.getFullYear() === now.getFullYear();
  const missingPayValues = !payProfiles[String(now.getFullYear())];
  // Le formulaire affiche « Temps plein » et « Contractuel » par défaut : tant
  // que rien n'a été confirmé, ce ne sont que des valeurs de repli.
  const missingCalculationProfile = !formProfile?.status || !formProfile?.workQuota;
  const missingHolidayChoices = currentYearPay ? allowances?.holidayPending ?? 0 : 0;

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
    beginWishSelection,
    beginWishConversion,
    chooseWishMoment,
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
    workQuota,
    workSchedule: usableWorkSchedule(formProfile?.workSchedule),
    calendarDeleteMode,
    setCalendarDeleteMode,
    setCalendarDeleteDates,
    ignoreNextDayClick,
    cancelRequest,
    saveStrikeDateDirect,
    notify,
    isExchangeDate: (key) => Boolean(entries[key]?.exchangeId),
    proposeHalfBalance: (key) => proposeHalfBalance(key, Object.values(selections)),
  });
  const payMonthNavigation = usePayMonthNavigation({ payUi, allowancesSwipeStart });
  const { changeGroup, changeStatus, changeWorkQuota, changeWorkSchedule, saveCalculationProfile } = useWorkProfileActions({
    demoMode, group, setGroup, formProfile, setFormProfile, setPayProfileOpen, notify, post: postCalendar,
  });

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
    markMecenatsPaidEarly,
    markOvertimePaidEarly,
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
    saveWorkPost,
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
  const workAccident = useWorkAccidentActions({
    demoMode,
    group,
    periods,
    setPeriods,
    reloadCalendar: loadCalendar,
    notify,
    showSuccess: confirm,
  });
  function cancelRequest() {
    setDirectDurationSave(false);
    setRequestKind(null);
    setSickRequest(false);
    setSelections({});
    setWarningDate(null);
    setTimeDate(null);
  }

  const {
    openManualAdjustments,
    saveManualAdjustments,
    saveCetAccount,
  } = useProfileAdjustmentActions({
    demoMode,
    group,
    absenceYear,
    formProfile,
    setFormProfile,
    manualAdjustmentDraft,
    setManualAdjustmentDraft,
    setManualAdjustmentsOpen,
    setSavingManualAdjustments,
    savingCet,
    setSavingCet,
    setBalanceDetailType,
    notify,
    confirm,
  });



  // Divers posé depuis une case : la durée validée l'enregistre aussitôt ;
  // fermer la fenêtre annule tout.
  const saveDirectDuration = useEffectEvent(() => {
    if (!directDurationSave || timeDate) return;
    setDirectDurationSave(false);
    if (!selectedList.length) cancelRequest();
    else if (requestKind === "other") void validateAndOpenForm();
    else void saveRequestToPlanning();
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: ces trois valeurs déclenchent l'enregistrement, lu par saveDirectDuration.
  useEffect(() => saveDirectDuration(), [directDurationSave, timeDate, selectedList.length]);
  const {
    openBlankForm,
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
    leaveRemainingByYear,
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
    const schoolVacation = visibleSchoolVacations.find(
      ({ from, to }) => key >= from && key <= to,
    );
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
        fullDayRecoveryMinutes={fullDayRecoveryMinutes(date, group, workDayMinutes, usableWorkSchedule(formProfile?.workSchedule))}
        leavePeriod={visibleAbsencePeriod(periods, key)}
        showLeaves={showLeaves}
        showNotes={showNotes}
        inPendingRange={inPendingRange}
        rangeSelecting={rangeSelecting}
        rangePreviewColor={separatePeople.length === 1 && separatePeople[0] === "wish" ? "var(--wish)" : undefined}
        pendingWishMoment={rangeSelecting && separateDates.includes(key) ? separateWishMoments[key] || undefined : undefined}
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
  const { deleteAgnesNote } = usePartnerNoteActions({
    demoMode, partnerEntries, setPartnerEntries, reloadCalendar: loadCalendar, notify, post: postCalendar,
  });

  const payActions = usePayActions({
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
    // La grève s'ajoute d'un toucher : depuis une case, elle est enregistrée
    // aussitôt sur cette date.
    if (kind === "strike" && initialDate) {
      setRequestChooser(false);
      void saveStrikeDateDirect(initialDate);
      return;
    }
    beginRequest(kind, initialDate, requestedType);
  }

  const payslipVerifications = usePayslipVerifications({
    accountId: demoMode ? "demo" : userEmail,
    demoMode,
    formProfile,
    setFormProfile,
    post: postCalendar,
    notify,
  });
  // Le titre d'un mois de la vue Année l'ouvre en grand. On bascule sur la
  // vue Mois plutôt que d'agrandir sur place : c'est elle qui porte la barre
  // d'outils, donc « Poser un congé » et le reste restent accessibles.

  const { startSectionSwipe, finishSectionSwipe, navigateFromShell } = useSectionNavigation({ appShellUi, setPayScreen });

  const dayDetailData = useDayDetailData({ dayDate, dayPersonalLeave, group, periods, entries, recoveryUses, overtimeEntries, exceptionalClosureFor });

  if (publicDemoAccess.expired) return <DemoExpiredScreen />;

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
        updateCallVisible={appUpdateAvailable && !appUpdatePromptOpen}
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
      {/* Les invités dont le navigateur sait installer l'application, et qui
          ne l'ont pas encore fait, se la voient proposer d'un geste. */}
      <InstallAppNotice
        available={Boolean(installationEnabled && installPrompt && programAdminKnown && !isProgramAdmin)}
        onInstall={() => void installApp()}
      />
      <MainMenu
        open={mainMenuOpen}
        onClose={() => setMainMenuOpen(false)}
        onNavigate={(section) => navigateFromShell(section)}
        currentSection={homeSection}
        showInstallAction={demoMode || Boolean(installPrompt)}
        canInstall={Boolean(installationEnabled && installPrompt)}
        onInstall={() => void installApp()}
        onOpenDataManagement={() => {
          setMainMenuOpen(false);
          setDataManagementOpen(true);
        }}
        onOpenFeedback={() => {
          setMainMenuOpen(false);
          setFeedbackOpen(true);
        }}
        isAdmin={isProgramAdmin}
        unreadFeedbackCount={isProgramAdmin ? feedbackMessaging.unreadCount : 0}
      />
      {actualProgramAdmin && guestPreview && <div className="admin-preview-banner" role="status">Aperçu invité · Vos données<button type="button" onClick={() => setGuestPreview(false)}>Quitter l’aperçu</button></div>}
      {isProgramAdmin && adminToolsOpen && <Suspense fallback={<p role="status">Ouverture des outils…</p>}><AdminToolsPanel demoMode={demoMode} onClose={() => setAdminToolsOpen(false)} onPreview={() => { setAdminToolsOpen(false); setGuestPreview(true); }} onChanged={() => { clearColleagueGroupsCache(); setAdminRevision(value => value + 1); }} /></Suspense>}
      {homeSection === 'home' && <HomeAdminMessage
        demoMode={demoMode}
        hideHolidayReminder={isProgramAdmin}
        holidayChoicesPending={(year) => {
          // Les fériés de l'année du rappel encore sans prime ni récup choisie.
          const yearAllowances = computePayAllowances({
            year, today: now, entries, periods, group, baseSalary,
            manualAdjustments: formProfile?.manualAdjustments,
            sundayCarryover, sundayCarryoverYear, sundayCarryoverMonth,
            sundayCarryoverFromYear, sundayCarryoverFromMonth, recoveryUses,
          });
          return { worked: yearAllowances.holidayPending, compensated: yearAllowances.compensated.filter((item) => !item.choice).length };
        }}
        onOpenHolidayChoices={(year) => {
          setHomeSection("pay");
          setPayView(localDate(year, 0, 1));
          setPayScreen("allowances");
          scrollWhenReady("holiday-choices");
        }}
      />}

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
          onExchangeAccepted={(request) => {
            // L'échange accepté : en démo il s'inscrit sur place ; sinon le
            // serveur l'a posé dans le planning, qui se relit.
            if (!demoMode) { void loadCalendar().catch(() => undefined); return; }
            const fields = exchangeEntryFields({
              id: request.id, partnerName: request.fromName, partnerGroup: request.fromGroup,
              agreementDate: request.returnDate, returnDate: request.agreementDate,
            });
            setEntries((current) => {
              const next = { ...current };
              for (const [date, values] of Object.entries(fields)) next[date] = { ...(next[date] || emptyEntry()), ...values };
              return next;
            });
          }}
        />
      </Suspense>

      {homeSection === "home" ? (
        <HomeSectionScreen
          now={now}
          group={group}
          demoMode={demoMode}
          userEmail={userEmail}
          isProgramAdmin={isProgramAdmin}
          formProfile={formProfile}
          entries={entries}
          ownNoteAuthorLabel={ownNoteAuthorLabel}
          overview={{ ...workedDaysOverview, totalLeaveRemaining, upcoming, hasAnyNote, noteSearchResults }}
          setup={{ missingCalculationProfile, missingHolidayChoices, missingPayValues }}
          shell={appShellUi}
          pay={payUi}
          actions={{ setView, openDay, beginQuickNote, deleteMultiplePlanningDates, deleteAgnesNote }}
        />
      ) : null}

      {homeSection === "leave" ? (
        <LeaveSectionScreen
          now={now}
          group={group}
          isProgramAdmin={isProgramAdmin}
          savingCet={savingCet}
          calendar={calendarData}
          balances={{ ...leaveBalances, absenceYear, setAbsenceYear, setBalanceDetailType }}
          recovery={monthPayEstimate}
          workTime={workTimeUi}
          archive={requestArchive}
          shell={appShellUi}
          pay={payUi}
          actions={{
            openRequestChooser, openBlankForm, beginRequest, openManualAdjustments, saveCetAccount,
            deleteOvertimeEntry, deleteRecoveryUse, deleteMecenatEntry,
          }}
        />
      ) : null}
      {homeSection === "pay" && allowances ? (
        <Suspense fallback={<DeferredSection label="votre paie" />}>
        <PaySectionScreen
          payUi={payUi}
          payActions={payActions}
          profile={payProfileValues}
          estimate={monthPayEstimate}
          allowances={allowances}
          calendar={calendarData}
          payslipVerifications={payslipVerifications}
          navigation={payMonthNavigation}
          holidayChoiceEditing={holidayChoiceEditing}
          onEditHolidayChoice={setHolidayChoiceEditing}
          actions={{
            markMecenatsPaidEarly, markOvertimePaidEarly,
            changeWorkQuota, changeWorkSchedule, changeStatus, saveCalculationProfile, openWorkExchange,
          }}
        />
        </Suspense>
      ) : null}

      <DocumentsSectionScreen
        now={now}
        group={group}
        demoMode={demoMode}
        userEmail={userEmail}
        isProgramAdmin={isProgramAdmin}
        guestPreview={guestPreview}
        adminRevision={adminRevision}
        shell={appShellUi}
        calendar={calendarData}
        workDayMinutes={workDayMinutes}
        exceptionalClosureFor={exceptionalClosureFor}
        workAccident={workAccident}
      />

      <PlanningWorkspace
        now={now}
        group={group}
        view={view}
        setView={setView}
        showCalendarWorkspace={showCalendarWorkspace}
        workQuota={workQuota}
        workedDays={workedDaysOverview}
        monthSchoolVacations={monthSchoolVacations}
        shell={appShellUi}
        planning={planningUi}
        workTime={workTimeUi}
        request={{
          selectedList, selectedCounts, leaveRemainingByType, leaveRemainingByYear, leaveSelectionOverBalance,
          recoveryBalance, recoverySelectionInsufficient, recoverySelectionIncomplete,
          cancelRequest, selectLeaveType, selectRecoveryType, validateAndOpenForm, saveRequestToPlanning,
        }}
        cleanup={{
          calendarDeleteMode, calendarDeleteDates, deletingMultipleDates,
          startCalendarCleanup, cancelCalendarCleanup, deleteMultiplePlanningDates,
        }}
        pdf={{ pdfDialogOpen, setPdfDialogOpen, ...annualPdfExport }}
        exchange={workExchangeUi}
        renderDay={renderDay}
        actions={{
          openRequestChooser, chooseWishMoment, cancelRangeSelection, cancelNoteSelection, goToday, startMonthSwipe, endMonthSwipe,
          cancelRecoveryRangeSelection, saveRecoveryRangeDates, saveNoteAcrossDates, saveSeparateLeaveDates,
        }}
      />
      <PlanningDialogLayer
        now={now}
        group={group}
        demoMode={demoMode}
        absenceYear={absenceYear}
        ownNoteAuthorLabel={ownNoteAuthorLabel}
        setView={setView}
        calendar={calendarData}
        planning={planningUi}
        shell={appShellUi}
        exchange={workExchangeUi}
        balances={{ ...leaveBalances, recoveryBalance, balanceDetailType, setBalanceDetailType }}
        wishes={{ wishDates, pendingWishDates, wishConversionDates, setWishConversionDates }}
        day={{ ...dayDetailData, noteEditorOpen, setNoteEditorOpen, noteFieldRef, appendNoteLine }}
        pay={payProfileValues}
        actions={{
          openDay, beginWishSelection, beginWishConversion, beginMultipleDateSelectionFromDay, beginNoteDateSelection,
          saveWishDateDirect, saveDay, saveWorkPost, editDayLeavePeriod, deleteRecoveryUse, deleteOvertimeEntry,
          deleteAgnesNote, openManualAdjustments, changeGroup, openRequestChooser, beginChosenRequest,
        }}
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
        workSchedule={usableWorkSchedule(formProfile?.workSchedule) ?? DEFAULT_WORK_SCHEDULE}
        mecenatCalculation={mecenatDraftCalculation}
        mecenatWarnings={mecenatWarnings}
        overtimePayPreview={overtimePayPreview}
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
