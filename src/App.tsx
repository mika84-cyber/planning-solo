import { useEffect, useMemo, useRef, useState } from "react";
import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
} from "@netlify/identity";
import { ChoicePicker } from "./ChoicePicker";
import { AuthScreen } from "./AuthScreen";
import { ConnectionStatus } from "./ConnectionStatus";
import { DataManagementDialog } from "./DataManagementDialog";
import {
  CalendarCleanupPanel,
  CalendarCleanupTrigger,
} from "./CalendarCleanup";
import { LeaveBalancesSection } from "./LeaveBalancesSection";
import { PayEstimateDetails } from "./PayEstimateDetails";
import { ManualAdjustmentsDialog, RangeLeaveDialog } from "./LeaveDialogs";
import { MonthCalendar, NotesPanelContent } from "./PlanningView";
import { RequestValidationSummary } from "./RequestValidationSummary";
import {
  DeletePeriodDialog,
  MessageDialog,
  NonWorkingDayWarningDialog,
  SuccessToast,
  TimeSelectionDialog,
} from "./PlanningDialogs";
import {
  MecenatDialog,
  OvertimeDialog,
  RecoveryUseDialog,
  SolidarityHoursDialog,
} from "./WorkTimeDialogs";
import {
  CalendarApiError,
  calendarErrorMessage,
  getCalendar,
  postCalendar,
  postCalendarBatch,
  postCalendarPeriodsVerified,
} from "./calendarApi";
import {
  HOLIDAY_PAY_OPTIONS,
  PAY_STATUS_OPTIONS,
  dayCountLabel,
  emptyEntry,
  euros,
  notePeriodFor,
  rangeKeys,
  workedDayCount,
  type AuthStatus,
  type BalanceType,
  type Entries,
  type FormProfile,
  type LeavePeriod,
  type ManualYearAdjustments,
  type NoteListItem,
  type PayProfile,
  type PayStatus,
  type RequestKind,
  type SelectedDay,
  type SharedEntry,
  type ViewMode,
} from "./appModel";
import { useAnnualPdfExport } from "./useAnnualPdfExport";
import { useInstallPrompt } from "./useInstallPrompt";
import { useConnectionStatus } from "./useConnectionStatus";
import { useModalAccessibility } from "./useModalAccessibility";
import { archivedRequestDate, useRequestArchive } from "./useRequestArchive";
import {
  calculateNetRatios,
  defaultNetRatiosForPeriod,
  extractPayslipTokens,
  inspectNetRatioCalibration,
  payCalibrationRegime,
  readPayslip,
  readingsForCalibrationRegime,
  type PayCalibrationRegime,
  type PayslipReading,
} from "./payslip";
import { summarizePayslipReview } from "./payslipReview";
import {
  payEstimateReadiness,
  type PayEstimateField,
} from "./payEstimate";
import {
  MECENAT_REGULATORY_RATES,
  calculateMecenatVacation,
  mecenatForPayMonth,
  type MecenatEntry,
} from "./mecenat";
import {
  WORK_QUOTA_OPTIONS,
  allocateRecoveryUses,
  calculatePaidOvertime,
  dailyMinutesForQuota,
  holidayRecoveryEntries,
  minutesLabel,
  monthlyRecoveryBalance,
  nextPayPeriod,
  recoveryRequestMinutes,
  splitOvertimeRange,
  type OvertimeDisposition,
  type OvertimeEntry,
  type RecoveryUse,
  type RecoveryRequestType,
  type WorkQuota,
} from "./overtime";
import { useToast } from "./useToast";
import { createClientId } from "./clientId";
import {
  COUNTED_ONLY_TYPES,
  DAY_LABELS,
  GROUP_OPTIONS,
  HALF_MOMENT_OPTIONS,
  LEAVE_ALLOWANCES,
  LEAVE_TYPE_OPTIONS,
  MONTHS,
  MONTH_OPTIONS,
  RESIDENCE_ALLOWANCE_RATE,
  SUNDAY_ALLOWANCE,
  SUNDAY_TIERS,
  sickLeaveDeduction,
  sundayTierFor,
  holidayAllowance,
  holidayPayslip,
  sundayAllowance,
  sundayPayslip,
  unpaidSundays,
  wasPompidouHolidayWorked,
  yearThirdFor,
  yearThirdRange,
  YEAR_THIRDS,
  TYPE_COLORS,
  TYPE_LABELS,
  YEAR_OPTIONS,
  applyManualSundayLeave,
  addDays,
  coWorkingGroupsForDate,
  dateKey,
  dateTimeLabel,
  dayNumber,
  fromKey,
  getDayInfo,
  groupConsecutive,
  halfMomentFromStart,
  leaveTypeLabel,
  s,
  typeLabelFor,
  localDate,
  longDate,
  monthDays,
  multiDatePersonLabel,
  nextAttendanceDay,
  periodLabel,
  sameDate,
  shortDate,
  type CountedOnlyType,
  type HalfMoment,
  type HolidayPay,
  type LeaveType,
  type MultiDatePerson,
  type SelectionType,
} from "./planningLogic";

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

function payProfileFromApi(value: any): PayProfile {
  const eurosFromCents = (field: unknown) =>
    typeof field === "number" ? field / 100 : undefined;
  return {
    baseSalary: eurosFromCents(value?.base_salary_cents),
    residenceAllowance: eurosFromCents(value?.residence_allowance_cents),
    ifse: eurosFromCents(value?.ifse_cents),
    carenceDay: eurosFromCents(value?.carence_cents),
    otherFixed: eurosFromCents(value?.other_fixed_cents),
    cia: eurosFromCents(value?.cia_cents),
    ciaMonth: typeof value?.cia_month === "number" ? value.cia_month : undefined,
    netRatioFixed: eurosFromCents(value?.net_ratio_fixed_bp),
    netRatioVariable: eurosFromCents(value?.net_ratio_variable_bp),
    netRatioRegime:
      value?.net_ratio_regime === "pre-culture-psc" ||
      value?.net_ratio_regime === "culture-psc"
        ? value.net_ratio_regime
        : undefined,
    navigo: eurosFromCents(value?.navigo_cents),
    mealVoucherDeduction: eurosFromCents(
      value?.meal_voucher_deduction_cents,
    ),
    pasRate: eurosFromCents(value?.pas_rate_bp),
  };
}

function manualAdjustmentsFromApi(value: unknown) {
  if (!value || typeof value !== "object")
    return {} as Record<string, ManualYearAdjustments>;
  const numberOrZero = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate)
      ? Math.max(0, candidate)
      : 0;
  return Object.fromEntries(
    Object.entries(value).map(([year, raw]) => {
      const item = (raw || {}) as Record<string, unknown>;
      return [
        year,
        {
          annualUsed: numberOrZero(item.annual_used),
          rttUsed: numberOrZero(item.rtt_used),
          fractionUsed: numberOrZero(item.fraction_used),
          sundayLeaveJanJun: numberOrZero(item.sunday_leave_jan_jun),
          sundayLeaveJulSep: numberOrZero(item.sunday_leave_jul_sep),
          sundayLeaveOctNov: numberOrZero(item.sunday_leave_oct_nov),
          sundayLeaveDec: numberOrZero(item.sunday_leave_dec),
        },
      ];
    }),
  );
}

export default function Home() {
  useModalAccessibility();
  const connectionStatus = useConnectionStatus();
  // Cette option n'est activée que dans une compilation de démonstration
  // séparée. Elle reste donc désactivée dans la version de production.
  const demoMode =
    new URLSearchParams(location.search).has("demo") &&
    (import.meta.env.DEV || import.meta.env.VITE_PUBLIC_DEMO === "true");
  const [now, setNow] = useState(() => localDate(2026, 6, 31));
  const [view, setView] = useState(() => localDate(2026, 6, 1));
  const [group, setGroup] = useState(2);
  const [mode, setMode] = useState<ViewMode>("month");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [userEmail, setUserEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const { installPrompt, installApp } = useInstallPrompt();
  const [entries, setEntries] = useState<Entries>({});
  const [periods, setPeriods] = useState<LeavePeriod[]>([]);
  const [formProfile, setFormProfile] = useState<FormProfile | null>(null);
  const [payProfiles, setPayProfiles] = useState<Record<string, PayProfile>>({});
  const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntry[]>([]);
  const [recoveryUses, setRecoveryUses] = useState<RecoveryUse[]>([]);
  const [mecenatEntries, setMecenatEntries] = useState<MecenatEntry[]>([]);
  const [overtimeDialogOpen, setOvertimeDialogOpen] = useState(false);
  const [solidarityDialogOpen, setSolidarityDialogOpen] = useState(false);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [overtimeHistoryOpen, setOvertimeHistoryOpen] = useState(false);
  const [mecenatDialogOpen, setMecenatDialogOpen] = useState(false);
  const [mecenatHistoryOpen, setMecenatHistoryOpen] = useState(false);
  const [savingMecenat, setSavingMecenat] = useState(false);
  const [savingOvertime, setSavingOvertime] = useState(false);
  const [overtimeDraft, setOvertimeDraft] = useState({
    date: dateKey(new Date()),
    start: "18:00",
    end: "20:00",
    disposition: "paid" as OvertimeDisposition,
  });
  const [solidarityDraft, setSolidarityDraft] = useState({
    hours: "",
    minutes: "0",
  });
  const [recoveryDraft, setRecoveryDraft] = useState({
    date: dateKey(new Date()),
    kind: "hours" as "hours" | "half" | "day" | "holiday",
    hours: "2",
    minutes: "0",
    start: "",
  });
  const [mecenatDraft, setMecenatDraft] = useState({
    date: dateKey(new Date()),
    start: "19:00",
    end: "00:00",
  });
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState("#D3943D");
  const [noteGroupId, setNoteGroupId] = useState("");
  const [noteSelecting, setNoteSelecting] = useState(false);
  const [noteDates, setNoteDates] = useState<string[]>([]);
  const [dayLeave, setDayLeave] = useState(false);
  const [dayPersonalLeave, setDayPersonalLeave] = useState(false);
  const [dayWish, setDayWish] = useState(false);
  const [dayLeaveType, setDayLeaveType] = useState<LeaveType>("annual");
  const [dayHalfMoment, setDayHalfMoment] =
    useState<HalfMoment>("morning");
  const [dayHolidayPay, setDayHolidayPay] = useState<HolidayPay | "">("");
  const [leaveRangeEnabled, setLeaveRangeEnabled] = useState(false);
  const [leaveRangeFrom, setLeaveRangeFrom] = useState("");
  const [leaveRangeTo, setLeaveRangeTo] = useState("");
  const [savingDay, setSavingDay] = useState(false);
  const [showLeaves, setShowLeaves] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeLeaveType, setRangeLeaveType] = useState<LeaveType>("annual");
  const [rangeHalfMoment, setRangeHalfMoment] = useState<HalfMoment>("morning");
  const [rangeSelecting, setRangeSelecting] = useState(false);
  const [separateDates, setSeparateDates] = useState<string[]>([]);
  const [separatePeople, setSeparatePeople] = useState<MultiDatePerson[]>([]);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingLegacyPeriod, setEditingLegacyPeriod] =
    useState<LeavePeriod | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState<LeavePeriod | null>(
    null,
  );
  const [savingRange, setSavingRange] = useState(false);
  const [requestChooser, setRequestChooser] = useState(false);
  const [requestOrigin, setRequestOrigin] = useState<"general" | "planning">("general");
  const [planningRequestMethod, setPlanningRequestMethod] =
    useState<RequestKind | null>(null);
  const [planningRequestDate, setPlanningRequestDate] = useState<string | null>(
    null,
  );
  const [recoveryTypeChooser, setRecoveryTypeChooser] = useState<{
    origin: "general" | "planning";
    date: string | null;
  } | null>(null);
  const [pendingRecoveryType, setPendingRecoveryType] =
    useState<SelectionType>("recovery_day");
  const [pendingLeaveType, setPendingLeaveType] =
    useState<SelectionType>("annual");
  const [requestKind, setRequestKind] = useState<RequestKind | null>(null);
  const [sickRequest, setSickRequest] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [activeType, setActiveType] = useState<SelectionType>("annual");
  const [selections, setSelections] = useState<Record<string, SelectedDay>>({});
  const [timeDate, setTimeDate] = useState<string | null>(null);
  const [timeStart, setTimeStart] = useState("09:15");
  const [timeEnd, setTimeEnd] = useState("13:00");
  const [warningDate, setWarningDate] = useState<string | null>(null);
  const {
    message,
    notify,
    dismiss,
    successMessage,
    confirm,
    dismissSuccess,
  } = useToast();
  const {
    archiveOpen,
    setArchiveOpen,
    archivedRequests,
    openArchivedRequest,
    deleteArchivedRequest,
  } = useRequestArchive(authStatus, "mika", notify);
  const overtimeSaveInFlightRef = useRef(false);
  const mecenatSaveInFlightRef = useRef(false);
  const lastOvertimeSubmissionRef = useRef({ key: "", at: 0 });
  const lastRecoverySubmissionRef = useRef({ key: "", at: 0 });
  const lastMecenatSubmissionRef = useRef({ key: "", at: 0 });
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
  const [manualAdjustmentDraft, setManualAdjustmentDraft] = useState<
    Record<keyof ManualYearAdjustments, string>
  >(() =>
    Object.fromEntries(
      Object.keys(EMPTY_MANUAL_ADJUSTMENTS).map((key) => [key, "0"]),
    ) as Record<keyof ManualYearAdjustments, string>,
  );
  const [payScreen, setPayScreen] = useState<
    "overview" | "allowances" | "payslip"
  >("overview");
  const [payProfileOpen, setPayProfileOpen] = useState(false);
  const [payPeriodOpen, setPayPeriodOpen] = useState(false);
  const [payMonthSlide, setPayMonthSlide] = useState<
    "" | "out-left" | "out-right" | "in-left" | "in-right"
  >("");
  const payMonthSlideTimer = useRef<number | null>(null);
  const [payslipCheck, setPayslipCheck] = useState<{
    name: string;
    reading: PayslipReading;
  } | null>(null);
  const [payslipError, setPayslipError] = useState("");
  const [payslipImportBusy, setPayslipImportBusy] = useState(false);
  const [payslipImportError, setPayslipImportError] = useState("");
  const [payslipImportResult, setPayslipImportResult] = useState<{
    applied: Array<{ label: string; value: string }>;
    missing: string[];
    adjustment?: string;
  } | null>(null);
  const [payslipImportMode, setPayslipImportMode] = useState<
    "verify" | "calibrate" | null
  >(null);
  const [payslipNeedsPeriod, setPayslipNeedsPeriod] = useState(false);
  const [payslipFallbackMonth, setPayslipFallbackMonth] = useState(0);
  const [payslipFallbackYear, setPayslipFallbackYear] = useState(2026);
  // Les PDF ne sont jamais conservés. On garde uniquement leurs montants
  // extraits en mémoire, le temps de réunir assez de mois pour séparer le
  // taux du traitement de celui des primes. Un rechargement efface tout.
  const [payslipRateSamples, setPayslipRateSamples] = useState<
    Array<{ name: string; reading: PayslipReading }>
  >([]);
  // Repliés dès que les champs essentiels sont déjà remplis : utile une fois
  // pour comprendre et importer, plus après. `true` force l'affichage même
  // dans ce cas — posé manuellement, ou automatiquement après un import.
  const [payslipHelpOpen, setPayslipHelpOpen] = useState(false);
  const [payslipResultDetailsOpen, setPayslipResultDetailsOpen] =
    useState(false);
  const [paySettingsOpen, setPaySettingsOpen] = useState(false);
  const [payEstimateDetailsOpen, setPayEstimateDetailsOpen] = useState(false);
  const [payDrafts, setPayDrafts] = useState({
    baseSalary: "",
    ifse: "",
    carenceDay: "",
    otherFixed: "",
    cia: "",
    netRatioFixed: "",
    netRatioVariable: "",
    navigo: "",
    mealVoucherDeduction: "",
    pasRate: "",
  });
  const [savingPay, setSavingPay] = useState<
    | "baseSalary"
    | "ifse"
    | "carenceDay"
    | "otherFixed"
    | "cia"
    | "netRatioFixed"
    | "netRatioVariable"
    | "navigo"
    | "mealVoucherDeduction"
    | "pasRate"
    | null
  >(null);
  const [workedDaysOpen, setWorkedDaysOpen] = useState(false);
  const workedDaysRef = useRef<HTMLDivElement | null>(null);
  const [quickNoteMode, setQuickNoteMode] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [homeSection, setHomeSection] = useState<
    "home" | "leave" | "pay" | "pdf"
  >("home");
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [guidePromptOpen, setGuidePromptOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guidePromptCheckedRef = useRef(false);
  const [groupChooserOpen, setGroupChooserOpen] = useState(false);
  const [noteQuery, setNoteQuery] = useState("");
  // « Écran fermé » : certaines briques se replient pour ne pas occuper tout
  // l'écran. Au-dessus de ce seuil elles restent dépliées en permanence.
  const [narrowScreen, setNarrowScreen] = useState(
    () => window.matchMedia("(max-width: 720px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setNarrowScreen(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  const [dataManagementBusy, setDataManagementBusy] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
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
  }, [authStatus, userEmail]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setAccountMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      accountButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [accountMenuOpen]);
  useEffect(() => {
    if (!workedDaysOpen) return;
    const close = (event: MouseEvent) => {
      if (!workedDaysRef.current?.contains(event.target as Node))
        setWorkedDaysOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWorkedDaysOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [workedDaysOpen]);
  // Repère temporaire pour calibrer les breakpoints sur les vrais appareils (?debug=1).
  const [viewportDebugEnabled] = useState(
    () => new URLSearchParams(location.search).has("debug"),
  );
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
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
  const [showSchoolVacationsOnPdf, setShowSchoolVacationsOnPdf] =
    useState(false);
  const { pdfExporting, exportAnnualPlanning } = useAnnualPdfExport(
    view,
    group,
    periods,
    wishDates,
    notify,
  );
  const [calendarSlide, setCalendarSlide] = useState<
    "" | "out-left" | "out-right" | "in-left" | "in-right"
  >("");
  const monthRefs = useRef<Record<number, HTMLElement | null>>({});
  const monthSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const allowancesSwipeStart = useRef<{ x: number; y: number } | null>(null);
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

  useEffect(() => {
    const frame = requestAnimationFrame(async () => {
      const actualToday = new Date();
      setNow(actualToday);
      setView(localDate(actualToday.getFullYear(), actualToday.getMonth(), 1));
      if (demoMode) {
        try {
          const raw = localStorage.getItem("planning:demo-completed-request-v1");
          const completed = raw ? JSON.parse(raw) : null;
          if (completed?.requestId) {
            if (completed.requestKind === "recovery") {
              const quota: WorkQuota = completed.profile?.workQuota || "full";
              const recoverySelections = [
                ...(completed.periods || []).flatMap((item: any) =>
                  item.type === "recovery_day"
                    ? rangeKeys(item.from, item.to || item.from).map((date) => ({
                        date,
                        type: "recovery_day" as RecoveryRequestType,
                        start: "",
                        end: "",
                      }))
                    : [],
                ),
                ...(completed.timed || [])
                  .filter((item: any) =>
                    ["recovery_half", "recovery_hours", "recovery_holiday"].includes(item.type),
                  )
                  .map((item: any) => ({
                    date: item.date,
                    type: item.type as RecoveryRequestType,
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
                ...(completed.periods || []).map((item: any, index: number) => ({
                  id: `${completed.requestId}-${index + 1}`,
                  from: item.from,
                  to: item.to || item.from,
                  leaveType: item.type,
                  group: Number(completed.group),
                  updatedAt: new Date().toISOString(),
                })),
                ...(completed.timed || [])
                  .filter((item: any) => item.type === "half")
                  .map((item: any, index: number) => ({
                    id: `${completed.requestId}-timed-${index + 1}`,
                    from: item.date,
                    to: item.date,
                    leaveType: "half",
                    halfMoment: halfMomentFromStart(item.start || "13:30"),
                    group: Number(completed.group),
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
    let data: any;
    try {
      data = await getCalendar<any>();
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 401) {
        setAuthStatus("guest");
        return;
      }
      throw error;
    }
    setUserEmail(data.email || "Compte connecté");
    const syncedProfile: FormProfile | null = data.form_profile
      ? {
          fullName: data.form_profile.full_name || "",
          group: data.form_profile.group || "",
          signature: data.form_profile.signature || "",
          status:
            data.form_profile.status === "contractuel"
              ? "contractuel"
              : "fonctionnaire",
          workQuota:
            data.form_profile.work_quota === "half" ||
            data.form_profile.work_quota === "three_quarters"
              ? data.form_profile.work_quota
              : "full",
          // Stockés en centimes côté serveur pour éviter les arrondis.
          baseSalary:
            typeof data.form_profile.base_salary_cents === "number"
              ? data.form_profile.base_salary_cents / 100
              : undefined,
          residenceAllowance:
            typeof data.form_profile.residence_allowance_cents === "number"
              ? data.form_profile.residence_allowance_cents / 100
              : undefined,
          ifse:
            typeof data.form_profile.ifse_cents === "number"
              ? data.form_profile.ifse_cents / 100
              : undefined,
          carenceDay:
            typeof data.form_profile.carence_cents === "number"
              ? data.form_profile.carence_cents / 100
              : undefined,
          otherFixed:
            typeof data.form_profile.other_fixed_cents === "number"
              ? data.form_profile.other_fixed_cents / 100
              : undefined,
          cia:
            typeof data.form_profile.cia_cents === "number"
              ? data.form_profile.cia_cents / 100
              : undefined,
          ciaMonth:
            typeof data.form_profile.cia_month === "number"
              ? data.form_profile.cia_month
              : undefined,
          netRatioFixed:
            typeof data.form_profile.net_ratio_fixed_bp === "number"
              ? data.form_profile.net_ratio_fixed_bp / 100
              : undefined,
          netRatioVariable:
            typeof data.form_profile.net_ratio_variable_bp === "number"
              ? data.form_profile.net_ratio_variable_bp / 100
              : undefined,
          netRatioRegime:
            data.form_profile.net_ratio_regime === "pre-culture-psc" ||
            data.form_profile.net_ratio_regime === "culture-psc"
              ? data.form_profile.net_ratio_regime
              : undefined,
          navigo:
            typeof data.form_profile.navigo_cents === "number"
              ? data.form_profile.navigo_cents / 100
              : undefined,
          mealVoucherDeduction:
            typeof data.form_profile.meal_voucher_deduction_cents === "number"
              ? data.form_profile.meal_voucher_deduction_cents / 100
              : undefined,
          pasRate:
            typeof data.form_profile.pas_rate_bp === "number"
              ? data.form_profile.pas_rate_bp / 100
              : undefined,
          sundayCarryover:
            typeof data.form_profile.sunday_carryover === "number"
              ? data.form_profile.sunday_carryover
              : undefined,
          sundayCarryoverYear:
            typeof data.form_profile.sunday_carryover_year === "number"
              ? data.form_profile.sunday_carryover_year
              : undefined,
          sundayCarryoverMonth:
            typeof data.form_profile.sunday_carryover_month === "number"
              ? data.form_profile.sunday_carryover_month
              : undefined,
          sundayCarryoverFromYear:
            typeof data.form_profile.sunday_carryover_from_year === "number"
              ? data.form_profile.sunday_carryover_from_year
              : undefined,
          sundayCarryoverFromMonth:
            typeof data.form_profile.sunday_carryover_from_month === "number"
              ? data.form_profile.sunday_carryover_from_month
              : undefined,
          manualAdjustments: manualAdjustmentsFromApi(
            data.form_profile.manual_adjustments,
          ),
        }
      : null;
    setFormProfile(syncedProfile);
    setPayProfiles(
      Object.fromEntries(
        Object.entries(data.form_profile?.pay_profiles || {}).map(
          ([year, profile]) => [year, payProfileFromApi(profile)],
        ),
      ),
    );
    if ([1, 2, 3].includes(Number(syncedProfile?.group)))
      setGroup(Number(syncedProfile?.group));
    const next: Entries = {};
    for (const row of data.entries || [])
      next[row.date] = {
        noteText: row.note_text || "",
        noteColor: row.note_color || "#D3943D",
        noteUpdatedAt: row.note_updated_at || "",
        noteGroupId: row.note_group_id || "",
        leave: Boolean(row.leave),
        wish: Boolean(row.wish),
        holidayPay:
          row.holiday_pay === "prime" || row.holiday_pay === "recovery"
            ? row.holiday_pay
            : "",
        updatedAt: row.updated_at || "",
      };
    setEntries(next);
    setOvertimeEntries(
      (data.overtime_entries || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        minutes: item.minutes,
        dayMinutes: item.day_minutes,
        nightMinutes: item.night_minutes,
        disposition: item.disposition,
        inputMode: item.input_mode,
        start: item.start || undefined,
        end: item.end || undefined,
        updatedAt: item.updated_at || "",
      })),
    );
    setRecoveryUses(
      (data.recovery_uses || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        minutes: item.minutes,
        start: item.start || undefined,
        end: item.end || undefined,
        updatedAt: item.updated_at || "",
      })),
    );
    setMecenatEntries(
      (data.mecenat_entries || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        start: item.start,
        end: item.end,
        dayMinutes: item.day_minutes,
        nightMinutes: item.night_minutes,
        grossAmountCents: item.gross_amount_cents,
        payYear: item.pay_year,
        payMonth: item.pay_month,
        updatedAt: item.updated_at || "",
      })),
    );
    setAuthStatus("ready");
    setPeriods(
      (data.periods || []).map(
        (period: {
          id: string;
          from: string;
          to: string;
          leave_type?: LeaveType | "";
          half_moment?: HalfMoment | "";
          group?: number;
          updated_at: string;
        }) => ({
          id: period.id,
          from: period.from,
          to: period.to,
          leaveType: period.leave_type || "",
          halfMoment: period.half_moment || "",
          group: period.group,
          updatedAt: period.updated_at,
        }),
      ),
    );
  }
  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      await login(loginEmail.trim(), loginPassword);
      setLoginPassword("");
      await loadCalendar();
    } catch {
      setAuthError("Adresse ou mot de passe incorrect.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitInvite(event: React.FormEvent) {
    event.preventDefault();
    if (loginPassword.length < 8) {
      setAuthError("Choisissez un mot de passe d’au moins 8 caractères.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const user = await acceptInvite(inviteToken, loginPassword);
      setUserEmail(user.email || "Compte connecté");
      if (user.email)
        localStorage.setItem(
          `planning:guide-pending-v1:${user.email.trim().toLowerCase()}`,
          "1",
        );
      history.replaceState({}, "", location.pathname);
      setLoginPassword("");
      await loadCalendar();
    } catch {
      setAuthError("Cette invitation est invalide ou a expiré.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function disconnect() {
    await logout();
    guidePromptCheckedRef.current = false;
    setEntries({});
    setPeriods([]);
    setOvertimeEntries([]);
    setRecoveryUses([]);
    setMecenatEntries([]);
    setFormProfile(null);
    setPayProfiles({});
    setUserEmail("");
    setAuthStatus("guest");
  }

  async function exportDataBackup() {
    setDataManagementBusy(true);
    try {
      const data = await getCalendar<any>();
      const backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        entries: data.entries || [],
        periods: data.periods || [],
        overtime_entries: data.overtime_entries || [],
        recovery_uses: data.recovery_uses || [],
        mecenat_entries: data.mecenat_entries || [],
        form_profile: data.form_profile || null,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `planning-solo-sauvegarde-${dateKey(new Date())}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify("La sauvegarde JSON a été téléchargée.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La sauvegarde n’a pas pu être créée."));
    } finally {
      setDataManagementBusy(false);
    }
  }

  async function importDataBackup(file: File) {
    if (file.size > 5_000_000) {
      notify("Cette sauvegarde dépasse la taille maximale de 5 Mo.");
      return;
    }
    if (
      !window.confirm(
        "Restaurer cette sauvegarde remplacera le planning et le profil actuels. Continuer ?",
      )
    )
      return;
    setDataManagementBusy(true);
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      await postCalendar({ action: "restore-backup", backup });
      await loadCalendar();
      setDataManagementOpen(false);
      notify("La sauvegarde a été restaurée.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La sauvegarde est invalide ou illisible."));
    } finally {
      setDataManagementBusy(false);
    }
  }

  async function archiveLegacyData() {
    if (
      !window.confirm(
        "Archiver les anciennes clés globales dans votre espace privé ? Une copie récupérable sera conservée.",
      )
    )
      return;
    setDataManagementBusy(true);
    try {
      const result = await postCalendar<{ ok: true; archived: number }>({
        action: "archive-legacy-data",
        confirmation: "ARCHIVER",
      });
      notify(
        result.archived
          ? `${result.archived} élément${result.archived > 1 ? "s" : ""} historique${result.archived > 1 ? "s" : ""} archivé${result.archived > 1 ? "s" : ""}.`
          : "Aucune ancienne donnée ne restait à archiver.",
      );
    } catch (error) {
      notify(calendarErrorMessage(error, "L’archivage n’a pas pu être effectué."));
    } finally {
      setDataManagementBusy(false);
    }
  }

  async function deleteAllUserData() {
    const confirmation = window.prompt(
      "Cette action efface le planning, le profil et les paramètres de paie. Tapez SUPPRIMER pour confirmer.",
    );
    if (confirmation !== "SUPPRIMER") return;
    setDataManagementBusy(true);
    try {
      await postCalendar({ action: "delete-user-data", confirmation });
      await loadCalendar();
      setDataManagementOpen(false);
      notify("Toutes les données du compte ont été effacées.");
    } catch (error) {
      notify(calendarErrorMessage(error, "Les données n’ont pas pu être effacées."));
    } finally {
      setDataManagementBusy(false);
    }
  }
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

  const totals = useMemo(() => {
    const result = { work: 0, training: 0, workedHoliday: 0 };
    const months =
      mode === "year"
        ? Array.from({ length: 12 }, (_, index) => index)
        : [view.getMonth()];
    for (const month of months) {
      for (let day = 1; day <= monthDays(view.getFullYear(), month); day++) {
        const info = getDayInfo(
          localDate(view.getFullYear(), month, day),
          group,
        );
        if (info.kind === "work") result.work++;
        if (info.kind === "training") result.training++;
        if (info.holiday && info.kind === "work") result.workedHoliday++;
      }
    }
    return result;
  }, [view, group, mode]);

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
        ),
      })),
    };
  }, [view, group, periods, entries, recoveryUses, formProfile?.workQuota, now]);

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
  const residenceAllowance =
    activePayProfile?.residenceAllowance ??
    formProfile?.residenceAllowance ??
    baseSalary * RESIDENCE_ALLOWANCE_RATE;
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
          period.leaveType !== "other" &&
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
        if (onLeave(key)) continue;
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
      ),
    };
  }

  async function checkForAppUpdate() {
    if (checkingAppUpdate) return;
    setCheckingAppUpdate(true);
    try {
      if ("serviceWorker" in navigator) {
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

  function scrollGuideTo(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const overtimeForPayMonth = useMemo(() => {
    return paidOvertimeForPayPeriod(view.getFullYear(), view.getMonth());
  }, [view, payProfiles, formProfile, overtimeEntries, workQuota]);
  const mecenatForCurrentPayMonth = useMemo(
    () => mecenatForPayMonth(mecenatEntries, view.getFullYear(), view.getMonth()),
    [mecenatEntries, view],
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
      cia: index === ciaMonth ? cia : 0,
      premiums:
        SUNDAY_ALLOWANCE.monthlyFlat +
        sunday +
        holiday +
        compensated -
        sick.total +
        mecenatForCurrentPayMonth.grossAmountCents / 100,
      // Le brut du bulletin est la somme de toutes ces lignes : c'est
      // reconstituable exactement, contrairement au net qui suppose de
      // modéliser une dizaine de cotisations. Scindé en deux pour
      // l'estimation du net : le traitement porte la pension civile, les
      // primes n'y sont pas soumises et en gardent bien plus.
      grossFixed: baseSalary + ifse + otherFixed - sick.total,
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
        sick.total +
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
  const grossEstimateMissing = estimateReadiness.grossMissing;
  const grossEstimateComplete = estimateReadiness.grossReady;
  const netEstimateMissing = estimateReadiness.netMissing;
  const netEstimateComplete = estimateReadiness.netReady;

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
      childcare: { used: 0, details: [] },
      exceptional: { used: 0, details: [] },
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
      if (period.leaveType === "recovery" || period.leaveType === "other")
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
  const totalLeaveUsed = leaveStats.balances.reduce(
    (total, balance) => total + balance.used,
    0,
  );
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
  }, [entries, now, showNotes]);

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
      if (!entry.noteText || !entry.noteText.toLowerCase().includes(query))
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
    const scheduledStatus =
      info.kind === "work"
        ? `${DAY_LABELS[info.kind]} (${coWorkingLabel})`
        : DAY_LABELS[info.kind];
    let status = scheduledStatus;
    let tone: string = info.kind;
    if (todayRecoveryMinutes) {
      status =
        todayRecoveryMinutes >= workDayMinutes
          ? `Récupération · ${minutesLabel(todayRecoveryMinutes)}`
          : `${scheduledStatus} + récup. ${minutesLabel(todayRecoveryMinutes)}`;
      tone = "recovery";
    } else if (period && info.kind !== "off") {
      status =
        period.leaveType === "other"
          ? "Divers"
          : leaveTypeLabel(period.leaveType || "annual");
      tone = period.leaveType === "recovery" ? "recovery" : "leave";
    } else if (entry?.leave) {
      status = "Divers";
      tone = "leave";
    } else if (info.holiday) {
      status = `${scheduledStatus} · ${info.holiday}`;
    }

    const nextWork = nextAttendanceDay(now, group, (candidateKey) =>
      Boolean(entries[candidateKey]?.leave) ||
      periods.some(
        (item) =>
          item.leaveType !== "other" &&
          candidateKey >= item.from &&
          candidateKey <= item.to,
      ) ||
      recoveryUses
        .filter((item) => item.date === candidateKey)
        .reduce((total, item) => total + item.minutes, 0) >= workDayMinutes,
    );
    const nextWorkKind = nextWork ? getDayInfo(nextWork, group).kind : null;

    return {
      status,
      tone,
      nextWork,
      nextWorkKind,
    };
  }, [now, group, periods, entries, recoveryUses, workDayMinutes]);

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
    noteSelecting;

  function openDay(date: Date) {
    const key = dateKey(date);
    const entry = entries[key];
    setDayDate(key);
    setQuickNoteMode(false);
    // Le champ s'ouvre sur le texte existant tel quel : c'est le bouton
    // « Ajouter une note » qui ouvre une ligne en dessous, à la demande.
    setNoteText(entry?.noteText || "");
    setNoteColor(entry?.noteColor || "#D3943D");
    setNoteGroupId(entry?.noteGroupId || "");
    setDayLeave(false);
    setDayPersonalLeave(Boolean(entry?.leave));
    setDayWish(Boolean(entry?.wish));
    setDayHolidayPay(entry?.holidayPay || "");
    setDayLeaveType("annual");
    setLeaveRangeEnabled(false);
    setLeaveRangeFrom(key);
    setLeaveRangeTo(key);
    setEditingPeriodId(null);
  }
  function beginQuickNote() {
    const today = new Date();
    const date =
      today.getFullYear() === view.getFullYear() &&
      today.getMonth() === view.getMonth()
        ? localDate(today.getFullYear(), today.getMonth(), today.getDate())
        : localDate(view.getFullYear(), view.getMonth(), 1);
    const key = dateKey(date);
    setQuickNoteMode(true);
    setDayDate(key);
    setNoteText("");
    setNoteColor("#D3943D");
    setNoteGroupId("");
    setDayLeave(false);
    setDayPersonalLeave(false);
    setDayWish(false);
    setLeaveRangeEnabled(false);
    setLeaveRangeFrom(key);
    setLeaveRangeTo(key);
    setEditingPeriodId(null);
    setHomeSection("home");
    setRequestChooser(false);
  }
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

  async function saveOvertimeEntry() {
    if (overtimeSaveInFlightRef.current) return;
    const overtimeDateIsValid =
      /^\d{4}-\d{2}-\d{2}$/.test(overtimeDraft.date) &&
      dateKey(fromKey(overtimeDraft.date)) === overtimeDraft.date;
    if (!overtimeDateIsValid) {
      notify("Choisissez une date valide pour les heures supplémentaires.");
      return;
    }
    const duration = splitOvertimeRange(overtimeDraft.start, overtimeDraft.end);
    if (!duration) {
      notify(
        "Indiquez des heures de début et de fin valides et différentes. Une plage peut passer minuit.",
      );
      return;
    }
    const overtimeDate = fromKey(overtimeDraft.date);
    if (overtimeDate.getDay() === 0 || getDayInfo(overtimeDate, group).holiday) {
      notify("Les heures supplémentaires ne sont pas déclarées un dimanche ou un jour férié.");
      return;
    }
    const crossesIntoFollowingDate =
      overtimeDraft.end < overtimeDraft.start &&
      overtimeDraft.end !== "00:00";
    if (crossesIntoFollowingDate) {
      const followingDate = addDays(overtimeDate, 1);
      if (
        followingDate.getDay() === 0 ||
        getDayInfo(followingDate, group).holiday
      ) {
        notify(
          "Cette plage se prolonge sur un dimanche ou un jour férié. Modifiez l’heure de fin.",
        );
        return;
      }
    }
    const submissionKey = [
      overtimeDraft.date,
      duration.minutes,
      duration.dayMinutes,
      duration.nightMinutes,
      overtimeDraft.disposition,
    ].join("|");
    if (
      lastOvertimeSubmissionRef.current.key === submissionKey &&
      Date.now() - lastOvertimeSubmissionRef.current.at < 1500
    )
      return;
    lastOvertimeSubmissionRef.current = { key: submissionKey, at: Date.now() };
    overtimeSaveInFlightRef.current = true;
    setSavingOvertime(true);
    try {
      const id = createClientId("overtime");
      const localEntry: OvertimeEntry = {
        id,
        date: overtimeDraft.date,
        ...duration,
        disposition: overtimeDraft.disposition,
        inputMode: "range",
        start: overtimeDraft.start,
        end: overtimeDraft.end,
        updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await postCalendar<any>({
          action: "save-overtime",
          id,
          date: localEntry.date,
          minutes: localEntry.minutes,
          dayMinutes: localEntry.dayMinutes,
          nightMinutes: localEntry.nightMinutes,
          disposition: localEntry.disposition,
          inputMode: localEntry.inputMode,
          start: localEntry.start,
          end: localEntry.end,
        });
        localEntry.updatedAt = result.overtime_entry?.updated_at || localEntry.updatedAt;
      }
      setOvertimeEntries((current) =>
        current.some((item) => item.id === localEntry.id)
          ? current
          : [...current, localEntry],
      );
      setOvertimeDialogOpen(false);
      confirm(
        localEntry.disposition === "paid"
          ? `Heures enregistrées pour la paie du mois suivant.`
          : `${minutesLabel(localEntry.minutes)} ajoutées au solde de récupération.`,
      );
    } catch (error) {
      notify(calendarErrorMessage(error, "Les heures n’ont pas pu être enregistrées."));
    } finally {
      overtimeSaveInFlightRef.current = false;
      setSavingOvertime(false);
    }
  }

  async function saveSolidarityHours() {
    if (overtimeSaveInFlightRef.current) return;
    const minutes = Math.round(
      Number(solidarityDraft.hours.replace(",", ".")) * 60 +
        Number(solidarityDraft.minutes),
    );
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600_000) {
      notify("Indiquez un nombre d’heures de solidarité valide.");
      return;
    }
    overtimeSaveInFlightRef.current = true;
    setSavingOvertime(true);
    try {
      const id = createClientId("solidarity");
      const localEntry: OvertimeEntry = {
        id,
        date: dateKey(new Date()),
        minutes,
        dayMinutes: minutes,
        nightMinutes: 0,
        disposition: "recovery",
        inputMode: "duration",
        updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await postCalendar<any>({
          action: "save-overtime",
          id,
          date: localEntry.date,
          minutes,
          dayMinutes: minutes,
          nightMinutes: 0,
          disposition: "recovery",
          inputMode: "duration",
        });
        localEntry.updatedAt = result.overtime_entry?.updated_at || localEntry.updatedAt;
      }
      setOvertimeEntries((current) => [...current, localEntry]);
      setSolidarityDialogOpen(false);
      setSolidarityDraft({ hours: "", minutes: "0" });
      confirm(`${minutesLabel(minutes)} de solidarité ajoutées au solde de récupération.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "Les heures de solidarité n’ont pas pu être enregistrées."));
    } finally {
      overtimeSaveInFlightRef.current = false;
      setSavingOvertime(false);
    }
  }

  async function deleteOvertimeEntry(entry: OvertimeEntry) {
    if (
      entry.disposition === "recovery" &&
      recoveryBalance.remaining < entry.minutes
    ) {
      notify(
        "Cette récupération a déjà été utilisée. Annulez d’abord les récupérations posées correspondantes.",
      );
      return;
    }
    if (!window.confirm("Supprimer cette déclaration d’heures supplémentaires ?"))
      return;
    try {
      if (!demoMode)
        await postCalendar({ action: "delete-overtime", id: entry.id });
      setOvertimeEntries((current) => current.filter((item) => item.id !== entry.id));
      confirm("La déclaration a été supprimée.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La déclaration n’a pas pu être supprimée."));
    }
  }

  async function saveRecoveryUse() {
    if (overtimeSaveInFlightRef.current) return;
    const custom = Math.round(
      Number(recoveryDraft.hours.replace(",", ".")) * 60 +
        Number(recoveryDraft.minutes),
    );
    const minutes =
      recoveryDraft.kind === "day" || recoveryDraft.kind === "holiday"
        ? workDayMinutes
        : recoveryDraft.kind === "half"
          ? workDayMinutes / 2
          : custom;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recoveryDraft.date) || minutes <= 0) {
      notify("Vérifiez la date et la durée de récupération.");
      return;
    }
    if (minutes > recoveryBalance.remaining) {
      notify(`Votre solde disponible est de ${minutesLabel(recoveryBalance.remaining)}.`);
      return;
    }
    const submissionKey = `${recoveryDraft.date}|${minutes}`;
    if (
      lastRecoverySubmissionRef.current.key === submissionKey &&
      Date.now() - lastRecoverySubmissionRef.current.at < 1500
    )
      return;
    lastRecoverySubmissionRef.current = { key: submissionKey, at: Date.now() };
    overtimeSaveInFlightRef.current = true;
    setSavingOvertime(true);
    try {
      const id = createClientId("recovery");
      const localUse: RecoveryUse = {
        id,
        date: recoveryDraft.date,
        minutes,
        start: recoveryDraft.start || undefined,
        updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await postCalendar<any>({
          action: "save-recovery-use",
          id,
          date: localUse.date,
          minutes,
          start: localUse.start,
        });
        localUse.updatedAt = result.recovery_use?.updated_at || localUse.updatedAt;
      }
      setRecoveryUses((current) =>
        current.some((item) => item.id === localUse.id)
          ? current
          : [...current, localUse],
      );
      setRecoveryDialogOpen(false);
      confirm(`${minutesLabel(minutes)} de récupération posées.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "La récupération n’a pas pu être enregistrée."));
    } finally {
      overtimeSaveInFlightRef.current = false;
      setSavingOvertime(false);
    }
  }

  async function deleteRecoveryUse(entry: RecoveryUse) {
    if (!window.confirm("Annuler cette utilisation de récupération ?")) return;
    try {
      if (!demoMode)
        await postCalendar({ action: "delete-recovery-use", id: entry.id });
      setRecoveryUses((current) => current.filter((item) => item.id !== entry.id));
      confirm("La récupération a été remise dans votre solde.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La récupération n’a pas pu être annulée."));
    }
  }

  async function saveMecenatEntry() {
    if (mecenatSaveInFlightRef.current) return;
    const calculation = calculateMecenatVacation(
      mecenatDraft.start,
      mecenatDraft.end,
      workQuota,
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mecenatDraft.date) || !calculation) {
      notify("Vérifiez la date et les horaires du mécénat.");
      return;
    }
    const { year: payYear, month: payMonth } = nextPayPeriod(mecenatDraft.date);
    const submissionKey = [
      mecenatDraft.date,
      mecenatDraft.start,
      mecenatDraft.end,
      payYear,
      payMonth,
    ].join("|");
    if (
      lastMecenatSubmissionRef.current.key === submissionKey &&
      Date.now() - lastMecenatSubmissionRef.current.at < 1500
    )
      return;
    lastMecenatSubmissionRef.current = { key: submissionKey, at: Date.now() };
    mecenatSaveInFlightRef.current = true;
    setSavingMecenat(true);
    try {
      const id = createClientId("mecenat");
      const localEntry: MecenatEntry = {
        id,
        date: mecenatDraft.date,
        start: mecenatDraft.start,
        end: mecenatDraft.end,
        dayMinutes: calculation.dayMinutes,
        nightMinutes: calculation.nightMinutes,
        grossAmountCents: calculation.grossAmountCents,
        payYear,
        payMonth,
        updatedAt: new Date().toISOString(),
      };
      if (!demoMode) {
        const result = await postCalendar<any>({
          action: "save-mecenat",
          id,
          date: localEntry.date,
          start: localEntry.start,
          end: localEntry.end,
          payYear,
          payMonth,
        });
        localEntry.updatedAt = result.mecenat_entry?.updated_at || localEntry.updatedAt;
      }
      setMecenatEntries((current) =>
        current.some((item) => item.id === localEntry.id)
          ? current
          : [...current, localEntry],
      );
      setMecenatDialogOpen(false);
      confirm(`Mécénat enregistré : ${euros(localEntry.grossAmountCents / 100)} brut, intégré automatiquement à la paie du mois suivant.`);
    } catch (error) {
      notify(calendarErrorMessage(error, "Le mécénat n’a pas pu être enregistré."));
    } finally {
      mecenatSaveInFlightRef.current = false;
      setSavingMecenat(false);
    }
  }

  async function deleteMecenatEntry(entry: MecenatEntry) {
    if (!window.confirm("Supprimer ce mécénat ?")) return;
    try {
      if (!demoMode)
        await postCalendar({ action: "delete-mecenat", id: entry.id });
      setMecenatEntries((current) =>
        current.filter((item) => item.id !== entry.id),
      );
      confirm("Le mécénat a été supprimé.");
    } catch (error) {
      notify(calendarErrorMessage(error, "Le mécénat n’a pas pu être supprimé."));
    }
  }
  function editDayLeavePeriod(period: LeavePeriod) {
    setEditingPeriodId(period.id);
    setDayLeave(true);
    setDayLeaveType(period.leaveType || "annual");
    setDayHalfMoment(period.halfMoment || "morning");
    setLeaveRangeEnabled(true);
    setLeaveRangeFrom(period.from);
    setLeaveRangeTo(period.to);
  }
  async function saveDay(overrides?: Partial<SharedEntry>) {
    if (!dayDate) return;
    const trimmedNote = noteText.trim();
    const useLeaveRange = (leaveRangeEnabled || dayLeave) && dayLeave;
    if (
      useLeaveRange &&
      (!leaveRangeFrom || !leaveRangeTo || leaveRangeTo < leaveRangeFrom)
    ) {
      notify(
        "La date de fin des congés doit être identique ou postérieure à la date de début.",
      );
      return;
    }
    if (
      useLeaveRange &&
      dayNumber(fromKey(leaveRangeTo)) -
        dayNumber(fromKey(leaveRangeFrom)) +
        1 >
        366
    ) {
      notify("Une période de congés ne peut pas dépasser 366 jours.");
      return;
    }
    const current = entries[dayDate] || emptyEntry();
    const nextEntry: SharedEntry = {
      ...current,
      noteText: trimmedNote,
      noteColor,
      noteGroupId: "",
      leave: dayPersonalLeave,
      wish: dayWish,
      holidayPay: dayHolidayPay,
      ...overrides,
    };
    const noteChanged = nextEntry.noteText !== current.noteText;
    if (noteChanged)
      nextEntry.noteUpdatedAt = nextEntry.noteText
        ? new Date().toISOString()
        : "";
    setSavingDay(true);
    try {
      const demo = demoMode;
      if (!demo) {
        const operations: Array<Record<string, unknown>> = [];
        if (noteGroupId)
          operations.push({
            action: "delete-note-period",
            groupId: noteGroupId,
          });
        operations.push({
          action: "save-entry",
          date: dayDate,
          ...nextEntry,
          expectedUpdatedAt: current.updatedAt,
        });
        if (useLeaveRange)
          operations.push({
            action: "save-period",
            id: editingPeriodId || undefined,
            expectedUpdatedAt: editingPeriodId
              ? periods.find((period) => period.id === editingPeriodId)
                  ?.updatedAt || ""
              : "",
            from: leaveRangeFrom,
            to: leaveRangeTo,
            leaveType: dayLeaveType,
            halfMoment: dayLeaveType === "half" ? dayHalfMoment : undefined,
            group,
          });
        // Un congé souhaité n'est pas une période enregistrée : il se pose jour
        // par jour. Il vit donc hors du bloc ci-dessus, qui ne s'exécute que
        // lorsqu'un vrai congé est en jeu.
        if (dayWish && leaveRangeEnabled && leaveRangeFrom && leaveRangeTo)
          for (const key of rangeKeys(leaveRangeFrom, leaveRangeTo))
            if (key !== dayDate)
              operations.push({
                action: "save-entry",
                date: key,
                ...(entries[key] || emptyEntry()),
                expectedUpdatedAt: entries[key]?.updatedAt || "",
                wish: true,
              });
        await postCalendarBatch(operations);
        await loadCalendar();
      } else
        setEntries((currentEntries) => {
          const next = { ...currentEntries };
          if (noteGroupId) {
            for (const [key, entry] of Object.entries(next))
              if (entry.noteGroupId === noteGroupId) {
                const cleared = {
                  ...entry,
                  noteText: "",
                  noteUpdatedAt: "",
                  noteGroupId: "",
                };
                if (!cleared.leave && !cleared.wish && !cleared.holidayPay)
                  delete next[key];
                else next[key] = cleared;
              }
          }
          // Même condition que le serveur : un congé souhaité ou un choix de
          // compensation suffit à garder la journée, même sans note ni congé.
          if (
            !nextEntry.noteText &&
            !nextEntry.leave &&
            !nextEntry.wish &&
            !nextEntry.holidayPay
          )
            delete next[dayDate];
          else next[dayDate] = nextEntry;
          return next;
        });
      if (demo && useLeaveRange) {
        const updatedAt = new Date().toISOString();
        setPeriods((currentPeriods) => [
          ...currentPeriods.filter(
            (period) => !editingPeriodId || period.id !== editingPeriodId,
          ),
          {
            id: editingPeriodId || createClientId("period"),
            from: leaveRangeFrom,
            to: leaveRangeTo,
            leaveType: dayLeaveType,
            halfMoment: dayLeaveType === "half" ? dayHalfMoment : "",
            group,
            updatedAt,
          } satisfies LeavePeriod,
        ]);
      }
      setEditingPeriodId(null);
      setDayDate(null);
    } catch (error) {
      notify(
        calendarErrorMessage(
          error,
          "La modification n’a pas pu être synchronisée. Réessayez.",
        ),
      );
    } finally {
      setSavingDay(false);
    }
  }
  function beginNoteDateSelection() {
    if (!dayDate) return;
    setNoteDates((current) => (current.includes(dayDate) ? current : [dayDate]));
    setDayDate(null);
    setNoteSelecting(true);
    setTimeout(
      () =>
        document
          .getElementById("note-selection-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  function cancelNoteSelection() {
    setNoteSelecting(false);
    setNoteDates([]);
  }
  async function saveNoteAcrossDates() {
    const trimmedNote = noteText.trim();
    if (!trimmedNote || !noteDates.length) return;
    setSavingDay(true);
    try {
      const demo = demoMode;
      const groupId = noteGroupId || createClientId("note");
      const updatedAt = new Date().toISOString();
      if (!demo) {
        await postCalendarBatch(
          groupConsecutive(noteDates).map((range) => ({
            action: "save-note-period",
            groupId,
            from: range.from,
            to: range.to,
            noteText: trimmedNote,
            noteColor,
          })),
        );
        await loadCalendar();
      } else {
        setEntries((currentEntries) => {
          const next = { ...currentEntries };
          if (noteGroupId)
            for (const [key, entry] of Object.entries(next))
              if (entry.noteGroupId === noteGroupId) {
                const cleared = {
                  ...entry,
                  noteText: "",
                  noteUpdatedAt: "",
                  noteGroupId: "",
                };
                if (!cleared.leave && !cleared.wish && !cleared.holidayPay)
                  delete next[key];
                else next[key] = cleared;
              }
          for (const date of noteDates) {
            const previous = next[date] || emptyEntry();
            next[date] = {
              ...previous,
              noteText: trimmedNote,
              noteColor,
              noteUpdatedAt: updatedAt,
              noteGroupId: groupId,
            };
          }
          return next;
        });
      }
      setNoteSelecting(false);
      setNoteDates([]);
      setNoteText("");
      setNoteGroupId("");
      setNoteColor("#D3943D");
    } catch (error) {
      notify(
        calendarErrorMessage(
          error,
          "La note n’a pas pu être enregistrée. Réessayez.",
        ),
      );
    } finally {
      setSavingDay(false);
    }
  }
  function openRange(initialType: LeaveType = "annual") {
    if (requestKind) {
      notify(
        "Terminez ou annulez d’abord la demande professionnelle en cours.",
      );
      return;
    }
    setRangeLeaveType(initialType);
    setEditingPeriodId(null);
    setEditingLegacyPeriod(null);
    setSeparateDates([]);
    setSeparatePeople([]);
    setRangeOpen(true);
  }
  function beginRangeSelection() {
    setSeparatePeople(["leave"]);
    setSeparateDates([]);
    setRangeOpen(false);
    setRangeSelecting(true);
    setTimeout(
      () =>
        document
          .getElementById("range-selection-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  function cancelRangeSelection() {
    setRangeSelecting(false);
    setSeparateDates([]);
    setSeparatePeople([]);
    setEditingPeriodId(null);
    setEditingLegacyPeriod(null);
  }
  function beginMultipleDateSelectionFromDay() {
    if (!dayDate) return;
    const people: MultiDatePerson[] = dayLeave ? ["leave"] : [];
    if (dayPersonalLeave) people.push("personal");
    if (dayWish) people.push("wish");
    if (!people.length) return;
    setRangeLeaveType(dayLeaveType);
    setRangeHalfMoment(dayHalfMoment);
    setSeparatePeople(people);
    setSeparateDates([dayDate]);
    setDayDate(null);
    setRangeSelecting(true);
    setTimeout(
      () =>
        document
          .getElementById("range-selection-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  async function clearLegacyPeriod(period: LeavePeriod) {
    if (
      !demoMode
    ) {
      await postCalendar({
          action: "clear-legacy-period",
          from: period.from,
          to: period.to,
      });
    }
    setEntries((current) => {
      const next = { ...current };
      for (
        let date = fromKey(period.from);
        dateKey(date) <= period.to;
        date = addDays(date, 1)
      ) {
        const key = dateKey(date);
        const entry = next[key];
        if (!entry) continue;
        const nextEntry: SharedEntry = { ...entry, leave: false };
        if (
          !nextEntry.noteText &&
          !nextEntry.leave &&
          !nextEntry.wish &&
          !nextEntry.holidayPay
        )
          delete next[key];
        else next[key] = nextEntry;
      }
      return next;
    });
  }
  async function saveSeparateLeaveDates() {
    if (!separateDates.length || !separatePeople.length) return;
    setSavingRange(true);
    try {
      const saved: LeavePeriod[] = [];
      const demo = demoMode;
      const operations: Array<Record<string, unknown>> = [];
      const periodResultIndexes: number[] = [];
      const useFastPeriodBatch =
        !editingLegacyPeriod &&
        !editingPeriodId &&
        separatePeople.length === 1 &&
        separatePeople[0] === "leave";
      const bulkPeriods: Array<Record<string, unknown>> = [];
      for (const date of [...separateDates].sort()) {
        for (const person of separatePeople) {
          // « Divers » et « souhaité » sont des marques posées sur la journée,
          // pas des périodes enregistrées : elles s'écrivent jour par jour et
          // doivent préserver ce que porte déjà la case.
          if (person === "personal" || person === "wish") {
            if (!demo) {
              const current = entries[date];
              operations.push({
                action: "save-leaves",
                date,
                leave:
                  person === "personal" ? true : Boolean(current?.leave),
                wish: person === "wish" ? true : Boolean(current?.wish),
                expectedUpdatedAt: current?.updatedAt || "",
              });
            }
            continue;
          }
          if (!demo) {
            const periodInput = {
              action: "save-period",
              id: createClientId("period"),
              from: date,
              to: date,
              leaveType: rangeLeaveType,
              halfMoment:
                rangeLeaveType === "half" ? rangeHalfMoment : undefined,
              group,
            };
            if (useFastPeriodBatch) {
              const { action: _action, ...bulkPeriod } = periodInput;
              bulkPeriods.push(bulkPeriod);
            } else {
              periodResultIndexes.push(operations.length);
              operations.push(periodInput);
            }
          } else {
            saved.push({
              id: createClientId("period"),
              from: date,
              to: date,
              leaveType: rangeLeaveType,
              halfMoment: rangeLeaveType === "half" ? rangeHalfMoment : "",
              group,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      if (!demo) {
        if (editingLegacyPeriod)
          operations.push({
            action: "clear-legacy-period",
            from: editingLegacyPeriod.from,
            to: editingLegacyPeriod.to,
          });
        else if (editingPeriodId)
          operations.push({
            action: "delete-period",
            id: editingPeriodId,
            expectedUpdatedAt:
              periods.find((period) => period.id === editingPeriodId)
                ?.updatedAt || "",
          });
        type SavedPeriodResponse = {
          period?: {
            id: string;
            from: string;
            to: string;
            leave_type?: LeaveType;
            half_moment?: HalfMoment;
            group?: number;
            updated_at: string;
          };
        };
        const periodResults: SavedPeriodResponse[] = [];
        if (useFastPeriodBatch) {
          const bulk = await postCalendarPeriodsVerified<
            NonNullable<SavedPeriodResponse["period"]>
          >(
            bulkPeriods as Array<
              Record<string, unknown> & { id: string; from: string; to: string }
            >,
          );
          periodResults.push(
            ...bulk.periods.map((period) => ({ period })),
          );
        } else {
          const batch = await postCalendarBatch<SavedPeriodResponse>(operations);
          periodResults.push(
            ...periodResultIndexes.map((index) => batch.results[index]),
          );
        }
        for (const result of periodResults) {
          const period = result?.period;
          if (!period) continue;
          saved.push({
            id: period.id,
            from: period.from,
            to: period.to,
            leaveType: period.leave_type || "",
            halfMoment: period.half_moment || "",
            group: period.group,
            updatedAt: period.updated_at,
          });
        }
      } else if (editingLegacyPeriod) {
        await clearLegacyPeriod(editingLegacyPeriod);
      }
      setPeriods((current) =>
        [
          ...current.filter(
            (period) =>
              period.id !== editingPeriodId &&
              (!editingLegacyPeriod || period.id !== editingLegacyPeriod.id),
          ),
          ...saved,
        ].sort((a, b) => a.from.localeCompare(b.from)),
      );
      if (demo && separatePeople.includes("personal")) {
        setEntries((current) => {
          const next = { ...current };
          for (const date of separateDates) {
            const previous = next[date] || emptyEntry();
            next[date] = { ...previous, leave: true };
          }
          return next;
        });
      }
      let refreshDelayed = false;
      if (!demo) {
        try {
          await loadCalendar();
        } catch {
          // Les périodes renvoyées par l'écriture sont déjà appliquées juste
          // au-dessus. Une relecture momentanément indisponible ne transforme
          // donc plus un enregistrement réussi en faux échec.
          refreshDelayed = true;
        }
      }
      cancelRangeSelection();
      confirm(
        refreshDelayed
          ? "Les congés sont enregistrés. La vérification distante se terminera automatiquement à la prochaine ouverture."
          : "Les congés sont enregistrés : le planning et les soldes sont à jour.",
      );
    } catch (error) {
      await loadCalendar().catch(() => undefined);
      notify(
        calendarErrorMessage(
          error,
          "Les dates n’ont pas pu être synchronisées. Réessayez.",
        ),
      );
    } finally {
      setSavingRange(false);
    }
  }
  async function deleteLeavePeriod() {
    if (!deletingPeriod) return;
    const target = deletingPeriod;
    setSavingRange(true);
    try {
      if (target.legacy) {
        await clearLegacyPeriod(target);
      } else if (!demoMode) {
        await postCalendar({ action: "delete-period", id: target.id });
      }
      if (!target.legacy)
        setPeriods((current) =>
          current.filter((period) => period.id !== target.id),
        );
      setDeletingPeriod(null);
    } catch {
      notify("La période n’a pas pu être annulée. Réessayez.");
    } finally {
      setSavingRange(false);
    }
  }
  function beginRequest(
    kind: RequestKind,
    initialDate?: string,
    requestedType?: SelectionType,
  ) {
    setRequestKind(kind);
    const initialType: SelectionType =
      requestedType ||
      (kind === "leave"
        ? "annual"
        : kind === "other"
          ? "other"
          : "recovery_day");
    const initialDateIsSelectable = Boolean(
      initialDate && getDayInfo(fromKey(initialDate), group).selectable,
    );
    setActiveType(initialType);
    setSickRequest(kind === "leave" && initialType === "sick");
    setSelections(
      initialDate && initialDateIsSelectable
        ? { [initialDate]: { date: initialDate, type: initialType } }
        : {},
    );
    setWarningDate(
      initialDate && !initialDateIsSelectable ? initialDate : null,
    );
    setHomeSection("home");
    setRequestChooser(false);
    window.setTimeout(
      () =>
        document
          .getElementById("request-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }
  function cancelRequest() {
    setRequestKind(null);
    setSickRequest(false);
    setSelections({});
    setWarningDate(null);
    setTimeDate(null);
  }
  function recordSelection(key: string) {
    if (
      activeType === "half" ||
      activeType === "recovery_half" ||
      activeType === "recovery_hours" ||
      activeType === "recovery_holiday"
    ) {
      const existing = selections[key];
      setTimeStart(existing?.start || "09:15");
      setTimeEnd(existing?.end || "13:00");
      setTimeDate(key);
      return;
    }
    setSelections((current) => ({
      ...current,
      [key]: { date: key, type: activeType },
    }));
  }
  function handleDay(date: Date) {
    if (ignoreNextDayClick.current) {
      ignoreNextDayClick.current = false;
      return;
    }
    const key = dateKey(date);
    if (calendarDeleteMode) {
      setCalendarDeleteDates((current) =>
        current.includes(key)
          ? current.filter((date) => date !== key)
          : [...current, key].sort(),
      );
      return;
    }
    if (rangeSelecting) {
      setSeparateDates((current) =>
        current.includes(key)
          ? current.filter((date) => date !== key)
          : [...current, key].sort(),
      );
      return;
    }
    if (noteSelecting) {
      setNoteDates((current) =>
        current.includes(key)
          ? current.filter((date) => date !== key)
          : [...current, key].sort(),
      );
      return;
    }
    if (!requestKind) {
      openDay(date);
      return;
    }
    if (selections[key]) {
      setSelections((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    const info = getDayInfo(date, group);
    if (!info.selectable) {
      setWarningDate(key);
      return;
    }
    recordSelection(key);
  }
  function confirmWarning() {
    if (!warningDate) return;
    const key = warningDate;
    setWarningDate(null);
    recordSelection(key);
  }
  function commitTime() {
    if (!timeDate) return;
    const start =
      (document.getElementById("request-time-start") as HTMLInputElement | null)
        ?.value || timeStart;
    const end =
      (document.getElementById("request-time-end") as HTMLInputElement | null)
        ?.value || timeEnd;
    if (!start || !end || end <= start) {
      notify("L’heure de fin doit être postérieure à l’heure de début.");
      return;
    }
    setSelections((current) => ({
      ...current,
      [timeDate]: { date: timeDate, type: activeType, start, end },
    }));
    setTimeDate(null);
  }
  function goToday() {
    const today = new Date();
    setView(localDate(today.getFullYear(), today.getMonth(), 1));
    if (mode === "year")
      setTimeout(
        () =>
          monthRefs.current[today.getMonth()]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        80,
      );
  }
  function changePeriod(delta: number) {
    if (mode === "month") {
      if (calendarSlide) return;
      const outgoing = delta > 0 ? "out-left" : "out-right";
      const incoming = delta > 0 ? "in-right" : "in-left";
      setCalendarSlide(outgoing);
      window.setTimeout(() => {
        setView((current) =>
          localDate(current.getFullYear(), current.getMonth() + delta, 1),
        );
        setCalendarSlide(incoming);
        window.setTimeout(() => setCalendarSlide(""), 230);
      }, 125);
      return;
    }
    setView((current) =>
      mode === "year"
        ? localDate(current.getFullYear() + delta, current.getMonth(), 1)
        : localDate(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }
  function startMonthSwipe(event: React.TouchEvent<HTMLElement>) {
    if (mode !== "month") return;
    const touch = event.changedTouches[0];
    monthSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function endMonthSwipe(event: React.TouchEvent<HTMLElement>) {
    if (!monthSwipeStart.current || mode !== "month") return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - monthSwipeStart.current.x;
    const deltaY = touch.clientY - monthSwipeStart.current.y;
    monthSwipeStart.current = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25)
      return;
    ignoreNextDayClick.current = true;
    window.setTimeout(() => {
      ignoreNextDayClick.current = false;
    }, 450);
    changePeriod(deltaX < 0 ? 1 : -1);
  }
  /** Change le mois affiché dans « Infos primes », par glissement ou par
   *  flèche — indépendant du mode (mois ou année), puisque ce panneau reste
   *  consultable dans les deux. */
  function changeAllowancesMonth(delta: 1 | -1) {
    setView((current) =>
      localDate(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }

  async function saveSickDateDirect(date: string) {
    const alreadyRecorded = periods.some(
      (period) =>
        period.leaveType === "sick" && date >= period.from && date <= period.to,
    );
    if (alreadyRecorded) {
      confirm("Cet arrêt maladie est déjà enregistré dans le planning.");
      setDayDate(null);
      return;
    }
    const input = {
      id: createClientId("period"),
      from: date,
      to: date,
      leaveType: "sick" as const,
      group,
    };
    setSavingDay(true);
    setDayDate(null);
    try {
      let saved: LeavePeriod;
      if (demoMode) {
        saved = {
          ...input,
          halfMoment: "",
          updatedAt: new Date().toISOString(),
        };
      } else {
        const result = await postCalendarPeriodsVerified<{
          id: string;
          from: string;
          to: string;
          leave_type?: LeaveType;
          half_moment?: HalfMoment;
          group?: number;
          updated_at: string;
        }>([input]);
        const period = result.periods[0];
        saved = {
          id: period.id,
          from: period.from,
          to: period.to,
          leaveType: period.leave_type || "sick",
          halfMoment: period.half_moment || "",
          group: period.group,
          updatedAt: period.updated_at,
        };
      }
      setPeriods((current) =>
        [...current, saved].sort((a, b) => a.from.localeCompare(b.from)),
      );
      confirm("L’arrêt maladie est enregistré et l’estimation de paie est à jour.");
    } catch (error) {
      notify(
        calendarErrorMessage(error, "L’arrêt maladie n’a pas pu être enregistré."),
      );
    } finally {
      setSavingDay(false);
    }
  }

  async function saveOtherDateDirect(date: string) {
    const alreadyRecorded = periods.some(
      (period) =>
        period.leaveType === "other" && date >= period.from && date <= period.to,
    );
    if (alreadyRecorded) {
      confirm("Ce repère Divers est déjà enregistré dans le planning.");
      setDayDate(null);
      return;
    }
    const input = {
      id: createClientId("period"),
      from: date,
      to: date,
      leaveType: "other" as const,
      group,
    };
    setSavingDay(true);
    setDayDate(null);
    try {
      let saved: LeavePeriod;
      if (demoMode) {
        saved = {
          ...input,
          halfMoment: "",
          updatedAt: new Date().toISOString(),
        };
      } else {
        const result = await postCalendarPeriodsVerified<{
          id: string;
          from: string;
          to: string;
          leave_type?: LeaveType;
          half_moment?: HalfMoment;
          group?: number;
          updated_at: string;
        }>([input]);
        const period = result.periods[0];
        saved = {
          id: period.id,
          from: period.from,
          to: period.to,
          leaveType: period.leave_type || "other",
          halfMoment: period.half_moment || "",
          group: period.group,
          updatedAt: period.updated_at,
        };
      }
      setPeriods((current) =>
        [...current, saved].sort((a, b) => a.from.localeCompare(b.from)),
      );
      confirm("Divers est ajouté directement au planning.");
    } catch (error) {
      notify(calendarErrorMessage(error, "Divers n’a pas pu être enregistré."));
    } finally {
      setSavingDay(false);
    }
  }

  async function deleteMultiplePlanningDates(
    dates: string[],
    target: "absences" | "notes",
  ) {
    const selected = new Set(dates);
    if (!selected.size) return;
    const label = target === "notes" ? "les notes" : "les absences et récupérations";
    if (
      !window.confirm(
        `Effacer ${label} sur ${selected.size} date${s(selected.size)} sélectionnée${s(selected.size)} ?`,
      )
    )
      return;

    setDeletingMultipleDates(true);
    try {
      const operations: Array<Record<string, unknown>> = [];
      if (target === "notes") {
        for (const key of selected) {
          const current = entries[key];
          if (!current?.noteText) continue;
          operations.push({
            action: "save-entry",
            date: key,
            ...current,
            noteText: "",
            noteGroupId: "",
            noteUpdatedAt: new Date().toISOString(),
            expectedUpdatedAt: current.updatedAt || "",
          });
        }
      } else {
        const legacyCleared = new Set<string>();
        for (const period of periods) {
          const removed = rangeKeys(period.from, period.to).filter((key) =>
            selected.has(key),
          );
          if (!removed.length) continue;
          if (period.legacy) {
            for (const key of removed) {
              legacyCleared.add(key);
              const current = entries[key];
              operations.push({
                action: "save-leaves",
                date: key,
                leave: false,
                wish: Boolean(current?.wish),
                expectedUpdatedAt: current?.updatedAt || "",
              });
            }
            continue;
          }
          operations.push({
            action: "delete-period",
            id: period.id,
            expectedUpdatedAt: period.updatedAt,
          });
          const remaining = rangeKeys(period.from, period.to).filter(
            (key) => !selected.has(key),
          );
          for (const segment of groupConsecutive(remaining))
            operations.push({
              action: "save-period",
              id: createClientId("period"),
              from: segment.from,
              to: segment.to,
              leaveType: period.leaveType || "annual",
              halfMoment:
                period.leaveType === "half" ? period.halfMoment || "" : "",
              group: period.group || group,
            });
        }
        for (const key of selected) {
          const current = entries[key];
          if (current?.leave && !legacyCleared.has(key))
            operations.push({
              action: "save-leaves",
              date: key,
              leave: false,
              wish: Boolean(current.wish),
              expectedUpdatedAt: current.updatedAt || "",
            });
        }
        for (const recovery of recoveryUses)
          if (selected.has(recovery.date))
            operations.push({ action: "delete-recovery-use", id: recovery.id });
      }

      if (!operations.length) {
        notify(`Aucune donnée à effacer sur les dates sélectionnées.`);
        return;
      }
      if (!demoMode) {
        await postCalendarBatch(operations);
        await loadCalendar();
      } else if (target === "notes") {
        setEntries((current) => {
          const next = { ...current };
          for (const key of selected) {
            const entry = next[key];
            if (!entry?.noteText) continue;
            next[key] = {
              ...entry,
              noteText: "",
              noteGroupId: "",
              noteUpdatedAt: new Date().toISOString(),
            };
          }
          return next;
        });
      } else {
        setPeriods((current) =>
          current.flatMap((period) => {
            const remaining = rangeKeys(period.from, period.to).filter(
              (key) => !selected.has(key),
            );
            if (remaining.length === rangeKeys(period.from, period.to).length)
              return [period];
            return groupConsecutive(remaining).map((segment) => ({
              ...period,
              id: createClientId("period"),
              from: segment.from,
              to: segment.to,
              updatedAt: new Date().toISOString(),
            }));
          }),
        );
        setEntries((current) => {
          const next = { ...current };
          for (const key of selected)
            if (next[key]?.leave) next[key] = { ...next[key], leave: false };
          return next;
        });
        setRecoveryUses((current) =>
          current.filter((item) => !selected.has(item.date)),
        );
      }
      setCalendarDeleteMode(false);
      setCalendarDeleteDates([]);
      setBalanceDetailType(null);
      confirm(`${selected.size} date${s(selected.size)} mise${s(selected.size)} à jour.`);
    } catch (error) {
      notify(
        calendarErrorMessage(
          error,
          "La suppression multiple n’a pas pu être synchronisée.",
        ),
      );
    } finally {
      setDeletingMultipleDates(false);
    }
  }

  function startCalendarCleanup() {
    cancelRequest();
    cancelRangeSelection();
    cancelNoteSelection();
    setCalendarDeleteDates([]);
    setCalendarDeleteMode(true);
  }

  function cancelCalendarCleanup() {
    setCalendarDeleteMode(false);
    setCalendarDeleteDates([]);
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
  /** Ouvre le formulaire vierge, sans rien pré-remplir depuis le planning. */
  function openBlankForm() {
    try {
      localStorage.removeItem(HANDOFF_KEY);
    } catch {}
    window.location.href = "/formulaire/index.html";
  }
  async function validateAndOpenForm() {
    if (!selectedList.length) {
      notify(
        "Sélectionnez au moins une date avant d’intégrer la demande au formulaire.",
      );
      return;
    }
    // Maladie et Divers n'ont pas de rubrique adaptée dans le PDF officiel.
    // Leur « formulaire » reste donc dans l'application : choix des dates,
    // validation explicite, puis enregistrement synchronisé. Divers est un
    // repère de planning uniquement et est exclu plus bas de tous les calculs.
    if (requestKind === "other" || sickRequest) {
      const leaveType: LeaveType = requestKind === "other" ? "other" : "sick";
      const grouped = groupConsecutive(selectedList.map((item) => item.date));
      const inputs = grouped.map((period) => ({
        id: createClientId("period"),
        from: period.from,
        to: period.to,
        leaveType,
        group,
      }));
      setSavingRequest(true);
      try {
        let saved: LeavePeriod[];
        if (demoMode) {
          saved = inputs.map((period) => ({
            ...period,
            halfMoment: "",
            updatedAt: new Date().toISOString(),
          }));
        } else {
          const result = await postCalendarPeriodsVerified<{
            id: string;
            from: string;
            to: string;
            leave_type?: LeaveType;
            half_moment?: HalfMoment;
            group?: number;
            updated_at: string;
          }>(inputs);
          saved = result.periods.map((period) => ({
            id: period.id,
            from: period.from,
            to: period.to,
            leaveType: period.leave_type || leaveType,
            halfMoment: period.half_moment || "",
            group: period.group,
            updatedAt: period.updated_at,
          }));
        }
        setPeriods((current) =>
          [...current, ...saved].sort((a, b) => a.from.localeCompare(b.from)),
        );
        cancelRequest();
        confirm(
          leaveType === "other"
            ? "Divers est ajouté au planning, sans modifier la paie ni les soldes."
            : "L’arrêt maladie est enregistré et l’estimation de paie est à jour.",
        );
      } catch (error) {
        notify(
          calendarErrorMessage(
            error,
            leaveType === "other"
              ? "Divers n’a pas pu être enregistré."
              : "L’arrêt maladie n’a pas pu être enregistré.",
          ),
        );
      } finally {
        setSavingRequest(false);
      }
      return;
    }
    if (requestKind === "recovery") {
      const requestedMinutes = selectedList.reduce(
        (total, item) =>
          total +
          recoveryRequestMinutes(
            item.type as RecoveryRequestType,
            workQuota,
            item.start,
            item.end,
          ),
        0,
      );
      if (requestedMinutes <= 0) {
        notify("Vérifiez les horaires de la récupération.");
        return;
      }
      if (requestedMinutes > recoveryBalance.remaining) {
        notify(
          `Cette demande utilise ${minutesLabel(requestedMinutes)}, mais votre solde disponible est de ${minutesLabel(recoveryBalance.remaining)}.`,
        );
        return;
      }
    }
    const groups = {
      annual: groupConsecutive(
        selectedList
          .filter((item) => item.type === "annual")
          .map((item) => item.date),
      ),
      rtt: groupConsecutive(
        selectedList
          .filter((item) => item.type === "rtt")
          .map((item) => item.date),
      ),
      fraction: groupConsecutive(
        selectedList
          .filter((item) => item.type === "fraction")
          .map((item) => item.date),
      ),
      childcare: groupConsecutive(
        selectedList
          .filter((item) => item.type === "childcare")
          .map((item) => item.date),
      ),
      exceptional: groupConsecutive(
        selectedList
          .filter((item) => item.type === "exceptional")
          .map((item) => item.date),
      ),
      recoveryDay: groupConsecutive(
        selectedList
          .filter((item) => item.type === "recovery_day")
          .map((item) => item.date),
      ),
      // La récupération d'un jour férié conserve sa rubrique du formulaire ;
      // elle sera débitée comme une journée entière du solde d'heures lors de
      // l'enregistrement final.
      recoveryHoliday: groupConsecutive(
        selectedList
          .filter((item) => item.type === "recovery_holiday")
          .map((item) => item.date),
      ),
    };
    // Le formulaire officiel n'offre que 2 lignes « garde d'enfant » et
    // 1 seule ligne « jour exceptionnel », sans pagination possible.
    if (requestKind === "leave") {
      const overflow = [
        groups.childcare.length > 2
          ? "Le formulaire ne prévoit que deux périodes de congé garde d’enfant."
          : "",
        groups.exceptional.length > 1
          ? "Le formulaire ne prévoit qu’une seule période de jour exceptionnel."
          : "",
      ].filter(Boolean);
      if (overflow.length) {
        notify(`${overflow.join(" ")} Réduisez votre sélection.`);
        return;
      }
    }
    const pageNeeds =
      requestKind === "leave"
        ? [
            Math.ceil(groups.annual.length / 5),
            Math.ceil(groups.rtt.length / 4),
            Math.ceil(groups.fraction.length / 2),
            Math.ceil(
              selectedList.filter((item) => item.type === "half").length / 4,
            ),
          ]
        : [
            Math.ceil(groups.recoveryDay.length / 5),
            Math.ceil(
              selectedList.filter((item) => item.type === "recovery_half")
                .length / 5,
            ),
            Math.ceil(
              selectedList.filter((item) => item.type === "recovery_hours")
                .length / 5,
            ),
            Math.ceil(
              selectedList.filter((item) => item.type === "recovery_holiday")
                .length / 5,
            ),
          ];
    if (Math.max(...pageNeeds) > 5) {
      notify(
        "La sélection dépasse la capacité maximale de cinq feuilles. Réduisez le nombre de périodes avant de continuer.",
      );
      return;
    }
    const payload = {
      version: 1,
      requestId: createClientId("request"),
      requestKind,
      group,
      createdAt: new Date().toISOString(),
      profile: formProfile,
      periods: [
        ...groups.annual.map((period) => ({ ...period, type: "annual" })),
        ...groups.rtt.map((period) => ({ ...period, type: "rtt" })),
        ...groups.fraction.map((period) => ({ ...period, type: "fraction" })),
        ...groups.childcare.map((period) => ({
          ...period,
          type: "childcare",
        })),
        ...groups.exceptional.map((period) => ({
          ...period,
          type: "exceptional",
        })),
        ...groups.recoveryDay.map((period) => ({
          ...period,
          type: "recovery_day",
        })),
      ],
      timed: selectedList.filter(
        (item) =>
          item.type === "half" ||
          item.type === "recovery_half" ||
          item.type === "recovery_hours" ||
          item.type === "recovery_holiday",
      ),
    };
    setSavingRequest(true);
    try {
      localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
      const demo = demoMode
        ? "&demo=1"
        : "";
      window.location.href = `/formulaire/index.html?planning=1${demo}`;
    } catch (error) {
      setSavingRequest(false);
      notify(
        error instanceof DOMException
          ? "Le navigateur n’a pas pu préparer le formulaire. Vérifiez que le stockage du site est autorisé."
          : "Le formulaire n’a pas pu être préparé. Réessayez.",
      );
    }
  }

  function renderDay(date: Date, compact = false) {
    const info = getDayInfo(date, group);
    const key = dateKey(date);
    const entry = entries[key];
    const selected = selections[key];
    const cleanupSelected =
      calendarDeleteMode && calendarDeleteDates.includes(key);
    const today = sameDate(date, now);
    const hourlyRecoveryMinutes = recoveryUses
      .filter((item) => item.date === key)
      .reduce((total, item) => total + item.minutes, 0);
    const hasHourlyRecovery = hourlyRecoveryMinutes > 0;
    // La période elle-même, et pas seulement son existence : son type décide
    // de l'habillage de la case (récupération, demi-journée).
    const myPeriod = periods.find(
      (period) => key >= period.from && key <= period.to,
    );
    const hasLeavePeriod = Boolean(myPeriod);
    // Un jour marqué « Divers » : posé sur la seule journée, hors période.
    const personalDay = Boolean(showLeaves && entry?.leave);
    // Un congé souhaité n'est pas encore accordé : il se signale d'un liseré
    // vert, sans entrer dans les soldes.
    const wishDay = Boolean(showLeaves && entry?.wish);
    // Un congé posé sur un jour de repos n'a rien à marquer : la case est
    // déjà noire.
    const visibleLeave = Boolean(
      showLeaves && hasLeavePeriod && info.kind !== "off",
    );
    const wishOutline = wishDay && info.kind !== "off" && !hasLeavePeriod;
    // La récupération prend un aplat orange et la demi-journée un liseré sur
    // sa seule moitié. Une
    // demi-journée sans moment (celles venues du formulaire) garde le liseré
    // entier : rien n'indique quelle moitié marquer.
    const myLeaveType = visibleLeave ? myPeriod?.leaveType || "" : "";
    const myRecovery = myLeaveType === "recovery";
    const myHalfMoment =
      myLeaveType === "half" ? myPeriod?.halfMoment || "" : "";
    const visibleNote = Boolean(showNotes && entry?.noteText);
    const inPendingRange = Boolean(
      (rangeSelecting && separateDates.includes(key)) ||
        (noteSelecting && noteDates.includes(key)),
    );
    const rangeEdge = inPendingRange;
    const leaveLabel = [
      visibleLeave
        ? myRecovery
          ? "Récupération"
          : myHalfMoment
            ? `Demi-journée ${myHalfMoment === "morning" ? "matin" : "après-midi"}`
            : leaveTypeLabel(myLeaveType as LeaveType)
        : "",
      personalDay ? "Divers" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const title = [
      info.holiday,
      DAY_LABELS[info.kind],
      selected ? TYPE_LABELS[selected.type] : "",
      leaveLabel,
      hasHourlyRecovery
        ? `Récupération en heures (${minutesLabel(hourlyRecoveryMinutes)})`
        : "",
      visibleNote ? "Note enregistrée" : "",
    ]
      .filter(Boolean)
      .join(" — ");
    return (
      <button
        type="button"
        key={key}
        className={`${compact ? "mini-day" : "day"} ${info.kind}${date.getDay() === 0 || date.getDay() === 6 ? " weekend" : ""}${visibleLeave && !myRecovery && !myHalfMoment ? ` leave-day leave-${myLeaveType}` : ""}${personalDay ? " personal-day" : ""}${myRecovery ? " recovery-day" : ""}${hasHourlyRecovery ? " hourly-recovery-day" : ""}${myHalfMoment ? ` half-${myHalfMoment}` : ""}${wishOutline ? " wish-day" : ""}${today ? " today" : ""}${visibleNote ? " has-note" : ""}${selected || cleanupSelected ? " request-selected" : ""}${cleanupSelected ? " cleanup-selected" : ""}${inPendingRange ? " range-selected" : ""}${rangeEdge ? " range-edge" : ""}`}
        style={
          selected
            ? ({
                "--selection-color": TYPE_COLORS[selected.type],
              } as React.CSSProperties)
            : cleanupSelected
              ? ({ "--selection-color": "#c43d43" } as React.CSSProperties)
            : rangeSelecting
              ? ({ "--range-preview": "var(--leave)" } as React.CSSProperties)
              : noteSelecting
                ? ({ "--range-preview": noteColor } as React.CSSProperties)
                : undefined
        }
        onClick={() => handleDay(date)}
        title={title}
        aria-current={today ? "date" : undefined}
        aria-label={`${longDate(date)}, ${info.holiday ? `${info.holiday}, ` : ""}${DAY_LABELS[info.kind]}${selected ? `, ${TYPE_LABELS[selected.type]} sélectionné` : ""}${leaveLabel ? `, ${leaveLabel}` : ""}${hasHourlyRecovery ? `, récupération de ${minutesLabel(hourlyRecoveryMinutes)}` : ""}${visibleNote ? ", note enregistrée" : ""}`}
      >
        <span className={info.holiday ? "holiday-date" : "date-number"}>
          {date.getDate()}
        </span>
        {hasHourlyRecovery && !compact ? (
          <span className="hourly-recovery-label">
            Récup. {minutesLabel(hourlyRecoveryMinutes)}
          </span>
        ) : null}
        {visibleLeave &&
        (myLeaveType === "exceptional" ||
          myLeaveType === "childcare" ||
          myLeaveType === "sick") ? (
          <span
            className={`leave-calendar-marker leave-calendar-marker-${myLeaveType}${compact ? " compact" : ""}`}
            aria-hidden="true"
          >
            {myLeaveType === "exceptional"
              ? "ASA"
              : myLeaveType === "childcare"
                ? "👶"
                : myLeaveType === "sick"
                  ? "🤒"
                : ""}
          </span>
        ) : null}
        {(myLeaveType === "other" || personalDay) && (
          <span className={`other-pin${compact ? " compact" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 30 30">
              <path className="other-pin-needle" d="m13.5 18.2-2.2 10.3 5.3-10.9Z" />
              <path className="other-pin-body" d="M10 7.2h8l-1.1 7.1 3.5 2.6c1 .7.6 2.2-.6 2.4L9.2 20.8c-1.2.2-2-.9-1.4-2l2.9-3.4L10 7.2Z" />
              <ellipse className="other-pin-head" cx="14" cy="7" rx="6.4" ry="3.8" />
              <path className="other-pin-highlight" d="M10.7 5.9c1.6-1.3 4.5-1.7 6.5-.5" />
            </svg>
          </span>
        )}
        {(selected || cleanupSelected) && <span className="selection-corner" aria-hidden="true" />}
        {selected && !compact && (
          <span className="selection-label">
            {TYPE_LABELS[selected.type]}
            {selected.start ? ` · ${selected.start}–${selected.end}` : ""}
          </span>
        )}
        {visibleNote && (
          <span
            className={`note-band${myHalfMoment ? ` note-band-half-${myHalfMoment}` : ""}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <path d="m6 18 1.2-4.3L16.4 4.5l3.1 3.1-9.2 9.2L6 18Z" />
              <path d="m14.8 6.1 3.1 3.1" />
            </svg>
          </span>
        )}
      </button>
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
                  {item.label
                    .split("\n")
                    // Le tiret posé par « Ajouter une note » ferait doublon
                    // avec la puce : on ne garde que le texte.
                    .map((line) => line.replace(/^[–—\-•>]\s*/, "").trim())
                    .filter(Boolean)
                    .map((line, index) => (
                      <li key={index}>{line}</li>
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

  /** Enregistre l'un des trois montants du profil de paie. Le serveur ne
   *  touche que le champ transmis : les deux autres restent intacts. */
  async function savePayAmount(
    field:
      | "baseSalary"
      | "ifse"
      | "carenceDay"
      | "otherFixed"
      | "cia"
      | "netRatioFixed"
      | "netRatioVariable"
      | "navigo"
      | "mealVoucherDeduction"
      | "pasRate",
  ) {
    const draft = payDrafts[field];
    const value = Number(draft.replace(",", ".").replace(/\s/g, ""));
    if (!Number.isFinite(value) || value < 0) {
      notify("Montant invalide.");
      return;
    }
    if (
      (field === "netRatioFixed" ||
        field === "netRatioVariable" ||
        field === "pasRate") &&
      value > 100
    ) {
      notify("Le taux ne peut pas dépasser 100 %.");
      return;
    }
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
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
      [field]: value,
    };
    // Le taux net/brut est un pourcentage, pas un montant : le même calcul
    // ×100 en fait des points de base (79,65 % → 7965) plutôt que des
    // centimes, sans avoir besoin d'un second chemin de conversion.
    const cents = Math.round(value * 100);
    setSavingPay(field);
    try {
      if (
      !demoMode
      ) {
        await postCalendar({
            action: "save-form-profile",
            payYear: Number(payYear),
            fullName: nextProfile.fullName,
            group: nextProfile.group,
            signature: nextProfile.signature,
            ...(field === "baseSalary" ? { baseSalaryCents: cents } : {}),
            ...(field === "ifse" ? { ifseCents: cents } : {}),
            ...(field === "carenceDay" ? { carenceCents: cents } : {}),
            ...(field === "otherFixed" ? { otherFixedCents: cents } : {}),
            ...(field === "cia" ? { ciaCents: cents } : {}),
            ...(field === "netRatioFixed" ? { netRatioFixedBp: cents } : {}),
            ...(field === "netRatioVariable"
              ? { netRatioVariableBp: cents }
              : {}),
            ...(field === "navigo" ? { navigoCents: cents } : {}),
            ...(field === "mealVoucherDeduction"
              ? { mealVoucherDeductionCents: cents }
              : {}),
            ...(field === "pasRate" ? { pasRateBp: cents } : {}),
        });
      }
      setFormProfile(nextProfile);
      setPayProfiles((current) => ({
        ...current,
        [payYear]: { ...(current[payYear] || {}), [field]: value },
      }));
      // Pas de message de succès : `notify` est la fenêtre d'erreur. Le montant
      // affiché juste au-dessus se met à jour, et le champ se vide — la
      // confirmation est dans l'écran lui-même.
      setPayDrafts((current) => ({ ...current, [field]: "" }));
    } catch {
      notify("Le montant n’a pas pu être enregistré. Réessayez.");
    } finally {
      setSavingPay(null);
    }
  }

  /** Le mois de versement du CIA, saisi à part : c'est un choix, pas un
   *  montant, et il ne change pas chaque année. */
  async function saveCiaMonth(month: number) {
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
      signature: formProfile?.signature || "",
      status: formProfile?.status,
      workQuota: formProfile?.workQuota,
      baseSalary: formProfile?.baseSalary,
      residenceAllowance: formProfile?.residenceAllowance,
      ifse: formProfile?.ifse,
      carenceDay: formProfile?.carenceDay,
      otherFixed: formProfile?.otherFixed,
      cia: formProfile?.cia,
      ciaMonth: month,
      netRatioFixed: formProfile?.netRatioFixed,
      netRatioVariable: formProfile?.netRatioVariable,
      navigo: formProfile?.navigo,
      mealVoucherDeduction: formProfile?.mealVoucherDeduction,
      pasRate: formProfile?.pasRate,
      manualAdjustments: formProfile?.manualAdjustments,
    };
    setFormProfile(nextProfile);
    if (demoMode)
      return;
    try {
      await postCalendar({
          action: "save-form-profile",
          payYear: Number(payYear),
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          ciaMonth: month,
      });
      setPayProfiles((current) => ({
        ...current,
        [payYear]: { ...(current[payYear] || {}), ciaMonth: month },
      }));
    } catch {
      notify("Le mois du CIA n’a pas pu être enregistré. Réessayez.");
    }
  }

  /** Le bulletin qui suit chronologiquement celui qui porte (year, month),
   *  dans le cycle des quatre paies de dimanches. Décembre bascule sur
   *  janvier de l'année suivante ; janvier revient à juillet de la même
   *  année, puisque son bulletin porte le rappel de décembre précédent. */
  function nextSundayPayoutSlot(year: number, month: number) {
    if (month === 6) return { year, month: 9 };
    if (month === 9) return { year, month: 11 };
    if (month === 11) return { year: year + 1, month: 0 };
    if (month === 0) return { year, month: 6 };
    return null;
  }

  /** Reporte des dimanches manqués sur le bulletin suivant : la paie a un
   *  délai de traitement, un dimanche tardif peut n'apparaître qu'au rappel
   *  d'après plutôt que d'être perdu. */
  async function reportMissingSundays(
    fromYear: number,
    fromMonth: number,
    count: number,
  ) {
    const target = nextSundayPayoutSlot(fromYear, fromMonth);
    if (!target) return;
    const previous = formProfile;
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
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
      sundayCarryover: count,
      sundayCarryoverYear: target.year,
      sundayCarryoverMonth: target.month,
      sundayCarryoverFromYear: fromYear,
      sundayCarryoverFromMonth: fromMonth,
    };
    // Affiché tout de suite, mais annulé si l'enregistrement échoue : un
    // report qui semble pris alors qu'il ne l'est pas serait pire qu'une
    // erreur visible.
    setFormProfile(nextProfile);
    if (demoMode)
      return;
    try {
      await postCalendar({
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          sundayCarryover: count,
          sundayCarryoverYear: target.year,
          sundayCarryoverMonth: target.month,
          sundayCarryoverFromYear: fromYear,
          sundayCarryoverFromMonth: fromMonth,
      });
      // Pas de message de succès : la note « en attente » qui apparaît juste
      // en dessous, et la case d'origine qui se met à jour, sont déjà la
      // confirmation.
    } catch {
      setFormProfile(previous);
      notify("Le report n’a pas pu être enregistré. Réessayez.");
    }
  }

  /** Efface un report, une fois confirmé sur le bulletin suivant. */
  async function clearSundayCarryover() {
    const previous = formProfile;
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
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
      sundayCarryover: 0,
      sundayCarryoverYear,
      sundayCarryoverMonth,
      sundayCarryoverFromYear,
      sundayCarryoverFromMonth,
    };
    setFormProfile(nextProfile);
    if (demoMode)
      return;
    try {
      await postCalendar({
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          sundayCarryover: 0,
      });
    } catch {
      setFormProfile(previous);
      notify("Le report n’a pas pu être retiré. Réessayez.");
    }
  }

  /** Choisit la compensation d'un jour férié (prime seule ou prime + récup),
   *  travaillé ou compensé : utilisé directement depuis les tableaux
   *  d'Infos primes, sans passer par la fiche du jour. Pour un férié
   *  compensé (jour de repos, pas travaillé), c'est même le seul endroit où
   *  trancher. */
  async function chooseHolidayPay(key: string, choice: HolidayPay) {
    const current = entries[key];
    if (
      !demoMode
    ) {
      try {
        await postCalendar({
            action: "save-leaves",
            date: key,
            leave: Boolean(current?.leave),
            wish: Boolean(current?.wish),
            holidayPay: choice,
        });
      } catch {
        notify("Le choix n’a pas pu être enregistré. Réessayez.");
        return;
      }
    }
    setEntries((currentEntries) => ({
      ...currentEntries,
      [key]: { ...(currentEntries[key] || emptyEntry()), holidayPay: choice },
    }));
  }

  /** Les champs directement lisibles sur un bulletin. Les deux taux net/brut
   *  sont calculés séparément à partir d'au moins deux bulletins dont les
   *  primes diffèrent. */
  // IFSE et CIA écartés d'entrée pour une contractuelle : pas la peine de
  // les chercher sur un bulletin qui ne les porte pas.
  const PAYSLIP_IMPORT_FIELDS = [
    { key: "baseSalary" as const, label: "Traitement de base" },
    {
      key: "residenceAllowance" as const,
      label: "Indemnité de résidence",
    },
    ...(isContractuel ? [] : [{ key: "ifse" as const, label: "IFSE" }]),
    { key: "carenceDay" as const, label: "Jour de carence" },
    { key: "otherFixed" as const, label: "Autres éléments fixes" },
    ...(isContractuel ? [] : [{ key: "cia" as const, label: "CIA" }]),
    { key: "navigo" as const, label: "Navigo remboursé" },
    { key: "mealVoucherDeduction" as const, label: "Titres repas (retenue)" },
    { key: "pasRate" as const, label: "Taux d’imposition (PAS)" },
  ];

  /** Lit plusieurs bulletins sur l'appareil et remplit tout seul ce qui s'y
   *  trouve. Les fichiers ne sont ni envoyés, ni conservés : seuls les
   *  montants reconnus quittent l'appareil, dans le même appel que la
   *  saisie manuelle utilise déjà.
   *
   *  Certains éléments (Navigo, autres éléments fixes) évoluent d'une année
   *  à l'autre : entre plusieurs bulletins qui les portent, c'est celui du
   *  mois le plus récent qui l'emporte plutôt que le premier trouvé. */
  async function importPayslips(
    files: File[],
    mode: "verify" | "calibrate" = "verify",
  ) {
    setPayslipImportMode(mode);
    setPayslipImportError("");
    setPayslipImportResult(null);
    setPayslipError("");
    setPayslipNeedsPeriod(false);
    if (mode === "verify") {
      setPayslipCheck(null);
      setPayslipResultDetailsOpen(false);
    }
    if (!files.length) return;
    if (mode === "calibrate" && files.length < 2) {
      setPayslipImportError(
        "Choisissez au moins deux bulletins de mois différents pour affiner les taux.",
      );
      return;
    }
    setPayslipImportBusy(true);
    try {
      const items: Array<{ name: string; reading: PayslipReading }> = [];
      for (const file of files) {
        try {
          items.push({
            name: file.name,
            reading: readPayslip(
              await extractPayslipTokens(await file.arrayBuffer()),
            ),
          });
        } catch {
          // Un fichier illisible ne doit pas empêcher de lire les autres.
        }
      }
      if (!items.length) {
        setPayslipImportError("Aucun de ces fichiers n’a pu être ouvert.");
        return;
      }
      items.sort((a, b) => {
        const rank = (r: PayslipReading) =>
          r.year !== undefined && r.month !== undefined
            ? r.year * 12 + r.month
            : -1;
        return rank(b.reading) - rank(a.reading);
      });
      // Comparaison au calcul de l'appli : le bulletin le plus récent
      // (une fois triés ci-dessus) qui porte au moins un montant lisible.
      const readableItems = items.filter(
        (item) => item.reading.gross || item.reading.baseSalary,
      );
      const bestForCheck =
        readableItems.find(
          (item) =>
            item.reading.year === view.getFullYear() &&
            item.reading.month === view.getMonth(),
        ) || readableItems[0];
      if (bestForCheck && mode === "verify") {
        setPayslipCheck(bestForCheck);
        if (
          bestForCheck.reading.year !== undefined &&
          bestForCheck.reading.month !== undefined
        ) {
          setView(
            localDate(
              bestForCheck.reading.year,
              bestForCheck.reading.month,
              1,
            ),
          );
        } else {
          setPayslipFallbackMonth(view.getMonth());
          setPayslipFallbackYear(view.getFullYear());
          setPayslipNeedsPeriod(true);
        }
      } else {
        if (mode === "verify")
          setPayslipError(
            "Aucun bulletin n’a pu être lu pour la comparaison. Sa mise en page a peut-être changé.",
          );
      }
      const profileSource =
        mode === "verify" ? bestForCheck || items[0] : readableItems[0] || items[0];
      const targetPayYear = String(
        profileSource?.reading.year ?? view.getFullYear(),
      );
      const targetPayMonth =
        profileSource?.reading.month ?? view.getMonth();
      const targetNetRatioRegime: PayCalibrationRegime = payCalibrationRegime(
        Number(targetPayYear),
        targetPayMonth,
      );
      const targetPayProfile = payProfiles[targetPayYear];
      const found: Partial<Record<(typeof PAYSLIP_IMPORT_FIELDS)[number]["key"], number>> =
        {};
      let ciaMonth: number | undefined;
      for (const field of PAYSLIP_IMPORT_FIELDS) {
        for (const item of items) {
          const value = item.reading[field.key];
          if (value === undefined) continue;
          found[field.key] = value;
          if (field.key === "cia") ciaMonth = item.reading.month;
          break;
        }
      }
      // Un seul bulletin donne un net total pour deux taux inconnus. On
      // réunit donc les lectures successives de la session. Un même mois
      // réimporté remplace sa lecture précédente au lieu de compter deux fois.
      const rateSamplesByPeriod = new Map<
        string,
        { name: string; reading: PayslipReading }
      >();
      for (const item of [...payslipRateSamples, ...items]) {
        const period =
          item.reading.year !== undefined && item.reading.month !== undefined
            ? `${item.reading.year}-${item.reading.month}`
            : `file-${item.name}`;
        rateSamplesByPeriod.set(period, item);
      }
      const nextRateSamples = Array.from(rateSamplesByPeriod.values());
      setPayslipRateSamples(nextRateSamples);
      const compatibleRateReadings = readingsForCalibrationRegime(
        nextRateSamples.map((item) => item.reading),
        targetNetRatioRegime,
      );
      const calculatedRates = calculateNetRatios(compatibleRateReadings);
      const ignoredRateSampleCount =
        nextRateSamples.length - compatibleRateReadings.length;
      const automaticSundayReport = (() => {
        if (
          !bestForCheck ||
          bestForCheck.reading.year === undefined ||
          bestForCheck.reading.month === undefined ||
          bestForCheck.reading.year !== allowances?.year
        )
          return null;
        const expected =
          allowances.monthly.find(
            (slot) => slot.index === bestForCheck.reading.month,
          )?.sundayCount || 0;
        const count = unpaidSundays(
          expected,
          bestForCheck.reading.sundaysBeyondTen,
        );
        const target = nextSundayPayoutSlot(
          bestForCheck.reading.year,
          bestForCheck.reading.month,
        );
        return count > 0 && target
          ? {
              count,
              fromYear: bestForCheck.reading.year,
              fromMonth: bestForCheck.reading.month,
              target,
            }
          : null;
      })();
      const applied = PAYSLIP_IMPORT_FIELDS.filter(
        (field) => found[field.key] !== undefined,
      );
      if (!applied.length && !calculatedRates) {
        setPayslipImportError(
          "Aucun des montants attendus n’a été reconnu sur ces bulletins.",
        );
        return;
      }
      const nextProfile: FormProfile = {
        fullName: formProfile?.fullName || "",
        group: formProfile?.group || String(group),
        signature: formProfile?.signature || "",
        status: formProfile?.status,
        workQuota: formProfile?.workQuota,
        baseSalary:
          found.baseSalary ?? targetPayProfile?.baseSalary ?? formProfile?.baseSalary,
        residenceAllowance:
          found.residenceAllowance ??
          targetPayProfile?.residenceAllowance ??
          formProfile?.residenceAllowance,
        ifse: found.ifse ?? targetPayProfile?.ifse ?? formProfile?.ifse,
        carenceDay:
          found.carenceDay ?? targetPayProfile?.carenceDay ?? formProfile?.carenceDay,
        otherFixed:
          found.otherFixed ?? targetPayProfile?.otherFixed ?? formProfile?.otherFixed,
        cia: found.cia ?? targetPayProfile?.cia ?? formProfile?.cia,
        ciaMonth: ciaMonth ?? targetPayProfile?.ciaMonth ?? formProfile?.ciaMonth,
        netRatioFixed:
          calculatedRates?.netRatioFixed ??
          targetPayProfile?.netRatioFixed ??
          formProfile?.netRatioFixed,
        netRatioVariable:
          calculatedRates?.netRatioVariable ??
          targetPayProfile?.netRatioVariable ??
          formProfile?.netRatioVariable,
        netRatioRegime: calculatedRates
          ? targetNetRatioRegime
          : targetPayProfile?.netRatioRegime ?? formProfile?.netRatioRegime,
        navigo: found.navigo ?? targetPayProfile?.navigo ?? formProfile?.navigo,
        mealVoucherDeduction:
          found.mealVoucherDeduction ??
          targetPayProfile?.mealVoucherDeduction ??
          formProfile?.mealVoucherDeduction,
        pasRate: found.pasRate ?? targetPayProfile?.pasRate ?? formProfile?.pasRate,
        sundayCarryover:
          automaticSundayReport?.count ?? formProfile?.sundayCarryover,
        sundayCarryoverYear:
          automaticSundayReport?.target.year ??
          formProfile?.sundayCarryoverYear,
        sundayCarryoverMonth:
          automaticSundayReport?.target.month ??
          formProfile?.sundayCarryoverMonth,
        sundayCarryoverFromYear:
          automaticSundayReport?.fromYear ??
          formProfile?.sundayCarryoverFromYear,
        sundayCarryoverFromMonth:
          automaticSundayReport?.fromMonth ??
          formProfile?.sundayCarryoverFromMonth,
        manualAdjustments: formProfile?.manualAdjustments,
      };
      if (
      !demoMode
      ) {
        const body: Record<string, unknown> = {
          action: "save-form-profile",
          payYear: Number(targetPayYear),
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
        };
        if (found.baseSalary !== undefined)
          body.baseSalaryCents = Math.round(found.baseSalary * 100);
        if (found.residenceAllowance !== undefined)
          body.residenceAllowanceCents = Math.round(
            found.residenceAllowance * 100,
          );
        if (found.ifse !== undefined)
          body.ifseCents = Math.round(found.ifse * 100);
        if (found.carenceDay !== undefined)
          body.carenceCents = Math.round(found.carenceDay * 100);
        if (found.otherFixed !== undefined)
          body.otherFixedCents = Math.round(found.otherFixed * 100);
        if (found.cia !== undefined)
          body.ciaCents = Math.round(found.cia * 100);
        if (ciaMonth !== undefined) body.ciaMonth = ciaMonth;
        if (found.navigo !== undefined)
          body.navigoCents = Math.round(found.navigo * 100);
        if (found.mealVoucherDeduction !== undefined)
          body.mealVoucherDeductionCents = Math.round(
            found.mealVoucherDeduction * 100,
          );
        if (found.pasRate !== undefined)
          body.pasRateBp = Math.round(found.pasRate * 100);
        if (calculatedRates) {
          body.netRatioFixedBp = Math.round(
            calculatedRates.netRatioFixed * 100,
          );
          body.netRatioVariableBp = Math.round(
            calculatedRates.netRatioVariable * 100,
          );
          body.netRatioRegime = targetNetRatioRegime;
        }
        if (automaticSundayReport) {
          body.sundayCarryover = automaticSundayReport.count;
          body.sundayCarryoverYear = automaticSundayReport.target.year;
          body.sundayCarryoverMonth = automaticSundayReport.target.month;
          body.sundayCarryoverFromYear = automaticSundayReport.fromYear;
          body.sundayCarryoverFromMonth = automaticSundayReport.fromMonth;
        }
        await postCalendar(body);
      }
      setFormProfile(nextProfile);
      setPayProfiles((current) => ({
        ...current,
        [targetPayYear]: {
          ...(current[targetPayYear] || {}),
          ...Object.fromEntries(
            PAYSLIP_IMPORT_FIELDS.filter(
              (field) => found[field.key] !== undefined,
            ).map((field) => [field.key, found[field.key]]),
          ),
          ...(ciaMonth !== undefined ? { ciaMonth } : {}),
          ...(calculatedRates || {}),
          ...(calculatedRates
            ? { netRatioRegime: targetNetRatioRegime }
            : {}),
        },
      }));
      setPayslipImportResult({
        applied: [
          ...applied.map((field) => ({
            label: field.label,
            value:
              field.key === "pasRate"
                ? `${found[field.key]!.toLocaleString("fr-FR")} %`
                : euros(found[field.key]!),
          })),
          ...(calculatedRates
            ? [
                {
                  label: "Taux net avant impôt — traitement",
                  value: `${calculatedRates.netRatioFixed.toLocaleString("fr-FR")} %`,
                },
                {
                  label: "Taux net avant impôt — primes",
                  value: `${calculatedRates.netRatioVariable.toLocaleString("fr-FR")} %`,
                },
              ]
            : []),
        ],
        missing: [
          ...PAYSLIP_IMPORT_FIELDS.filter(
            (field) => found[field.key] === undefined,
          ).map((field) => field.label),
        ],
        adjustment: [
          automaticSundayReport
            ? `${automaticSundayReport.count} dimanche${s(
              automaticSundayReport.count,
            )} non payé${s(
              automaticSundayReport.count,
            )} retiré${s(
              automaticSundayReport.count,
            )} automatiquement du net de ${MONTHS[automaticSundayReport.fromMonth]} et reporté${s(
              automaticSundayReport.count,
            )} sur ${MONTHS[automaticSundayReport.target.month]}.`
            : undefined,
          ignoredRateSampleCount > 0
            ? `${ignoredRateSampleCount} bulletin${s(ignoredRateSampleCount)} d’un ancien régime de cotisations n’${
                ignoredRateSampleCount > 1 ? "ont" : "a"
              } pas été mélangé${s(ignoredRateSampleCount)} à la calibration.`
            : undefined,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      });
    } catch {
      setPayslipImportError(
        "La mise à jour n’a pas pu être enregistrée. Réessayez.",
      );
    } finally {
      setPayslipImportBusy(false);
    }
  }

  function openRequestChooser(origin: "general" | "planning" = "general") {
    setRequestOrigin(origin);
    setRequestChooser(true);
  }

  function openPlanningRequestMethod(
    kind: RequestKind,
    date?: string,
    requestedType?: SelectionType,
  ) {
    setDayDate(null);
    setPlanningRequestDate(date || null);
    if (kind === "leave" || kind === "other")
      setPendingLeaveType(requestedType || (kind === "other" ? "other" : "annual"));
    setPlanningRequestMethod(kind);
  }

  function openRecoveryTypeChooser(
    origin: "general" | "planning",
    date?: string,
  ) {
    setRequestChooser(false);
    setDayDate(null);
    setRecoveryTypeChooser({ origin, date: date || null });
  }

  function chooseRecoveryType(type: SelectionType) {
    const context = recoveryTypeChooser;
    if (!context) return;
    setPendingRecoveryType(type);
    setRecoveryTypeChooser(null);
    setPlanningRequestDate(context.date);
    setPlanningRequestMethod("recovery");
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
              : "hours";
      setRecoveryDraft((current) => ({
        ...current,
        date: date || current.date,
        kind: manualKind,
      }));
      setRecoveryDialogOpen(true);
      return;
    }
    if (kind === "other") {
      if (date) {
        openDay(fromKey(date));
        setDayLeave(true);
        setDayLeaveType("other");
        setLeaveRangeEnabled(true);
        setLeaveRangeFrom(date);
        setLeaveRangeTo(date);
      } else {
        openRange("other");
      }
      return;
    }
    if (date) {
      openDay(fromKey(date));
      setDayLeave(true);
      setDayLeaveType(pendingLeaveType as LeaveType);
      setLeaveRangeEnabled(true);
      setLeaveRangeFrom(date);
      setLeaveRangeTo(date);
      return;
    }
    openRange(pendingLeaveType as LeaveType);
  }

  /** Utilisé uniquement lorsque l'en-tête du PDF ne permet pas de reconnaître
   * sa période. Dans le cas normal, le mois et l'année sont automatiques. */
  function applyPayslipFallbackPeriod() {
    if (!payslipCheck) return;
    setPayslipCheck({
      ...payslipCheck,
      reading: {
        ...payslipCheck.reading,
        month: payslipFallbackMonth,
        year: payslipFallbackYear,
      },
    });
    setView(localDate(payslipFallbackYear, payslipFallbackMonth, 1));
    setPayslipNeedsPeriod(false);
    setPayslipResultDetailsOpen(false);
  }

  /** Le brut d'un mois quelconque de l'année affichée, pour comparer un
   *  bulletin au mois qu'il porte et non à celui qui est ouvert. */
  function grossForMonth(index: number) {
    const month = allowances?.monthly.find((slot) => slot.index === index);
    const overtime = paidOvertimeForPayPeriod(view.getFullYear(), index);
    const mecenat = mecenatForPayMonth(mecenatEntries, view.getFullYear(), index);
    // Même règle que dans `monthPay` : la retenue maladie de fonctionnaire ne
    // s'applique pas à une contractuelle.
    const sick = isContractuel ? 0 : sickLeaves?.byMonth[index]?.total || 0;
    return (
      baseSalary +
      ifse +
      otherFixed +
      (index === ciaMonth ? cia : 0) +
      SUNDAY_ALLOWANCE.monthlyFlat +
      (month?.sunday || 0) +
      (month?.holiday || 0) -
      sick +
      overtime.amount +
      mecenat.grossAmountCents / 100
    );
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

    const payEstimateDetails = (
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
        onPreviousMonth={() => changeAllowancesMonth(-1)}
        onNextMonth={() => changeAllowancesMonth(1)}
        onToday={goToday}
      />
    );
    return (
      <div className="request-archive-content allowances pay-functions-layout">
        <p className="pay-year-notice">
          Paramètres de paie pour <strong>{payYear}</strong>
          {payProfiles[payYear]
            ? " — valeurs enregistrées pour cette année."
            : " — valeurs actuelles utilisées comme point de départ ; la première modification créera l’historique de cette année."}
        </p>

        {showPayslipHelp ? (
          <section className="allowance-card">
            <header>
              <span>Comment ça marche</span>
              {!missing ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setPayslipHelpOpen(false)}
                >
                  Masquer
                </button>
              ) : null}
            </header>
            <p className="allowance-note">
              Estimer votre salaire en brut et en net demande des informations
              qui n’existent que sur un vrai bulletin de paie : le traitement
              de base (votre rémunération hors primes), le montant exact d’un
              jour de carence lors d’un arrêt maladie, et quelques lignes
              fixes plus rares (indemnité de résidence…). Un bulletin peut
              remplir ces valeurs automatiquement. Deux bulletins de mois
              différents permettent aussi d’affiner séparément le taux du
              traitement et celui des primes.
            </p>
            {!isContractuel ? (
              <p className="allowance-note">
                Pour un fonctionnaire, s’y ajoutent l’IFSE et le CIA.
              </p>
            ) : null}
            <p className="allowance-note">
              Le PDF est lu uniquement sur cet appareil et n’est jamais
              conservé. Seules les valeurs utiles à vos estimations sont
              enregistrées dans votre espace Planning Solo.
            </p>
          </section>
        ) : (
          <p className="allowance-note">
            <button
              type="button"
              className="text-button"
              onClick={() => setPayslipHelpOpen(true)}
            >
              Comment ça marche ?
            </button>
          </p>
        )}

        {payEstimateDetails}

          <section className="allowance-card pay-function-card payslip-verify-card">
            <header>
              <div>
                <span className="step-label">Contrôler une fiche réelle</span>
                <h3>Vérifier un bulletin</h3>
                <small>Pour voir si rien ne manque</small>
              </div>
              <small>Un seul PDF suffit</small>
            </header>
            <div className="payslip-guide-step active">
              <span className="payslip-guide-number">1</span>
              <div>
                <strong>Choisir le bulletin à vérifier</strong>
                <small>Son mois et son année seront reconnus automatiquement.</small>
              </div>
              <label className="payslip-drop">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={payslipImportBusy}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (files.length) void importPayslips(files, "verify");
                  }}
                />
                <span>
                  {payslipImportBusy && payslipImportMode === "verify"
                    ? "Lecture en cours…"
                    : "Choisir le PDF"}
                </span>
              </label>
            </div>
            {payslipCheck && !payslipNeedsPeriod && payslipCheck.reading.month !== undefined && payslipCheck.reading.year !== undefined ? (
              <>
                <div className="payslip-detected-period" role="status">
                  <span>Période reconnue</span>
                  <strong>{MONTHS[payslipCheck.reading.month]} {payslipCheck.reading.year}</strong>
                </div>
                {payslipCheck.reading.gross !== undefined ||
                payslipCheck.reading.netBeforeTax !== undefined ? (
                  <div className="payslip-actual-values" aria-label="Valeurs réellement lues sur le bulletin">
                    <span>Valeurs du bulletin</span>
                    {payslipCheck.reading.gross !== undefined ? (
                      <div>
                        <small>Brut réel</small>
                        <strong>{euros(payslipCheck.reading.gross)}</strong>
                      </div>
                    ) : null}
                    {payslipCheck.reading.netBeforeTax !== undefined ? (
                      <div>
                        <small>Net avant impôt réel</small>
                        <strong>{euros(payslipCheck.reading.netBeforeTax)}</strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            {payslipCheck && payslipNeedsPeriod ? (
              <div className="payslip-period-fallback">
                <div>
                  <strong>Période non reconnue</strong>
                  <small>Indiquez exceptionnellement le mois et l’année de ce bulletin.</small>
                </div>
                <ChoicePicker
                  value={payslipFallbackMonth}
                  options={MONTH_OPTIONS}
                  onChange={setPayslipFallbackMonth}
                  ariaLabel="Mois du bulletin"
                  className="payslip-month-picker"
                />
                <ChoicePicker
                  value={payslipFallbackYear}
                  options={YEAR_OPTIONS}
                  onChange={setPayslipFallbackYear}
                  ariaLabel="Année du bulletin"
                  className="payslip-year-picker"
                />
                <button type="button" className="secondary-button" onClick={applyPayslipFallbackPeriod}>
                  Utiliser cette période
                </button>
              </div>
            ) : null}
            {payslipImportMode === "verify" && payslipImportError ? (
              <p className="allowance-note warn">{payslipImportError}</p>
            ) : null}
            {payslipImportMode === "verify" && payslipImportResult ? (
              <>
                <p className="allowance-note">
                  {payslipImportResult.applied.length} champ
                  {s(payslipImportResult.applied.length)} rempli
                  {s(payslipImportResult.applied.length)} :{" "}
                  {payslipImportResult.applied
                    .map((item) => `${item.label} (${item.value})`)
                    .join(", ")}
                  .
                </p>
                {payslipImportResult.missing.length ? (
                  <p className="allowance-note warn">
                    Pas trouvé sur ces bulletins :{" "}
                    {payslipImportResult.missing.join(", ")}.
                  </p>
                ) : null}
                {payslipImportResult.adjustment ? (
                  <p className="allowance-note positive">
                    {payslipImportResult.adjustment}
                  </p>
                ) : null}
              </>
            ) : null}
            {payslipError ? (
              <p className="allowance-note warn">{payslipError}</p>
            ) : null}
            {payslipCheck ? (
            payslipCheck.reading.month === undefined ||
            payslipCheck.reading.year !== allowances.year ||
            payslipCheck.reading.month !== view.getMonth() ? (
              <p className="allowance-note warn">
                Ce bulletin
                {payslipCheck.reading.month !== undefined
                  ? ` porte ${MONTHS[payslipCheck.reading.month]} ${payslipCheck.reading.year}`
                  : " n’indique pas sa période"}{" "}
                mais sa période ne correspond pas encore au mois affiché.
                Réessayez ou indiquez sa période manuellement.
              </p>
            ) : (
            <>
              {payslipReview ? (
                <div className={`payslip-result-summary ${payslipReview.tone}`}>
                  <span className="payslip-result-icon" aria-hidden="true">
                    {payslipReview.tone === "ok" ? "✓" : payslipReview.tone === "warning" ? "!" : "?"}
                  </span>
                  <div>
                    <strong>{payslipReview.verdict}</strong>
                    <small>
                      {payslipReview.verified.length} contrôle
                      {s(payslipReview.verified.length)} fiable
                      {s(payslipReview.verified.length)} effectué
                      {s(payslipReview.verified.length)}
                      {payslipReview.unavailable.length
                        ? ` · ${payslipReview.unavailable.length} non vérifiable${s(payslipReview.unavailable.length)}`
                        : ""}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setPayslipResultDetailsOpen((current) => !current)
                    }
                    aria-expanded={payslipResultDetailsOpen}
                  >
                    {payslipResultDetailsOpen ? "Masquer le détail" : "Voir le détail"}
                  </button>
                </div>
              ) : null}
              {payslipResultDetailsOpen ? (
                <>
              <table className="allowance-table">
                <thead>
                  <tr>
                    <th scope="col">Ligne</th>
                    <th scope="col">Bulletin</th>
                    <th scope="col">Appli</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      {
                        key: "gross",
                        label: "Cumul brut",
                        found: payslipCheck.reading.gross,
                        computed: grossForMonth(payslipCheck.reading.month),
                      },
                      {
                        key: "base",
                        label: "Traitement de base",
                        found: payslipCheck.reading.baseSalary,
                        computed: baseSalary,
                      },
                      {
                        key: "ifse",
                        label: "IFSE",
                        found: payslipCheck.reading.ifse,
                        computed: ifse,
                      },
                      ...(overtimeForPayMonth.totalMinutes
                        ? [
                            {
                              key: "overtime",
                              label: `Heures supplémentaires (${minutesLabel(
                                overtimeForPayMonth.totalMinutes,
                              )})`,
                              found: undefined,
                              computed: overtimeForPayMonth.amount,
                            },
                          ]
                        : []),
                      ...(mecenatForCurrentPayMonth.totalMinutes
                        ? [
                            {
                              key: "mecenat",
                              label: `Mécénats (${minutesLabel(
                                mecenatForCurrentPayMonth.totalMinutes,
                              )})`,
                              found: undefined,
                              computed:
                                mecenatForCurrentPayMonth.grossAmountCents / 100,
                            },
                          ]
                        : []),
                    ] as const
                  ).map((row) => {
                    const gap =
                      row.found === undefined
                        ? null
                        : Math.abs(row.found - row.computed);
                    return (
                      <tr key={row.key}>
                        <th scope="row">
                          {row.label}
                          {gap === null ? (
                            <small>absent du bulletin</small>
                          ) : gap < 0.05 ? (
                            <small>concorde</small>
                          ) : (
                            <small className="gap">
                              écart de {euros(gap)}
                            </small>
                          )}
                        </th>
                        <td>
                          {row.found === undefined ? "—" : euros(row.found)}
                        </td>
                        <td className={gap !== null && gap >= 0.05 ? "pending" : ""}>
                          {euros(row.computed)}
                        </td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const found = payslipCheck.reading.sundaysBeyondTen;
                    const expected =
                      allowances.monthly.find(
                        (slot) => slot.index === payslipCheck.reading.month,
                      )?.sundayCount || 0;
                    const missing = expected - found;
                    return (
                      <tr>
                        <th scope="row">
                          Dimanches comptés
                          {missing === 0 ? (
                            <small>concorde</small>
                          ) : missing > 0 ? (
                            <small className="gap">
                              {missing} manquant{s(missing)}
                            </small>
                          ) : (
                            <small className="gap">
                              {-missing} de plus qu’attendu
                            </small>
                          )}
                        </th>
                        <td>{found}</td>
                        <td className={missing !== 0 ? "pending" : ""}>
                          {expected}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              {overtimeForPayMonth.totalMinutes ? (
                <p className="allowance-note">
                  {minutesLabel(overtimeForPayMonth.totalMinutes)} sont attendues
                  sur ce bulletin pour un montant brut estimé de {euros(
                    overtimeForPayMonth.amount,
                  )}. La ligne du PDF n’est pas encore reconnue de façon assez
                  fiable : vérifiez-la visuellement sur le bulletin.
                </p>
              ) : null}
              {mecenatForCurrentPayMonth.totalMinutes ? (
                <p className="allowance-note">
                  {minutesLabel(mecenatForCurrentPayMonth.totalMinutes)} de mécénat
                  sont attendues sur ce bulletin pour {euros(
                    mecenatForCurrentPayMonth.grossAmountCents / 100,
                  )} brut. La ligne du PDF n’est pas reconnue de façon assez
                  fiable : vérifiez-la visuellement sur le bulletin.
                </p>
              ) : null}
              <p className="allowance-note">
                {payslipCheck.name} · comparé à{" "}
                {MONTHS[payslipCheck.reading.month]} {payslipCheck.reading.year}
                . Un écart de quelques centimes vient des arrondis ; au-delà, il
                y a une vraie différence à comprendre.
              </p>
              {(() => {
                const found = payslipCheck.reading.sundaysBeyondTen;
                const expected =
                  allowances.monthly.find(
                    (slot) => slot.index === payslipCheck.reading.month,
                  )?.sundayCount || 0;
                const missing = expected - found;
                if (missing <= 0) return null;
                const target = nextSundayPayoutSlot(
                  payslipCheck.reading.year,
                  payslipCheck.reading.month,
                );
                if (!target) return null;
                return (
                  <p className="allowance-note">
                    {missing} dimanche{s(missing)} pas encore payé
                    {s(missing)}, sans doute pour un délai de traitement.{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        void reportMissingSundays(
                          payslipCheck.reading.year as number,
                          payslipCheck.reading.month as number,
                          missing,
                        )
                      }
                    >
                      Reporter sur {MONTHS[target.month]} {target.year}
                    </button>
                  </p>
                );
              })()}
                </>
              ) : null}
            </>
            )
          ) : null}
          {sundayCarryover > 0 &&
          sundayCarryoverMonth !== undefined &&
          sundayCarryoverYear !== undefined ? (
            <p className="allowance-note">
              {sundayCarryover} dimanche{s(sundayCarryover)} en attente sur{" "}
              {MONTHS[sundayCarryoverMonth]} {sundayCarryoverYear}.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => void clearSundayCarryover()}
              >
                Retirer le report
              </button>
            </p>
          ) : null}
          </section>

        <section className="allowance-card pay-function-card payslip-calibration-card">
          <header>
            <div>
              <span className="step-label">Améliorer la précision</span>
              <h3>Affiner mes estimations</h3>
              <small>Pour remplir automatiquement les éléments de paie</small>
            </div>
            <small>Facultatif</small>
          </header>
          <p className="allowance-note">
            Sélectionnez ensemble au moins deux bulletins de mois différents.
            Ils servent uniquement à distinguer plus précisément le taux du
            traitement de celui des primes ; les PDF ne sont pas conservés.
          </p>
          <label className="payslip-drop payslip-calibration-drop">
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={payslipImportBusy}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                if (files.length) void importPayslips(files, "calibrate");
              }}
            />
            <span>
              {payslipImportBusy && payslipImportMode === "calibrate"
                ? "Analyse en cours…"
                : "Choisir plusieurs bulletins"}
            </span>
          </label>
          {payslipImportMode === "calibrate" && payslipImportError ? (
            <p className="allowance-note warn">{payslipImportError}</p>
          ) : null}
          {payslipRateSamples.length ? (
            <div className={`payslip-calibration-status ${payslipRateCalibration.reason}`} role="status">
              <strong>
                {payslipRateCalibration.reason === "ready"
                  ? "Taux affinés automatiquement"
                  : payslipRateCalibration.reason === "not-enough-variation"
                    ? "Bulletins trop similaires"
                    : payslipRateCalibration.reason === "inconsistent"
                      ? "Calcul encore trop incertain"
                      : `${payslipRateCalibration.usableCount} bulletin${s(payslipRateCalibration.usableCount)} utilisable${s(payslipRateCalibration.usableCount)}`}
              </strong>
              <small>
                {payslipRateCalibration.reason === "ready"
                  ? "Les taux du traitement et des primes ont été mis à jour."
                  : "Il faut au moins deux mois lisibles avec des montants de primes différents."}
              </small>
            </div>
          ) : null}
        </section>

        {/* La retenue (un jour de carence puis 10 %/jour) est une règle de
            fonctionnaire ; le régime d'une contractuelle (IJSS, subrogation)
            est différent et n'est pas vérifié ici. */}
        {!isContractuel && sickLeaves.arrets.length > 0 && (
          <section className="allowance-card">
            <header>
              <span>Arrêts maladie {allowances.year}</span>
              <strong className="negative">−{euros(sickLeaves.total)}</strong>
            </header>
            <table className="allowance-table">
              <tbody>
                {sickLeaves.arrets.map((arret) => (
                  <tr key={arret.id}>
                    <th scope="row">
                      {periodLabel(arret.from, arret.to)}
                      <small>
                        {arret.days} jour{s(arret.days)} · carence +{" "}
                        {arret.reducedDays} à 10 %
                      </small>
                    </th>
                    <td className="negative">−{euros(arret.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="allowance-card pay-function-card pay-elements-card">
          <header>
            <div>
              <span className="step-label">Références utilisées par les calculs</span>
              <h3>Éléments de paie</h3>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setPaySettingsOpen((current) => !current)}
              aria-expanded={paySettingsOpen}
            >
              {paySettingsOpen ? "Replier" : missing ? "À compléter" : "Voir"}
            </button>
          </header>
          {paySettingsOpen ? (
            <>
          {missing ? (
            <p className="allowance-note warn">
              Information{netEstimateMissing.length > 1 ? "s" : ""} encore
              manquante{netEstimateMissing.length > 1 ? "s" : ""} : {netEstimateMissing.join(", ")}.
              Un bulletin lisible peut les remplir automatiquement.
            </p>
          ) : null}
          <div className="pay-field-grid">
          {(
            [
              {
                field: "baseSalary" as const,
                label: "Traitement de base",
                value: baseSalary,
                hint: "Ex. 1855,88",
                use: "primes de férié et retenue maladie",
              },
              {
                field: "ifse" as const,
                label: "IFSE",
                value: ifse,
                hint: "Ex. 416,66",
                use: "retenue maladie",
              },
              {
                field: "carenceDay" as const,
                label: "Jour de carence",
                value: carenceDay,
                hint: "Ex. 78,17",
                use: "à recopier du bulletin",
              },
              {
                field: "otherFixed" as const,
                label: isContractuel
                  ? "Indemnité de résidence"
                  : "Autres éléments fixes",
                value: otherFixed,
                hint: isContractuel ? "3 % du traitement, déjà calculée" : "Ex. 75,84",
                use: isContractuel
                  ? "3 % du traitement de base ; ne modifiez que si votre bulletin montre un autre montant"
                  : "résidence + SMIC comp. + ICHCSG + MGEN − transfert",
              },
              {
                field: "cia" as const,
                label: "CIA",
                value: cia,
                hint: "Ex. 476,00",
                use: "complément indemnitaire annuel",
              },
              {
                field: "netRatioFixed" as const,
                label: "Taux net avant impôt — traitement",
                value: netRatioFixed,
                hint: "",
                use: "estimation automatique, affinée lorsque les bulletins permettent un calcul fiable",
                percent: true,
                automatic: true,
              },
              {
                field: "netRatioVariable" as const,
                label: "Taux net avant impôt — primes",
                value: netRatioVariable,
                hint: "",
                use: "estimation automatique pour les dimanches, fériés et le CIA",
                percent: true,
                automatic: true,
              },
              {
                field: "navigo" as const,
                label: "Navigo remboursé",
                value: navigo,
                hint: "Ex. 68,10",
                use: "hors cumul brut, ajouté tel quel au net",
              },
              {
                field: "mealVoucherDeduction" as const,
                label: "Titres repas (retenue)",
                value: mealVoucherDeduction,
                hint: "Ex. 82,40",
                use: "hors cumul brut, retiré tel quel du net — jamais en décembre",
              },
              {
                field: "pasRate" as const,
                label: "Taux d’imposition (PAS)",
                value: pasRate,
                hint: "Ex. 1,70",
                use: "recopié de la ligne « PAS - Taux » du bulletin — mettez-le à jour si les impôts le changent",
                percent: true,
              },
            ]
          )
            .filter(
              (item) =>
                !isContractuel || (item.field !== "ifse" && item.field !== "cia"),
            )
            .map((item) => (
            <div className="pay-field" key={item.field}>
              <span className="pay-field-head">
                {item.label}
                <b className={item.value ? "" : "pending"}>
                  {item.value
                    ? item.percent
                      ? `${item.value.toLocaleString("fr-FR")} %`
                      : euros(item.value)
                    : "à renseigner"}
                </b>
              </span>
              {/* L'explication ne sert qu'à trouver la ligne sur le bulletin :
                  une fois le montant saisi, elle n'est plus que du bruit. */}
              {item.automatic || !item.value ? <small>{item.use}</small> : null}
              {item.automatic ? (
                <span className="pay-field-automatic">Automatique</span>
              ) : (
              <div className="salary-field">
                <input
                  type="text"
                  inputMode="decimal"
                  className="note-search-input"
                  placeholder={item.hint}
                  value={payDrafts[item.field]}
                  onChange={(event) =>
                    setPayDrafts((current) => ({
                      ...current,
                      [item.field]: event.target.value,
                    }))
                  }
                  aria-label={item.label}
                  title={item.use}
                />
                <button
                  type="button"
                  className="save-button"
                  onClick={() => void savePayAmount(item.field)}
                  disabled={
                    !payDrafts[item.field].trim() || savingPay === item.field
                  }
                  aria-label={`Enregistrer ${item.label}`}
                  title="Enregistrer"
                >
                  {savingPay === item.field ? (
                    "…"
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m4 10.5 4 4 8-9" />
                    </svg>
                  )}
                </button>
              </div>
              )}
            </div>
          ))}
          {!isContractuel && (
          <div className="pay-field">
            <span className="pay-field-head">
              Mois du CIA
              <b className={ciaMonth === undefined ? "pending" : ""}>
                {ciaMonth === undefined ? "à renseigner" : MONTHS[ciaMonth]}
              </b>
            </span>
            {ciaMonth === undefined ? (
              <small>versé une seule fois dans l’année</small>
            ) : null}
            <div className="salary-field">
              <ChoicePicker
                value={ciaMonth ?? -1}
                options={[
                  { value: 6, label: "Juillet" },
                  { value: 7, label: "Août" },
                  { value: 8, label: "Septembre" },
                ]}
                onChange={(month) => void saveCiaMonth(month)}
                ariaLabel="Choisir le mois de versement du CIA"
                layout="list"
                className="leave-type-picker cia-month-picker"
                placeholder="À renseigner"
              />
            </div>
          </div>
          )}
          </div>
            </>
          ) : (
            <button
              type="button"
              className="pay-settings-summary"
              onClick={() => setPaySettingsOpen(true)}
            >
              <strong>{missing ? "Des informations restent à renseigner" : "Paramètres enregistrés"}</strong>
              <span>
                {missing
                  ? "Le bulletin PDF peut remplir automatiquement les principaux champs."
                  : "Ouvrir seulement si un montant de votre bulletin change."}
              </span>
            </button>
          )}
        </section>
      </div>
    );
  }
  function renderAllowances() {
    if (!allowances) return null;
    const { sundayTotal } = allowances;
    const variableRows = [
      {
        label: "Dimanches",
        quantity: monthPay?.sundayCount
          ? `${monthPay.sundayCount} dimanche${s(monthPay.sundayCount)} versé${s(monthPay.sundayCount)} sur cette paie`
          : "Aucun dimanche versé sur cette paie",
        amount: monthPay?.sunday || 0,
      },
      {
        label: "Jours fériés",
        quantity: `${monthPay?.holidayCount || 0} concerné${s(monthPay?.holidayCount || 0)}`,
        amount: monthPay?.holiday || 0,
      },
      {
        label: "Heures supplémentaires payées",
        quantity: minutesLabel(overtimeForPayMonth.totalMinutes),
        amount: overtimeForPayMonth.ready ? overtimeForPayMonth.amount : null,
      },
      {
        label: "Mécénats",
        quantity: minutesLabel(mecenatForCurrentPayMonth.totalMinutes),
        amount: mecenatForCurrentPayMonth.grossAmountCents / 100,
      },
    ];
    const variableTotal = variableRows.reduce(
      (total, row) => total + (row.amount || 0),
      0,
    );
    return (
      <>
        <section className="allowance-card variable-pay-card" aria-labelledby="variable-pay-title">
          <header
            role="button"
            tabIndex={0}
            aria-expanded={payPeriodOpen}
            onClick={() => setPayPeriodOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setPayPeriodOpen((current) => !current);
            }}
          >
            <div className="pay-period-toggle">
              <span>
              <span className="step-label">Primes pour le mois</span>
              <h3 id="variable-pay-title">{MONTHS[view.getMonth()]} {view.getFullYear()}</h3>
              </span>
              <i aria-hidden="true">⌄</i>
            </div>
            <div className="variable-pay-heading-actions">
              <div className="pay-month-nav compact">
                <button type="button" className="pay-nav-arrow" onClick={(event) => { event.stopPropagation(); changeAllowancesMonth(-1); }} aria-label="Mois précédent">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
                </button>
                <button type="button" className="pay-nav-arrow" onClick={(event) => { event.stopPropagation(); changeAllowancesMonth(1); }} aria-label="Mois suivant">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
                </button>
                <button type="button" className="pay-today-button" onClick={(event) => { event.stopPropagation(); goToday(); }}>
                  Aujourd’hui
                </button>
              </div>
              <span className="variable-pay-total">
                <small>{payPeriodOpen ? "Fermer les détails" : "Ouvrir pour les détails"}</small>
                <strong>{euros(variableTotal)} <em>brut variable</em></strong>
              </span>
            </div>
          </header>
          {payPeriodOpen ? <div className="variable-pay-list">
            {variableRows.map((row) => (
              <article key={row.label}>
                <span><strong>{row.label}</strong><small>{row.quantity}</small></span>
                <b className={row.amount === null ? "pending" : ""}>
                  {row.amount === null ? "À calculer" : euros(row.amount)}
                </b>
              </article>
            ))}
          </div> : null}
        </section>
        <section className="allowance-overview" aria-labelledby="allowance-overview-title">
          <div className="allowance-overview-heading">
            <div>
              <span className="step-label">Résumé {allowances.year}</span>
              <h3 id="allowance-overview-title">Mes primes en un coup d’œil</h3>
            </div>
          </div>
          <div className="allowance-overview-grid">
            <article>
              <span>Dimanches travaillés</span>
              <strong>{allowances.sundayDone}</strong>
              <small>{allowances.sundayLeft} encore à venir</small>
            </article>
            <article>
              <span>Jours fériés dans l’année</span>
              <strong>{allowances.holidays.length}</strong>
              <small>{allowances.holidayPending ? `${allowances.holidayPending} à préciser` : "Tous renseignés"}</small>
            </article>
            <article>
              <span>Primes variables prévues</span>
              <strong>{euros(allowances.monthlyTotal)}</strong>
              <small>hors forfait mensuel</small>
            </article>
          </div>
          {allowances.holidayPending ? (
            <div className="allowance-summary-alert">
              <span aria-hidden="true">!</span>
              <strong>
                {allowances.holidayPending} jour{s(allowances.holidayPending)} férié{s(allowances.holidayPending)} à préciser
              </strong>
              <small>Choisissez la compensation dans le détail ci-dessous.</small>
            </div>
          ) : null}
        </section>

        <div className="allowance-detail-stack">
        <section className="allowance-card">
          <header>
            <span>Dimanches {allowances.year}</span>
            <strong>
              {allowances.sundayDone} <em>faits</em> · {allowances.sundayLeft}{" "}
              <em>à venir</em>
            </strong>
          </header>
          <p className="allowance-note">
            {allowances.sundayDone} fait sur {allowances.sundaysScheduledPast}{" "}
            à ce jour
          </p>
          <table className="allowance-table">
            <tbody>
              {SUNDAY_TIERS.map((tier) => {
                const size = Number.isFinite(tier.to)
                  ? tier.to - tier.from + 1
                  : 0;
                const reached = Math.max(
                  0,
                  Math.min(
                    allowances.sundayDone,
                    size ? tier.to : allowances.sundayDone,
                  ) -
                    (tier.from - 1),
                );
                const current = tier.label === allowances.tier.label;
                return (
                  <tr key={tier.label} className={current ? "current" : ""}>
                    <th scope="row">
                      Socle {tier.label}
                      {current ? <small>vous y êtes</small> : null}
                    </th>
                    <td>
                      {size ? (
                        <>
                          <span className="allowance-progress">
                            <i style={{ width: `${(reached / size) * 100}%` }} />
                          </span>
                          {reached} / {size}
                        </>
                      ) : (
                        reached
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="allowance-note">
            {allowances.sundayCount} dimanches sur l’année.{" "}
            {sundayTotal.unpaid
              ? `${sundayTotal.unpaid} au-delà du ${SUNDAY_ALLOWANCE.paidUntil}e : travaillés pour rien.`
              : `Plafond à ${SUNDAY_ALLOWANCE.paidUntil}, vous restez en dessous.`}
          </p>
        </section>

        <section className="allowance-card">
          <header>
            <span>Jours fériés {allowances.year}</span>
            <strong>
              {allowances.holidays.length} <em>travaillés</em>
            </strong>
          </header>
          {allowances.holidays.length ? (
            <table className="allowance-table">
              <tbody>
                {allowances.holidays.map((item) => (
                  <tr key={item.key}>
                    <th scope="row">
                      {item.name}
                      <small>
                        {shortDate(item.key)} · {holidayPayslip(item.key).label}
                      </small>
                    </th>
                    <td className={item.choice ? "" : "pending"}>
                      <div className="holiday-pay-cell">
                        {item.choice && holidayChoiceEditing !== item.key ? (
                          <button
                            type="button"
                            className="holiday-pay-amount"
                            onClick={() => setHolidayChoiceEditing(item.key)}
                            aria-label={`${euros(holidayAllowance(baseSalary, item.choice))}. Modifier le choix de compensation du ${shortDate(item.key)}`}
                            title="Cliquer pour modifier le choix"
                          >
                            {euros(holidayAllowance(baseSalary, item.choice))}
                          </button>
                        ) : (
                          <ChoicePicker
                            value={item.choice || ""}
                            options={HOLIDAY_PAY_OPTIONS}
                            onChange={(choice) => {
                              if (!choice) return;
                              setHolidayChoiceEditing(null);
                              void chooseHolidayPay(item.key, choice);
                            }}
                            ariaLabel={`Choisir la compensation du ${shortDate(item.key)}`}
                            className="holiday-pay-picker"
                            layout="list"
                            placeholder="À décider"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="allowance-note">Aucun férié travaillé cette année.</p>
          )}
          {allowances.holidayPending ? (
            <p className="allowance-note warn">
              {allowances.holidayPending} férié
              {s(allowances.holidayPending)} sans compensation choisie :
              cliquez sur « À décider » pour trancher.
            </p>
          ) : null}
        </section>

        {allowances.compensated.length > 0 && (
          <section className="allowance-card">
            <header>
              <span>Fériés compensés {allowances.year}</span>
              <strong>
                {allowances.compensated.length} <em>non travaillés</em>
              </strong>
            </header>
            <table className="allowance-table">
              <tbody>
                {allowances.compensated.map((item) => (
                  <tr key={item.key}>
                    <th scope="row">
                      {item.name}
                      <small>
                        {shortDate(item.key)} · paie de février{" "}
                        {allowances.year + 1}
                      </small>
                    </th>
                    <td className={item.choice ? "" : "pending"}>
                      <div className="holiday-pay-cell">
                        {item.choice && holidayChoiceEditing !== item.key ? (
                          <button
                            type="button"
                            className="holiday-pay-amount"
                            onClick={() => setHolidayChoiceEditing(item.key)}
                            aria-label={`${euros(holidayAllowance(baseSalary, item.choice))}. Modifier le choix de compensation du ${shortDate(item.key)}`}
                            title="Cliquer pour modifier le choix"
                          >
                            {euros(holidayAllowance(baseSalary, item.choice))}
                          </button>
                        ) : (
                          <ChoicePicker
                            value={item.choice || ""}
                            options={HOLIDAY_PAY_OPTIONS}
                            onChange={(choice) => {
                              if (!choice) return;
                              setHolidayChoiceEditing(null);
                              void chooseHolidayPay(item.key, choice);
                            }}
                            ariaLabel={`Choisir la compensation du ${shortDate(item.key)}`}
                            className="holiday-pay-picker"
                            layout="list"
                            placeholder="À décider"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        </div>
      </>
    );
  }

  // Le titre d'un mois de la vue Année l'ouvre en grand. On bascule sur la
  // vue Mois plutôt que d'agrandir sur place : c'est elle qui porte la barre
  // d'outils, donc « Poser un congé » et le reste restent accessibles.
  function openMonthFromYear(month: number) {
    setView(localDate(view.getFullYear(), month, 1));
    setMode("month");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const dayStoredPeriods = dayDate
    ? periods.filter((period) => dayDate >= period.from && dayDate <= period.to)
    : [];

  if (authStatus !== "ready") {
    return (
      <AuthScreen
        status={authStatus}
        email={loginEmail}
        password={loginPassword}
        busy={authBusy}
        error={authError}
        setEmail={setLoginEmail}
        setPassword={setLoginPassword}
        submitLogin={submitLogin}
        submitInvite={submitInvite}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="top-header">
        <div className="top-header-title">
          <p className="eyebrow">Planning Solo</p>
          <h1>
            {homeSection === "home"
              ? "Accueil"
              : homeSection === "leave"
                ? "Congés et récupérations"
                : homeSection === "pdf"
                  ? "Plannings PDF"
                  : payScreen === "allowances"
                    ? "Primes et jours fériés"
                    : payScreen === "payslip"
                      ? "Bulletins et estimations"
                      : "Ma paie"}
          </h1>
        </div>
        <div className="header-command-area">
          <div className="header-control-cluster">
            <div className="header-actions">
              {homeSection === "home" ? (
              <div className="view-switch" aria-label="Mode d’affichage">
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
              ) : null}
              <div className="account-menu" ref={accountMenuRef}>
            <button
              className={`account-button ${accountMenuOpen ? "open" : ""}`}
              type="button"
              ref={accountButtonRef}
              onClick={() => setAccountMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label="Compte"
            >
              {(userEmail[0] || "M").toUpperCase()}
            </button>
            {accountMenuOpen && (
              <div className="account-menu-panel" role="menu">
                <div className="account-menu-identity">
                  <strong>{formProfile?.fullName || "Mon compte"}</strong>
                  <small>{userEmail}</small>
                </div>
                <button
                  className="account-menu-data"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setDataManagementOpen(true);
                  }}
                >
                  Gérer mes données
                </button>
                <button
                  className="account-menu-leave"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    disconnect();
                  }}
                >
                  Se déconnecter
                </button>
              </div>
            )}
              </div>
            </div>
            <button
              className="main-menu-button"
              type="button"
              onClick={() => setMainMenuOpen(true)}
              aria-label="Ouvrir le menu principal"
              aria-expanded={mainMenuOpen}
              aria-controls="main-menu-drawer"
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>
          <button
            className={`app-update-button header-update-button${checkingAppUpdate ? " checking" : ""}`}
            type="button"
            onClick={() => void checkForAppUpdate()}
            disabled={checkingAppUpdate}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
            {checkingAppUpdate ? "Chargement de la mise à jour…" : "Vérifier les mises à jour"}
          </button>
        </div>
      </header>
      {mainMenuOpen ? (
        <div
          className="main-menu-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setMainMenuOpen(false)
          }
        >
          <aside className="main-menu-drawer" id="main-menu-drawer" aria-label="Menu principal">
            <header>
              <div>
                <span className="step-label">Planning Solo</span>
                <h2>Menu principal</h2>
              </div>
              <button type="button" onClick={() => setMainMenuOpen(false)} aria-label="Fermer le menu">×</button>
            </header>
            <nav>
              {([
                ["home", "Accueil", "Aujourd’hui, notes et planning"],
                ["leave", "Congés et récupérations", "Soldes, heures sup et mécénats"],
                ["pay", "Ma paie", "Estimations, primes et bulletins"],
                ["pdf", "Télécharger les plannings en PDF", "Choisir le planning puis générer le document"],
              ] as const).map(([key, title, detail]) => (
                <button
                  key={key}
                  type="button"
                  className={homeSection === key ? "active" : ""}
                  aria-current={homeSection === key ? "page" : undefined}
                  onClick={() => {
                    setHomeSection(key);
                    if (key === "pay") setPayScreen("overview");
                    setMainMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <span className="main-menu-copy"><strong>{title}</strong><small>{detail}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
              <button
                type="button"
                className="guide-menu-entry"
                onClick={() => {
                  setMainMenuOpen(false);
                  setGuideOpen(true);
                }}
              >
                <span className="main-menu-copy">
                  <strong>Mode d’emploi</strong>
                  <small>Comprendre le planning, les congés et la paie</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </nav>
            <div className="main-menu-secondary">
              <button type="button" onClick={() => { setMainMenuOpen(false); setDataManagementOpen(true); }}>
                Sauvegarde et restauration
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <ConnectionStatus {...connectionStatus} />

      {guidePromptOpen ? (
        <div className="modal-backdrop guide-prompt-backdrop" role="presentation">
          <section
            className="modal-card guide-prompt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-prompt-title"
          >
            <span className="guide-prompt-icon" aria-hidden="true">?</span>
            <span className="step-label">Bienvenue dans Planning Solo</span>
            <h2 id="guide-prompt-title">Souhaitez-vous consulter le mode d’emploi ?</h2>
            <p>
              Quelques minutes suffisent pour comprendre comment obtenir un
              planning et une estimation de paie fiables.
            </p>
            <div className="guide-prompt-actions">
              <button className="secondary-button" type="button" onClick={skipGuidePrompt}>
                Passer
              </button>
              <button className="primary-action" type="button" onClick={openGuideFromPrompt}>
                Consulter
              </button>
            </div>
            <small>Le mode d’emploi restera accessible dans le menu ☰, juste sous les plannings PDF.</small>
          </section>
        </div>
      ) : null}

      {guideOpen ? (
        <div className="modal-backdrop guide-backdrop" role="presentation">
          <section
            className="modal-card guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
          >
            <button className="modal-close" type="button" onClick={() => setGuideOpen(false)} aria-label="Fermer le mode d’emploi">×</button>
            <header className="guide-heading">
              <span className="step-label">Mode d’emploi</span>
              <h2 id="guide-title">Bien démarrer avec Planning Solo</h2>
              <p>Les étapes essentielles sont présentées en premier.</p>
            </header>

            <nav className="guide-toc" aria-label="Table des matières du mode d’emploi">
              <strong>Accès rapide</strong>
              {([
                ["guide-reliable-estimate", "1. Fiabiliser mes estimations"],
                ["guide-payslips", "2. Choisir mes bulletins"],
                ["guide-leave", "3. Poser un congé"],
                ["guide-recovery", "4. Récupérations et heures"],
                ["guide-navigation", "5. Accueil, menu et planning"],
                ["guide-pay", "6. Comprendre Ma paie"],
                ["guide-pdf", "7. Télécharger les plannings PDF"],
                ["guide-data", "8. Données et sauvegarde"],
              ] as const).map(([id, label]) => (
                <button type="button" key={id} onClick={() => scrollGuideTo(id)}>{label}</button>
              ))}
            </nav>

            <div className="guide-content">
              <section id="guide-reliable-estimate" className="guide-section important">
                <span className="guide-number">1</span>
                <div>
                  <h3>Commencer par fiabiliser les estimations</h3>
                  <p>
                    Enregistrez dans le planning tous vos <strong>congés validés</strong>.
                    Ils permettent à l’application de connaître les jours réellement
                    travaillés et d’estimer correctement les primes, les dimanches,
                    les jours fériés et la paie du mois.
                  </p>
                  <p>Un congé seulement souhaité reste indicatif et ne doit pas être traité comme un congé validé.</p>
                </div>
              </section>

              <section id="guide-payslips" className="guide-section important">
                <span className="guide-number">2</span>
                <div>
                  <h3>Déposer un ou, idéalement, plusieurs bulletins</h3>
                  <p>
                    Dans <strong>Ma paie → Bulletins et estimations → Affiner mes estimations</strong>,
                    un bulletin récent permet de préremplir les éléments de paie reconnus.
                    Plusieurs bulletins de mois différents donnent une estimation plus précise.
                  </p>
                  <ul>
                    <li>un mois ordinaire, pour identifier les éléments fixes ;</li>
                    <li>un mois avec primes, dimanche, jour férié ou heures payées, pour distinguer les éléments variables ;</li>
                    <li>si possible, un mois présentant une situation différente, par exemple une absence ou une régularisation.</li>
                  </ul>
                  <p>Les fichiers PDF analysés ne sont pas conservés par Planning Solo.</p>
                </div>
              </section>

              <section id="guide-leave" className="guide-section">
                <span className="guide-number">3</span>
                <div>
                  <h3>Poser un congé</h3>
                  <p>
                    Touchez <strong>Poser un congé</strong>, puis choisissez Congé,
                    Récupération, Arrêt maladie ou Divers. Chaque point d’entrée
                    ouvre ensuite le formulaire ou l’ajout manuel au planning. Divers,
                    lui, s’ajoute directement au calendrier.
                  </p>
                  <ul>
                    <li>Divers peut servir notamment pour une grève, une décharge syndicale ou une fermeture exceptionnelle ; il ne modifie ni la paie ni les soldes ;</li>
                    <li>depuis une case du calendrier : la date est déjà ciblée ;</li>
                    <li>un arrêt maladie est suivi séparément : il ne diminue pas vos droits à congés, mais intervient dans le suivi et l’estimation de paie ;</li>
                    <li>pour plusieurs jours : sélectionnez une période ou plusieurs dates distinctes.</li>
                  </ul>
                  <p>
                    Si vous commencez à utiliser l’application en cours d’année,
                    ouvrez <strong>Congés et récupérations → Reprendre mes absences précédentes</strong> :
                    vous pouvez saisir vos CA, RTT, fractionnements et dimanches déjà posés sans retrouver chaque date.
                  </p>
                  <p>
                    Avant de valider, relisez le résumé des dates, des types de congés et de leur effet.
                    Pour modifier ou annuler un congé déjà posé, ouvrez sa date : les deux actions sont affichées directement dans la fiche.
                  </p>
                </div>
              </section>

              <section id="guide-recovery" className="guide-section">
                <span className="guide-number">4</span>
                <div>
                  <h3>Récupérations, heures supplémentaires et mécénats</h3>
                  <p>
                    Le parcours Récupération conserve les choix journée, demi-journée,
                    heures et jour férié. Toutes les récupérations concernées utilisent
                    le solde d’heures de récupération.
                  </p>
                  <p>
                    Dans Congés et récupérations, déclarez les heures supplémentaires
                    avec leurs horaires de début et de fin,
                    ajoutez manuellement un ancien solde d’heures si nécessaire et
                    consultez l’historique. Les mécénats restent séparés et sont rattachés
                    automatiquement à la paie du mois suivant.
                  </p>
                </div>
              </section>

              <section id="guide-navigation" className="guide-section">
                <span className="guide-number">5</span>
                <div>
                  <h3>Utiliser l’accueil, le menu et le planning</h3>
                  <p>
                    L’accueil réunit Aujourd’hui en un coup d’œil, les notes et le planning.
                    Le groupe de cycle se modifie en touchant sa carte. Le menu ☰ placé
                    dans l’en-tête ouvre Congés et récupérations,
                    Ma paie, les PDF, puis ce mode d’emploi. La vérification des mises à jour
                    se trouve sous les commandes Mois, Année et menu de l’en-tête ; les
                    sauvegardes restent en bas du menu.
                  </p>
                  <p>Une note peut être associée à un ou plusieurs jours, même dans des mois différents.</p>
                </div>
              </section>

              <section id="guide-pay" className="guide-section">
                <span className="guide-number">6</span>
                <div>
                  <h3>Comprendre la rubrique Ma paie</h3>
                  <p>
                    Commencez par vérifier votre quotité et votre statut dans Mon profil paie.
                    Primes et jours fériés détaille les éléments variables par mois.
                    Bulletins et estimations permet de contrôler une fiche réelle, d’affiner
                    les paramètres et de consulter le détail estimé du mois affiché.
                  </p>
                </div>
              </section>

              <section id="guide-pdf" className="guide-section">
                <span className="guide-number">7</span>
                <div>
                  <h3>Télécharger les plannings en PDF</h3>
                  <p>
                    Ouvrez la rubrique dédiée depuis le menu, choisissez l’année et le groupe,
                    puis générez un groupe, les trois groupes ou votre planning avec congés.
                    L’option vacances scolaires ajoute le tableau annuel complet des zones A,
                    B et C, y compris les périodes déjà passées de l’année choisie.
                  </p>
                </div>
              </section>

              <section id="guide-data" className="guide-section">
                <span className="guide-number">8</span>
                <div>
                  <h3>Conserver et restaurer les données</h3>
                  <p>
                    La synchronisation du compte conserve les données distantes. Le menu
                    Sauvegarde et restauration permet aussi d’exporter une sauvegarde JSON
                    et de la restaurer. Attendez toujours la confirmation après une saisie.
                  </p>
                </div>
              </section>
            </div>

            <footer className="guide-footer">
              <button className="primary-action" type="button" onClick={() => setGuideOpen(false)}>J’ai compris</button>
            </footer>
          </section>
        </div>
      ) : null}

      {homeSection === "home" ? (
      <section className="today-overview" aria-labelledby="today-title">
        <div className="today-overview-heading">
          <div>
            <span className="step-label">En un coup d’œil</span>
            <h2 id="today-title">Aujourd’hui</h2>
            <small>{longDate(now)}</small>
          </div>
          <button
            className="primary-action add-action"
            type="button"
            onClick={() => openRequestChooser("general")}
          >
            Poser un congé
          </button>
        </div>
        <div className="today-overview-grid">
          <article className={`today-status tone-${todayOverview.tone}`}>
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Aujourd’hui</span>
              <strong>{todayOverview.status}</strong>
            </span>
          </article>
          <button
            className="today-next-work"
            type="button"
            onClick={() => {
              if (!todayOverview.nextWork) return;
              setHomeSection("home");
              setMode("month");
              setView(
                localDate(
                  todayOverview.nextWork.getFullYear(),
                  todayOverview.nextWork.getMonth(),
                  1,
                ),
              );
            }}
          >
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                <path d="m9 14 2 2 4-4" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Prochain jour travaillé</span>
              <strong>
                {todayOverview.nextWork
                  ? `${longDate(todayOverview.nextWork)}${
                      todayOverview.nextWorkKind === "training"
                        ? " — Formation"
                        : ""
                    }`
                  : "Aucun à venir"}
              </strong>
            </span>
          </button>
          <button
            className="today-leave-balance"
            type="button"
            onClick={() => {
              setHomeSection("leave");
            }}
            aria-label={`Congés restant : ${totalLeaveRemaining.toLocaleString("fr-FR")} jours. Afficher le détail des soldes.`}
          >
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                <path d="M8 13h8M8 17h5" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Congés restant :</span>
              <strong>{totalLeaveRemaining.toLocaleString("fr-FR")} jours à poser</strong>
              <small>Voir le détail des soldes</small>
            </span>
          </button>
          <button
            className="today-group-card"
            type="button"
            onClick={() => setGroupChooserOpen(true)}
            aria-label={`Modifier le groupe de cycle. Groupe actuel : ${group}`}
          >
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="7" cy="12" r="2.2" />
                <circle cx="12" cy="12" r="2.2" />
                <circle cx="17" cy="12" r="2.2" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Groupe de cycle</span>
              <strong>Groupe {group}</strong>
              <small>Modifier</small>
            </span>
            <span className="today-card-chevron" aria-hidden="true">›</span>
          </button>
        </div>
        {importantAlert ? (
          <button
            className="important-alert"
            type="button"
            onClick={() => {
              setHomeSection("pay");
              setPayScreen(sundayCarryover ? "payslip" : "allowances");
            }}
          >
            <span aria-hidden="true">!</span>
            <strong>{importantAlert}</strong>
            <small>Voir dans Ma paie</small>
          </button>
        ) : null}
      </section>
      ) : null}

      {homeSection === "home" ? (
        <section className="home-notes-section" aria-labelledby="home-notes-title">
          <div className="home-content-heading">
            <div>
              <span className="step-label">À ne pas oublier</span>
              <h2 id="home-notes-title">Mes notes</h2>
            </div>
            <button type="button" onClick={beginQuickNote}>Ajouter une note</button>
          </div>
          <NotesPanelContent
            hasAnyNote={hasAnyNote}
            query={noteQuery}
            onQueryChange={setNoteQuery}
            searchResults={noteSearchResults}
            upcoming={upcoming}
            renderItems={renderNoteItems}
          />
        </section>
      ) : null}

      {homeSection === "leave" ? (
        <>
          <section className="section-intro leave-intro">
            <div>
              <span className="step-label">Congés et récupérations</span>
              <h2>Mes absences et mes demandes</h2>
              <p>Vos soldes sont visibles immédiatement. Touchez une carte, puis une date pour ouvrir la fiche du jour.</p>
            </div>
            <button
              className="primary-action"
              type="button"
              onClick={() => openRequestChooser("general")}
            >
              Poser un congé
            </button>
          </section>
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
          <section className="leave-request-archive" aria-labelledby="leave-request-archive-title">
            <button
              className="request-archive-toggle"
              type="button"
              onClick={() => setArchiveOpen((current) => !current)}
              aria-expanded={archiveOpen}
            >
              <span className="request-archive-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 7h5l2 2h7v10H5zM7 4h7l2 2" />
                </svg>
              </span>
              <span className="request-archive-copy">
                <span className="step-label">Documents conservés sur cet appareil</span>
                <strong id="leave-request-archive-title">Mes demandes archivées</strong>
              </span>
              <span className="request-archive-summary">
                <small>{archivedRequests.length} formulaire{s(archivedRequests.length)}</small>
                <span className="request-archive-caret" aria-hidden="true">⌄</span>
              </span>
            </button>
            {archiveOpen ? (
              <div className="request-archive-list">
                {archivedRequests.length ? archivedRequests.map((request) => (
                  <article className="archived-request" key={request.id}>
                    <button className="archived-request-open" type="button" onClick={() => openArchivedRequest(request)}>
                      <span className="archived-request-pdf">PDF</span>
                      <span><strong>{request.name}</strong><small>{archivedRequestDate(request.updatedAt)}</small></span>
                    </button>
                    <button className="archived-request-delete" type="button" onClick={() => void deleteArchivedRequest(request)} aria-label={`Supprimer ${request.name}`}>×</button>
                  </article>
                )) : <p className="request-archive-empty">Aucune demande archivée sur cet appareil.</p>}
              </div>
            ) : null}
          </section>
          <section className="overtime-balance-card" aria-labelledby="overtime-balance-title">
            <div className="overtime-balance-heading">
              <div>
                <span className="step-label">Récupérations en heures</span>
                <h3 id="overtime-balance-title">Mes heures supplémentaires</h3>
                <p>Les heures à récupérer restent séparées de vos congés en jours.</p>
              </div>
              <strong>{minutesLabel(recoveryBalance.remaining)} disponibles</strong>
            </div>
            <div className="overtime-balance-summary">
              <article>
                <span>Gagnées</span>
                <strong>{minutesLabel(recoveryBalance.earned)}</strong>
              </article>
              <article>
                <span>Utilisées</span>
                <strong>{minutesLabel(recoveryBalance.used)}</strong>
              </article>
              <article className="remaining">
                <span>Restantes</span>
                <strong>{minutesLabel(recoveryBalance.remaining)}</strong>
              </article>
            </div>
            <div className="overtime-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() => setOvertimeDialogOpen(true)}
              >
                Déclarer des heures sup
              </button>
              <button
                type="button"
                className="secondary-button solidarity-hours-action"
                onClick={() => setSolidarityDialogOpen(true)}
              >
                Ajouter des heures manuellement
              </button>
            </div>
            <button
              type="button"
              className="soft-detail-button overtime-history-toggle"
              onClick={() => setOvertimeHistoryOpen((current) => !current)}
              aria-expanded={overtimeHistoryOpen}
            >
              {overtimeHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
            </button>
            {overtimeHistoryOpen ? (
              <div className="overtime-history">
                {!recoveryEarnings.length && !recoveryUses.length ? (
                  <p className="empty-state">Aucune heure supplémentaire enregistrée.</p>
                ) : null}
                {[...overtimeEntries]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => {
                    const payPeriod = nextPayPeriod(entry.date);
                    const state = recoveryEarningStates.get(entry.id);
                    return (
                      <article key={entry.id}>
                        <span className={`overtime-kind ${entry.disposition}`} aria-hidden="true" />
                        <div>
                          <strong>
                            {entry.id.startsWith("solidarity-")
                              ? `Heures de solidarité · +${minutesLabel(entry.minutes)}`
                              : `${minutesLabel(entry.minutes)} · ${entry.disposition === "paid" ? "À payer" : "À récupérer"}`}
                          </strong>
                          <span>{longDate(fromKey(entry.date))}</span>
                          <small>
                            {entry.id.startsWith("solidarity-")
                              ? state?.remainingMinutes
                                ? `${minutesLabel(state.remainingMinutes)} encore disponibles sur cet ajout manuel`
                                : "Ajout manuel entièrement utilisé"
                              : entry.disposition === "paid"
                              ? `Paiement prévu en ${MONTHS[payPeriod.month]} ${payPeriod.year}`
                              : state?.remainingMinutes
                                ? `${minutesLabel(state.remainingMinutes)} encore disponibles sur ce gain`
                                : "Gain entièrement utilisé"}
                          </small>
                        </div>
                        <button type="button" onClick={() => void deleteOvertimeEntry(entry)}>
                          Supprimer
                        </button>
                      </article>
                    );
                  })}
                {[...holidayRecoveryEarnings]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => {
                    const state = recoveryEarningStates.get(entry.id);
                    return (
                      <article key={entry.id} className="holiday-recovery-history">
                        <span className="overtime-kind recovery" aria-hidden="true" />
                        <div>
                          <strong>Prime + récupération · +{minutesLabel(entry.minutes)}</strong>
                          <span>{longDate(fromKey(entry.date))}</span>
                          <small>
                            Crédit automatique selon votre quotité
                            {state?.remainingMinutes
                              ? ` · ${minutesLabel(state.remainingMinutes)} disponibles`
                              : " · gain utilisé"}
                          </small>
                        </div>
                      </article>
                    );
                  })}
                {[...recoveryUses]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => (
                    <article key={entry.id} className="recovery-use-history">
                      <span className="overtime-kind used" aria-hidden="true" />
                      <div>
                        <strong>− {minutesLabel(entry.minutes)} · Récupération posée</strong>
                        <span>{longDate(fromKey(entry.date))}</span>
                        <small>Déduite du solde en heures</small>
                      </div>
                      <button type="button" onClick={() => void deleteRecoveryUse(entry)}>
                        Annuler
                      </button>
                    </article>
                  ))}
              </div>
            ) : null}
          </section>
          <section className="overtime-balance-card mecenat-balance-card" aria-labelledby="mecenat-history-title">
            <div className="overtime-balance-heading">
              <div>
                <span className="step-label">Distinct des heures supplémentaires</span>
                <h3 id="mecenat-history-title">Mécénats</h3>
                <p>Les montants bruts sont ajoutés automatiquement à l’estimation du mois suivant.</p>
              </div>
              <strong>{mecenatEntries.length} enregistré{s(mecenatEntries.length)}</strong>
            </div>
            <div className="mecenat-rate-summary" aria-label="Tarifs réglementaires des mécénats">
              <article>
                <span>De 7 h à 22 h</span>
                <strong>{euros(MECENAT_REGULATORY_RATES.dayRateCents / 100)}/h brut</strong>
              </article>
              <article>
                <span>De 22 h à 7 h</span>
                <strong>{euros(MECENAT_REGULATORY_RATES.nightRateCents / 100)}/h brut</strong>
              </article>
            </div>
            <div className="overtime-actions">
              <button
                type="button"
                className="primary-action mecenat-action"
                onClick={() => {
                  setMecenatDraft((current) => ({
                    ...current,
                    date: dateKey(now),
                  }));
                  setMecenatDialogOpen(true);
                }}
              >
                Déclarer un mécénat
              </button>
            </div>
            <button
              type="button"
              className="soft-detail-button overtime-history-toggle"
              onClick={() => setMecenatHistoryOpen((current) => !current)}
              aria-expanded={mecenatHistoryOpen}
            >
              {mecenatHistoryOpen ? "Masquer l’historique" : "Voir l’historique"}
            </button>
            {mecenatHistoryOpen ? (
              <div className="overtime-history mecenat-history">
                {!mecenatEntries.length ? (
                  <p className="empty-state">Aucun mécénat enregistré.</p>
                ) : null}
                {[...mecenatEntries]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => (
                    <article key={entry.id}>
                      <span className="overtime-kind mecenat" aria-hidden="true" />
                      <div>
                        <strong>{entry.start} → {entry.end} · {euros(entry.grossAmountCents / 100)} brut</strong>
                        <span>{longDate(fromKey(entry.date))} · {minutesLabel(entry.dayMinutes + entry.nightMinutes)}</span>
                        <small>Intégré automatiquement à la paie du mois suivant</small>
                      </div>
                      <button type="button" onClick={() => void deleteMecenatEntry(entry)}>
                        Supprimer
                      </button>
                    </article>
                  ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {homeSection === "pay" && allowances ? (
        <section className="pay-app-screen" aria-label="Ma paie">
          {payScreen === "overview" ? (
            <>
              <div className="native-screen-heading">
                <span className="step-label">Ma paie</span>
                <h2>Choisissez une rubrique</h2>
                <p>Chaque rubrique s’ouvre dans son propre écran.</p>
              </div>
              <section className={`pay-profile-settings${payProfileOpen ? " open" : ""}`} aria-labelledby="pay-profile-settings-title">
                <button
                  type="button"
                  className="pay-profile-summary"
                  onClick={() => setPayProfileOpen((current) => !current)}
                  aria-expanded={payProfileOpen}
                >
                  <span>
                    <span className="step-label">Configuration générale</span>
                    <strong id="pay-profile-settings-title">Mon profil de paie</strong>
                    <small>
                      {WORK_QUOTA_OPTIONS.find((option) => option.value === workQuota)?.label}
                      {" · "}
                      {PAY_STATUS_OPTIONS.find((option) => option.value === (formProfile?.status || "contractuel"))?.label}
                    </small>
                    {netEstimateComplete ? (
                      <span
                        className="pay-profile-completeness complete"
                        title="Les informations nécessaires à l’estimation du mois sont renseignées."
                      >
                        Profil complet
                      </span>
                    ) : null}
                  </span>
                  <span className="pay-profile-scroll-hint">Faire défiler</span>
                  <i aria-hidden="true">⌄</i>
                </button>
                {payProfileOpen ? <div className="pay-profile-settings-grid">
                  <label>
                    <span>Quotité de travail</span>
                    <ChoicePicker
                      value={workQuota}
                      options={WORK_QUOTA_OPTIONS.map(({ value, label }) => ({ value, label }))}
                      onChange={changeWorkQuota}
                      ariaLabel="Choisir la quotité de travail"
                      layout="list"
                      className="pay-profile-picker"
                    />
                    <small>{minutesLabel(workDayMinutes)} par jour</small>
                  </label>
                  <label>
                    <span>Statut</span>
                    <ChoicePicker
                      value={formProfile?.status || "contractuel"}
                      options={PAY_STATUS_OPTIONS}
                      onChange={changeStatus}
                      ariaLabel="Choisir le statut"
                      layout="list"
                      className="pay-profile-picker"
                    />
                    <small>Calculs adaptés à votre statut</small>
                  </label>
                </div> : null}
              </section>
              <div className="pay-category-grid">
                <button type="button" onClick={() => setPayScreen("allowances")}>
                  <span className="pay-category-icon allowances" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" /></svg>
                  </span>
                  <span>
                    <strong>Primes et jours fériés</strong>
                    <small>Dimanches, fériés, heures payées et mécénats</small>
                  </span>
                  <i aria-hidden="true">›</i>
                </button>
                <button type="button" onClick={() => setPayScreen("payslip")}>
                  <span className="pay-category-icon payslip" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h4" /></svg>
                  </span>
                  <span>
                    <strong>Bulletins et estimations</strong>
                    <small>Vérifier un bulletin et consulter le détail de la paie</small>
                  </span>
                  <i aria-hidden="true">›</i>
                </button>
              </div>
            </>
          ) : (
            <div className="pay-detail-screen">
              <header className="pay-detail-sticky-header">
                <button className="native-back-button" type="button" onClick={() => setPayScreen("overview")} aria-label="Revenir aux catégories de paie">
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  className="pay-detail-title-button"
                  onClick={() => setPayScreen("overview")}
                  aria-label="Fermer cette catégorie et revenir à Ma paie"
                >
                  <span className="step-label">Ma paie</span>
                  <h2>{payScreen === "allowances" ? "Primes et jours fériés" : "Bulletins et estimations"}</h2>
                  <small>{MONTHS[view.getMonth()]} {view.getFullYear()}</small>
                </button>
                <button className="pay-detail-close" type="button" onClick={() => setPayScreen("overview")} aria-label="Fermer cette catégorie">
                  ×
                </button>
              </header>
              {payScreen === "allowances" ? (
                <div
                  className={`request-archive-content allowances pay-dedicated-content${payMonthSlide ? ` pay-month-${payMonthSlide}` : ""}`}
                  onTouchStart={startAllowancesSwipe}
                  onTouchEnd={endAllowancesSwipe}
                >
                  {renderAllowances()}
                </div>
              ) : (
                <div
                  className={`pay-dedicated-content${payMonthSlide ? ` pay-month-${payMonthSlide}` : ""}`}
                  onTouchStart={startAllowancesSwipe}
                  onTouchEnd={endAllowancesSwipe}
                >
                  <aside className="payslip-leave-notice" aria-label="Conseil pour une estimation correcte">
                    <span aria-hidden="true">i</span>
                    <p>
                      <strong>Avant de vérifier votre bulletin</strong>
                      Pour que l’estimation soit correcte, renseignez dans le planning tous vos congés validés.
                    </p>
                  </aside>
                  {renderPayslipCheck()}
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {homeSection === "pdf" ? (
        <section className="pdf-download-screen" id="planning-pdf" aria-labelledby="pdf-download-title">
          <div className="native-screen-heading">
            <span className="step-label">Documents</span>
            <h2 id="pdf-download-title">Télécharger les plannings en PDF</h2>
            <p>Choisissez l’année, le groupe et les informations à afficher, puis générez le document.</p>
          </div>
          <div className="pdf-download-settings">
            <label>
              <span>Année du planning</span>
              <ChoicePicker
                value={view.getFullYear()}
                options={YEAR_OPTIONS}
                onChange={(year) => setView(localDate(year, view.getMonth(), 1))}
                ariaLabel="Sélectionner l’année du PDF"
                className="year-choice-picker"
              />
            </label>
            <label>
              <span>Groupe</span>
              <ChoicePicker
                value={group}
                options={GROUP_OPTIONS}
                onChange={changeGroup}
                ariaLabel="Sélectionner le groupe du PDF"
                className="year-choice-picker"
              />
            </label>
            <div className="school-vacation-choice">
              <button
                type="button"
                className={showSchoolVacationsOnPdf ? "school-vacation-toggle active" : "school-vacation-toggle"}
                aria-pressed={showSchoolVacationsOnPdf}
                onClick={() => setShowSchoolVacationsOnPdf((current) => !current)}
              >
                <i aria-hidden="true" />
                Afficher les vacances scolaires
              </button>
              {showSchoolVacationsOnPdf ? (
                <small>Les dates des zones A, B et C seront récapitulées sous le planning.</small>
              ) : null}
            </div>
          </div>
          <div className="pdf-download-actions">
            {([
              ["selected", `Groupe ${group}`, "Planning annuel · 1 page"],
              ["all", "Les 3 groupes", "Planning annuel · 3 pages"],
              ["my-leaves", `Groupe ${group} + mes congés`, "Planning annuel personnel · 1 page"],
            ] as const).map(([scope, title, detail]) => (
              <button
                key={scope}
                type="button"
                className={`pdf-action ${scope}`}
                disabled={pdfExporting !== null}
                onClick={() => void exportAnnualPlanning(scope, showSchoolVacationsOnPdf)}
              >
                <span className="pdf-action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" /></svg>
                </span>
                <span className="pdf-action-copy">
                  <strong>{pdfExporting === scope ? "Création…" : title}</strong>
                  <small>{detail}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className={`planning-workspace-shell${homeSection === "home" ? " framed" : ""}`}>
      {homeSection === "home" ? (
        <section className="home-planning-heading" aria-labelledby="home-planning-title">
          <div className="home-content-heading">
            <div>
              <span className="step-label">Calendrier</span>
              <h2 id="home-planning-title">Mon planning</h2>
            </div>
          </div>
        </section>
      ) : null}

      {showCalendarWorkspace ? (
        <>
      {mode !== "year" && (
        <section className="controls" aria-label="Choix du planning">
          <div className="year-choice planning-year-choice" aria-label="Choix de l’année affichée">
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
                  onChange={(year) =>
                    setView(localDate(year, view.getMonth(), 1))
                  }
                  ariaLabel="Sélectionner l’année"
                  className="year-choice-picker"
                />
              </div>
            </div>
          </div>
          <div className="year-choice planning-group-choice" aria-label="Choix du groupe">
            <span className="year-choice-label">Groupe</span>
            <div className="planning-group-action-row">
            <div className="year-stepper">
              <div className="year-select-display">
                <span className="year-calendar-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="7" cy="12" r="2.4" />
                    <circle cx="12" cy="12" r="2.4" />
                    <circle cx="17" cy="12" r="2.4" />
                  </svg>
                </span>
                <ChoicePicker
                  value={group}
                  options={GROUP_OPTIONS}
                  onChange={changeGroup}
                  ariaLabel="Sélectionner le groupe"
                  className="year-choice-picker"
                />
              </div>
            </div>
            </div>
          </div>
          {(
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
                  <span>
                    {dayCountLabel(workedDays.month.worked)} ce mois-ci
                  </span>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="m5 7.5 5 5 5-5" />
                  </svg>
                </button>
                {workedDaysOpen && (
                  <div className="worked-days-panel">
                    <article>
                      <span className="worked-days-scope">
                        {MONTHS[view.getMonth()]} {view.getFullYear()}
                      </span>
                      <strong>
                        {dayCountLabel(workedDays.month.worked)} jour
                        {s(workedDays.month.worked)}
                      </strong>
                      <small>
                        {dayCountLabel(workedDays.month.scheduled)} au cycle
                        {workedDays.month.onLeave
                          ? `, ${dayCountLabel(workedDays.month.onLeave)} de congé`
                          : ", aucun congé"}
                      </small>
                    </article>
                    {workedDays.thirds.map((third) => (
                      <article
                        key={third.label}
                        className={third.current ? "current" : ""}
                      >
                        <span className="worked-days-scope">
                          {third.label}
                          {third.current ? <em>en cours</em> : null}
                        </span>
                        <strong>
                          {dayCountLabel(third.worked)} jour
                          {s(third.worked)}
                        </strong>
                        <small>
                          {third.range} · {dayCountLabel(third.scheduled)} au
                          cycle
                          {third.onLeave
                            ? `, ${dayCountLabel(third.onLeave)} de congé`
                            : ", aucun congé"}
                        </small>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            className="primary-action planning-leave-mobile"
            type="button"
            onClick={() => openRequestChooser("planning")}
          >
            Poser un congé
          </button>
        </section>
      )}

      {mode === "year" && (
        <section className="summary" aria-label="Récapitulatif">
          <article>
            <strong>{totals.work}</strong>
            <span>jours travaillés</span>
          </article>
          <article>
            <strong>{totals.training}</strong>
            <span>jours de formation</span>
          </article>
          <article>
            <strong>{totals.workedHoliday}</strong>
            <span>jours fériés travaillés</span>
          </article>
        </section>
      )}

      <section className="shared-tools" aria-label="Outils du planning">
        <div className="filter-group">
          <span className="filter-title">Afficher</span>
          <button
            type="button"
            className={
              showLeaves ? "filter-chip leave active" : "filter-chip leave"
            }
            aria-pressed={showLeaves}
            onClick={() => setShowLeaves((value) => !value)}
          >
            <i />
            Congés
          </button>
          <button
            type="button"
            className={
              showNotes ? "filter-chip notes active" : "filter-chip notes"
            }
            aria-pressed={showNotes}
            onClick={() => setShowNotes((value) => !value)}
          >
            <i />
            Notes
          </button>
        </div>
      </section>

      {rangeSelecting && (
        <section
          className="range-selection-panel leave"
          id="range-selection-panel"
        >
          <div>
            <span className="step-label">
              Choix des dates ·{" "}
              {separatePeople.map(multiDatePersonLabel).join(" et ")}
              {separatePeople.includes("leave") &&
                ` · ${leaveTypeLabel(rangeLeaveType)}`}
            </span>
            <h2>
              {separateDates.length}{" "}
              {separateDates.length > 1
                ? "dates sélectionnées"
                : "date sélectionnée"}
            </h2>
            <p>
              Changez de mois si nécessaire et touchez chaque date pour
              l’ajouter ou la retirer.
            </p>
          </div>
          <div className="range-selection-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={cancelRangeSelection}
            >
              Annuler
            </button>
            <button
              className="save-button"
              type="button"
              onClick={saveSeparateLeaveDates}
              disabled={!separateDates.length || savingRange}
            >
              {savingRange
                ? "Synchronisation…"
                : "Enregistrer toutes les dates"}
            </button>
          </div>
        </section>
      )}

      {calendarDeleteMode ? (
        <CalendarCleanupPanel
          selectedCount={calendarDeleteDates.length}
          busy={deletingMultipleDates}
          onCancel={cancelCalendarCleanup}
          onDeleteAbsences={() =>
            void deleteMultiplePlanningDates(calendarDeleteDates, "absences")
          }
          onDeleteNotes={() =>
            void deleteMultiplePlanningDates(calendarDeleteDates, "notes")
          }
        />
      ) : null}

      <section
        className={`calendar-toolbar ${mode === "month" ? "month-toolbar" : "year-toolbar"}${mode === "year" ? " annual-toolbar" : ""}`}
      >
        <div className="period-navigation">
          {mode === "month" && (
            <ChoicePicker
              value={view.getMonth()}
              options={MONTH_OPTIONS}
              onChange={(month) =>
                setView(localDate(view.getFullYear(), month, 1))
              }
              ariaLabel="Sélectionner le mois"
              className="toolbar-month-picker"
            />
          )}
          <ChoicePicker
            value={view.getFullYear()}
            options={YEAR_OPTIONS}
            onChange={(year) => setView(localDate(year, view.getMonth(), 1))}
            ariaLabel="Sélectionner l’année"
            className="toolbar-year-picker"
          />
        </div>
        {mode === "year" && (
          <ChoicePicker
            value={group}
            options={GROUP_OPTIONS}
            onChange={changeGroup}
            ariaLabel="Sélectionner le groupe du planning annuel"
            layout="list"
            className="toolbar-group-picker"
          />
        )}
        <button className="today-button" type="button" onClick={goToday}>
          Aujourd’hui
        </button>
        {homeSection === "home" && mode === "month" && !calendarDeleteMode ? (
          <CalendarCleanupTrigger
            className="calendar-bulk-delete-mobile"
            onStart={startCalendarCleanup}
          />
        ) : null}
        <button
          className={`primary-action ${mode === "month" ? "planning-leave-desktop" : "planning-leave-annual"}`}
          type="button"
          onClick={() => openRequestChooser("planning")}
        >
          Poser un congé
        </button>
      </section>

      {homeSection === "home" && mode === "month" && !calendarDeleteMode ? (
        <CalendarCleanupTrigger
          className="calendar-bulk-delete-button"
          onStart={startCalendarCleanup}
        />
      ) : null}

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
          className={`request-panel calendar-request-panel${sickRequest ? " sick-request-panel" : requestKind === "other" ? " other-request-panel" : ""}`}
          id="request-panel"
          style={
            { "--active-color": TYPE_COLORS[activeType] } as React.CSSProperties
          }
        >
          <div className="request-heading">
            <div>
              <span className="step-label">Demande en préparation</span>
              <h2>
                {requestKind === "leave"
                  ? sickRequest
                    ? "Sélectionnez votre arrêt maladie"
                    : "Sélectionnez vos congés"
                  : requestKind === "other"
                    ? "Sélectionnez vos dates Divers"
                    : "Sélectionnez vos récupérations"}
              </h2>
            </div>
            <button
              className="text-button danger"
              type="button"
              onClick={cancelRequest}
            >
              Annuler la demande
            </button>
          </div>
          {requestKind === "other" ? (
            <div className="request-option-groups other-request-options">
              <section className="request-option-group">
                <h3>Divers</h3>
                <div className="type-tabs" aria-label="Divers">
                  <button
                    type="button"
                    className="active"
                    style={{ "--type-color": TYPE_COLORS.other } as React.CSSProperties}
                  >
                    <i />
                    {TYPE_LABELS.other}
                    {selectedCounts.other ? <b>{selectedCounts.other}</b> : null}
                  </button>
                </div>
                <p className="request-help">
                  Ces dates seront seulement visibles dans le planning : aucun effet sur la paie ou les soldes.
                </p>
              </section>
            </div>
          ) : requestKind === "leave" ? (
            sickRequest ? (
              <div className="request-option-groups sick-request-options">
                <section className="request-option-group">
                  <h3>Arrêt maladie</h3>
                  <div className="type-tabs" aria-label="Arrêt maladie">
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
              ] as Array<[string, SelectionType[]]>).map(([label, types]) => (
                <section className="request-option-group" key={label}>
                  <h3>{label}</h3>
                  <div className="type-tabs" aria-label={label}>
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
                ["Autres récupérations", ["recovery_hours", "recovery_holiday"]],
              ] as Array<[string, SelectionType[]]>).map(([label, types]) => (
                <section className="request-option-group" key={label}>
                  <h3>{label}</h3>
                  <div className="type-tabs" aria-label={label}>
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
        </section>
      )}

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
                  openRecoveryTypeChooser(requestOrigin);
                }}
              >
                <strong>Une récupération</strong>
                <span>Retrouvez le formulaire complet : journée, demi-journée, heures ou jour férié.</span>
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
                <strong>
                  <i className="other-choice-dot" aria-hidden="true" />
                  Divers
                  <small className="other-choice-examples">
                    (Grève, décharge syndicale, fermeture exceptionnelle)
                  </small>
                </strong>
                <span>Visible dans le planning, sans effet sur la paie ni sur vos soldes.</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {recoveryTypeChooser ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setRecoveryTypeChooser(null)
          }
        >
          <section
            className="modal-card request-choice recovery-type-choice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-type-choice-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setRecoveryTypeChooser(null)}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">Récupération</span>
            <h2 id="recovery-type-choice-title">Quel type de récupération souhaitez-vous poser ?</h2>
            <div className="choice-grid recovery-type-choice-grid">
              {([
                "recovery_day",
                "recovery_half",
                "recovery_hours",
                "recovery_holiday",
              ] as SelectionType[]).map((type) => (
                <button type="button" key={type} onClick={() => chooseRecoveryType(type)}>
                  <strong>{TYPE_LABELS[type]}</strong>
                  <span>Utilise votre solde d’heures de récupération.</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

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
              Comment souhaitez-vous enregistrer {planningRequestMethod === "recovery" ? "cette récupération" : planningRequestMethod === "other" ? "ce Divers" : "cette demande"} ?
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
                  {planningRequestMethod === "other"
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
                      : "Choisissez journée, demi-journée, heures ou jour férié."}
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
                        Congé professionnel
                        <span>{dayLeave ? "Modifier" : "Choisir"}</span>
                      </button>
                      <button
                        type="button"
                        className="recovery"
                        onClick={() =>
                          openRecoveryTypeChooser("planning", dayDate)
                        }
                      >
                        <i />
                        Récupération
                        <span>Choisir</span>
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
                        <span>Sans effet paie/solde</span>
                      </button>
                      <button
                        type="button"
                        className={dayWish ? "wish active" : "wish"}
                        onClick={() => {
                          setDayWish((value) => {
                            if (!value) {
                              setLeaveRangeEnabled(true);
                              setLeaveRangeFrom(dayDate);
                              setLeaveRangeTo(dayDate);
                            }
                            return !value;
                          });
                        }}
                      >
                        <i />
                        Congé souhaité
                        <span>{dayWish ? "Ajouté" : "Ajouter"}</span>
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
                          onClick={() => setDayWish(false)}
                        >
                          Annuler le souhait
                        </button>
                      </div>
                    </div>
                  )}
                {dayLeave &&
                  (["annual", "half", "rtt", "fraction", "childcare", "exceptional"] as LeaveType[]).includes(dayLeaveType) && (
                  <div className="leave-type-field">
                    <span>Type de congé</span>
                    <ChoicePicker
                      value={dayLeaveType}
                      options={LEAVE_TYPE_OPTIONS.filter((option) =>
                        ["annual", "half", "rtt", "fraction", "childcare", "exceptional"].includes(option.value),
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
                        <div className="period-direct-actions" aria-label={`Gérer ${periodLabel(period.from, period.to)}`}>
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
                            Annuler le congé
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
                  : `${balanceDetail.used > 1 ? "jours" : "jour"} d’arrêt · aucun congé déduit`}
              </span>
            </div>
            <h3>{balanceDetail.quota ? "Jours déduits" : "Jours d’arrêt"}</h3>
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
                  {month.details.map((detail, index) => (
                    <article
                      key={`${detail.date}-${detail.units}-${index}`}
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
                          <small>Voir et gérer cette absence</small>
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

      <ManualAdjustmentsDialog
        open={manualAdjustmentsOpen}
        year={absenceYear}
        draft={manualAdjustmentDraft}
        setDraft={setManualAdjustmentDraft}
        saving={savingManualAdjustments}
        onClose={() => setManualAdjustmentsOpen(false)}
        onSave={() => void saveManualAdjustments()}
      />

      <RangeLeaveDialog
        open={rangeOpen}
        leaveType={rangeLeaveType}
        setLeaveType={setRangeLeaveType}
        halfMoment={rangeHalfMoment}
        setHalfMoment={setRangeHalfMoment}
        onClose={() => setRangeOpen(false)}
        onStartSelection={beginRangeSelection}
      />

      <MecenatDialog
        open={mecenatDialogOpen}
        draft={mecenatDraft}
        setDraft={setMecenatDraft}
        calculation={mecenatDraftCalculation}
        saving={savingMecenat}
        onClose={() => setMecenatDialogOpen(false)}
        onSave={() => void saveMecenatEntry()}
      />

      <OvertimeDialog
        open={overtimeDialogOpen}
        draft={overtimeDraft}
        setDraft={setOvertimeDraft}
        saving={savingOvertime}
        onClose={() => setOvertimeDialogOpen(false)}
        onSave={() => void saveOvertimeEntry()}
      />

      <SolidarityHoursDialog
        open={solidarityDialogOpen}
        draft={solidarityDraft}
        setDraft={setSolidarityDraft}
        saving={savingOvertime}
        onClose={() => setSolidarityDialogOpen(false)}
        onSave={() => void saveSolidarityHours()}
      />

      <RecoveryUseDialog
        open={recoveryDialogOpen}
        draft={recoveryDraft}
        setDraft={setRecoveryDraft}
        workDayMinutes={workDayMinutes}
        remainingMinutes={recoveryBalance.remaining}
        saving={savingOvertime}
        onClose={() => setRecoveryDialogOpen(false)}
        onSave={() => void saveRecoveryUse()}
      />

      <TimeSelectionDialog
        date={timeDate}
        activeType={activeType}
        start={timeStart}
        end={timeEnd}
        onStartChange={setTimeStart}
        onEndChange={setTimeEnd}
        onClose={() => setTimeDate(null)}
        onConfirm={commitTime}
      />
      <NonWorkingDayWarningDialog
        date={warningDate}
        group={group}
        onCancel={() => setWarningDate(null)}
        onConfirm={confirmWarning}
      />
      <DeletePeriodDialog
        period={deletingPeriod}
        saving={savingRange}
        onCancel={() => setDeletingPeriod(null)}
        onConfirm={deleteLeavePeriod}
      />
      <MessageDialog message={message} onClose={dismiss} />
      <SuccessToast message={successMessage} onClose={dismissSuccess} />
      <DataManagementDialog
        open={dataManagementOpen}
        busy={dataManagementBusy}
        onClose={() => setDataManagementOpen(false)}
        onExport={() => void exportDataBackup()}
        onImport={(file) => void importDataBackup(file)}
        onArchiveLegacy={() => void archiveLegacyData()}
        onDeleteAll={() => void deleteAllUserData()}
      />
      {installPrompt && (
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
