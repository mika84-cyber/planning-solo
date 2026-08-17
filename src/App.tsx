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
  type NoteListItem,
  type PayStatus,
  type RequestKind,
  type SelectedDay,
  type SharedEntry,
  type ViewMode,
} from "./appModel";
import { useAnnualPdfExport } from "./useAnnualPdfExport";
import { useInstallPrompt } from "./useInstallPrompt";
import {
  extractPayslipTokens,
  readPayslip,
  type PayslipReading,
} from "./payslip";
import { useToast } from "./useToast";
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
  SCHOOL_ZONE_OPTIONS,
  SUNDAY_ALLOWANCE,
  SUNDAY_TIERS,
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
  SHORT_DAYS,
  TYPE_COLORS,
  TYPE_LABELS,
  YEAR_OPTIONS,
  addDays,
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
  periodLabel,
  sameDate,
  shortDate,
  type CountedOnlyType,
  type HalfMoment,
  type HolidayPay,
  type LeaveType,
  type MultiDatePerson,
  type SchoolZone,
  type SelectionType,
} from "./planningLogic";

const HANDOFF_KEY = "planning:form-handoff-v1";

export default function Home() {
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
  const [refreshingCalendar, setRefreshingCalendar] = useState(false);
  const [entries, setEntries] = useState<Entries>({});
  const [periods, setPeriods] = useState<LeavePeriod[]>([]);
  const [formProfile, setFormProfile] = useState<FormProfile | null>(null);
  const [dayDate, setDayDate] = useState<string | null>(null);
  // Identifiant de la période dont le menu d'actions est ouvert. Un seul à la
  // fois : trois boutons par ligne saturaient la fenêtre du jour.
  const [periodMenuId, setPeriodMenuId] = useState("");
  const periodMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!periodMenuId) return;
    const close = (event: MouseEvent) => {
      if (!periodMenuRef.current?.contains(event.target as Node))
        setPeriodMenuId("");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPeriodMenuId("");
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [periodMenuId]);
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
  const [requestKind, setRequestKind] = useState<RequestKind | null>(null);
  const [savingRequest, setSavingRequest] = useState(false);
  const [activeType, setActiveType] = useState<SelectionType>("annual");
  const [selections, setSelections] = useState<Record<string, SelectedDay>>({});
  const [timeDate, setTimeDate] = useState<string | null>(null);
  const [timeStart, setTimeStart] = useState("09:15");
  const [timeEnd, setTimeEnd] = useState("13:00");
  const [warningDate, setWarningDate] = useState<string | null>(null);
  const { message, notify, dismiss } = useToast();
  const [balanceDetailType, setBalanceDetailType] = useState<
    BalanceType | CountedOnlyType | null
  >(null);
  const [balancesOpen, setBalancesOpen] = useState(false);
  const [allowancesOpen, setAllowancesOpen] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState(false);
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
  } | null>(null);
  // Repliés dès que les champs essentiels sont déjà remplis : utile une fois
  // pour comprendre et importer, plus après. `true` force l'affichage même
  // dans ce cas — posé manuellement, ou automatiquement après un import.
  const [payslipHelpOpen, setPayslipHelpOpen] = useState(false);
  const [payslipToolsOpen, setPayslipToolsOpen] = useState(false);
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
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const [schoolVacationZone, setSchoolVacationZone] =
    useState<SchoolZone>("C");
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
      if (
        import.meta.env.DEV &&
        new URLSearchParams(location.search).has("demo")
      ) {
        setUserEmail("demo@demo.local");
        setAuthStatus("ready");
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
    const response = await fetch("/api/calendar", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      setAuthStatus("guest");
      return;
    }
    if (!response.ok) throw new Error("sync");
    const data = await response.json();
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
          // Stockés en centimes côté serveur pour éviter les arrondis.
          baseSalary:
            typeof data.form_profile.base_salary_cents === "number"
              ? data.form_profile.base_salary_cents / 100
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
        }
      : null;
    setFormProfile(syncedProfile);
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
      };
    setEntries(next);
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
  async function refreshCalendar() {
    if (refreshingCalendar) return;
    setRefreshingCalendar(true);
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
      await loadCalendar();
    } catch {
      notify(
        "Le planning n’a pas pu être rafraîchi. Vérifiez votre connexion.",
      );
    } finally {
      setRefreshingCalendar(false);
    }
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
    setEntries({});
    setPeriods([]);
    setFormProfile(null);
    setUserEmail("");
    setAuthStatus("guest");
  }
  function changeGroup(nextGroup: number) {
    setGroup(nextGroup);
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: String(nextGroup),
      signature: formProfile?.signature || "",
      status: formProfile?.status,
      baseSalary: formProfile?.baseSalary,
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
    };
    setFormProfile(nextProfile);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
      return;
    void fetch("/api/calendar", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save-form-profile",
        fullName: nextProfile.fullName,
        group: nextProfile.group,
        signature: nextProfile.signature,
      }),
    }).catch(() => undefined);
  }
  /** IFSE, CIA et les primes automatiques (dimanche, férié, net estimé) sont
   *  calées sur les règles d'un fonctionnaire. Passer sur « Contractuel »
   *  ne touche à aucun montant déjà saisi : ça change seulement ce qui
   *  s'affiche, au cas où ce statut serait choisi puis annulé. */
  function changeStatus(nextStatus: PayStatus) {
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
      signature: formProfile?.signature || "",
      status: nextStatus,
      baseSalary: formProfile?.baseSalary,
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
    };
    setFormProfile(nextProfile);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
      return;
    void fetch("/api/calendar", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save-form-profile",
        fullName: nextProfile.fullName,
        group: nextProfile.group,
        signature: nextProfile.signature,
        status: nextStatus,
      }),
    }).catch(() => undefined);
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

  const managedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.from.localeCompare(b.from)),
    [periods],
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
      month: workedDayCount(year, month, month, group, periods, entries),
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
        ),
      })),
    };
  }, [view, group, periods, entries, now]);

  // Fonctionnaire tant que le statut n'a pas encore été choisi : c'était le
  // seul cas géré avant l'ajout de ce champ.
  const isContractuel = formProfile?.status === "contractuel";
  const baseSalary = formProfile?.baseSalary || 0;
  const ifse = formProfile?.ifse || 0;
  const carenceDay = formProfile?.carenceDay || 0;
  // Pour une contractuelle, la seule ligne fixe confirmée est l'indemnité de
  // résidence (3 % du traitement) : calculée toute seule plutôt que saisie,
  // et pas la somme à cinq lignes propre à un fonctionnaire (résidence +
  // SMIC comp. + ICHCSG + MGEN − transfert), dont rien ne dit qu'elle
  // s'applique à elle. Une valeur déjà saisie à la main reste prioritaire,
  // au cas où son bulletin réel montrerait autre chose.
  const otherFixed =
    formProfile?.otherFixed ??
    (isContractuel ? baseSalary * RESIDENCE_ALLOWANCE_RATE : 0);
  const cia = formProfile?.cia || 0;
  const ciaMonth = formProfile?.ciaMonth;
  const netRatioFixed = formProfile?.netRatioFixed || 0;
  const netRatioVariable = formProfile?.netRatioVariable || 0;
  const navigo = formProfile?.navigo || 0;
  const mealVoucherDeduction = formProfile?.mealVoucherDeduction || 0;
  const pasRate = formProfile?.pasRate || 0;
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
    const worked = sundays.length;
    const decided = holidays.filter((item) => item.choice);
    return {
      year,
      sundays,
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
  ]);

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
    const sick = isContractuel
      ? { days: 0, total: 0 }
      : sickLeaves.byMonth[index];
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
        sick.total,
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
        compensated,
      gross:
        baseSalary +
        ifse +
        otherFixed +
        (index === ciaMonth ? cia : 0) +
        SUNDAY_ALLOWANCE.monthlyFlat +
        sunday +
        holiday +
        compensated -
        sick.total,
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
  ]);

  /** Le net estimé du mois affiché : cotisations d'abord, avec deux taux —
   *  le traitement porte la pension civile, les primes non —, puis l'impôt à
   *  part, pour qu'un changement de taux se corrige sans tout recalibrer.
   *  `null` tant que les taux ne sont pas renseignés. */
  const monthNet =
    monthPay && netRatioFixed && netRatioVariable && pasRate
      ? (monthPay.grossFixed * (netRatioFixed / 100) +
          monthPay.grossVariable * (netRatioVariable / 100) +
          navigo -
          // Jamais prélevés en décembre, confirmé sur les bulletins de 2024
          // et 2025 : la ligne « Titres repas carte » y est absente.
          (monthPay.index === 11 ? 0 : mealVoucherDeduction)) *
        (1 - (pasRate / 100) * PAS_BASE_ADJUSTMENT)
      : null;

  const leaveStats = useMemo(() => {
    const year = view.getFullYear();
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    const counted = new Set<string>();
    const used: Record<BalanceType, number> = {
      annual: 0,
      rtt: 0,
      fraction: 0,
    };
    const details: Record<
      BalanceType,
      Array<{ date: string; units: number }>
    > = {
      annual: [],
      rtt: [],
      fraction: [],
    };
    // Suivis à part : comptés, mais sans droit à consommer.
    const countedOnly: Record<
      CountedOnlyType,
      { used: number; details: Array<{ date: string; units: number }> }
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
      if (period.leaveType === "recovery") continue;
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
          countedOnly[countedType].details.push({ date: key, units });
          continue;
        }
        used[category as BalanceType] += units;
        details[category as BalanceType].push({ date: key, units });
      }
    }
    return {
      balances: (["annual", "rtt", "fraction"] as const).map((type) => ({
        type,
        allowance: LEAVE_ALLOWANCES[type],
        used: used[type],
        remaining: LEAVE_ALLOWANCES[type] - used[type],
        details: details[type].sort((a, b) => a.date.localeCompare(b.date)),
      })),
      countedOnly,
    };
  }, [periods, view, group]);

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
      const demo =
        import.meta.env.DEV && new URLSearchParams(location.search).has("demo");
      if (!demo) {
        const post = async (payload: Record<string, unknown>) => {
          const response = await fetch("/api/calendar", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error();
        };
        if (noteGroupId)
          await post({ action: "delete-note-period", groupId: noteGroupId });
        await post({ action: "save-entry", date: dayDate, ...nextEntry });
        if (useLeaveRange)
          await post({
            action: "save-period",
            id: editingPeriodId || undefined,
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
              await post({
                action: "save-entry",
                date: key,
                ...(entries[key] || emptyEntry()),
                wish: true,
              });
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
            id: editingPeriodId || crypto.randomUUID(),
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
    } catch {
      notify("La modification n’a pas pu être synchronisée. Réessayez.");
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
      const demo =
        import.meta.env.DEV && new URLSearchParams(location.search).has("demo");
      const groupId = noteGroupId || crypto.randomUUID();
      const updatedAt = new Date().toISOString();
      if (!demo) {
        const post = async (payload: Record<string, unknown>) => {
          const response = await fetch("/api/calendar", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error();
        };
        for (const range of groupConsecutive(noteDates)) {
          await post({
            action: "save-note-period",
            groupId,
            from: range.from,
            to: range.to,
            noteText: trimmedNote,
            noteColor,
          });
        }
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
    } catch {
      notify("La note n’a pas pu être enregistrée. Réessayez.");
    } finally {
      setSavingDay(false);
    }
  }
  function openRange() {
    if (requestKind) {
      notify(
        "Terminez ou annulez d’abord la demande professionnelle en cours.",
      );
      return;
    }
    setRangeLeaveType("annual");
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
  function editLeavePeriod(period: LeavePeriod) {
    const dates: string[] = [];
    for (
      let date = fromKey(period.from);
      dateKey(date) <= period.to;
      date = addDays(date, 1)
    )
      dates.push(dateKey(date));
    setRangeLeaveType(period.leaveType || "annual");
    setRangeHalfMoment(period.halfMoment || "morning");
    setEditingPeriodId(period.legacy ? null : period.id);
    setEditingLegacyPeriod(period.legacy ? period : null);
    setSeparateDates(dates);
    setSeparatePeople(["leave"]);
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
      !(import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
    ) {
      const response = await fetch("/api/calendar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "clear-legacy-period",
          from: period.from,
          to: period.to,
        }),
      });
      if (!response.ok) throw new Error();
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
      const demo =
        import.meta.env.DEV && new URLSearchParams(location.search).has("demo");
      for (const date of [...separateDates].sort()) {
        for (const person of separatePeople) {
          // « Divers » et « souhaité » sont des marques posées sur la journée,
          // pas des périodes enregistrées : elles s'écrivent jour par jour et
          // doivent préserver ce que porte déjà la case.
          if (person === "personal" || person === "wish") {
            if (!demo) {
              const current = entries[date];
              const response = await fetch("/api/calendar", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  action: "save-leaves",
                  date,
                  leave:
                    person === "personal" ? true : Boolean(current?.leave),
                  wish: person === "wish" ? true : Boolean(current?.wish),
                }),
              });
              if (!response.ok) throw new Error();
            }
            continue;
          }
          if (!demo) {
            const response = await fetch("/api/calendar", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "save-period",
                from: date,
                to: date,
                leaveType: rangeLeaveType,
                halfMoment:
                  rangeLeaveType === "half" ? rangeHalfMoment : undefined,
                group,
              }),
            });
            if (!response.ok) throw new Error();
            const data = await response.json();
            saved.push({
              id: data.period.id,
              from: data.period.from,
              to: data.period.to,
              leaveType: data.period.leave_type || "",
              halfMoment: data.period.half_moment || "",
              group: data.period.group,
              updatedAt: data.period.updated_at,
            });
          } else {
            saved.push({
              id: crypto.randomUUID(),
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
      if (editingLegacyPeriod) {
        await clearLegacyPeriod(editingLegacyPeriod);
      } else if (editingPeriodId && !demo) {
        const response = await fetch("/api/calendar", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "delete-period",
            id: editingPeriodId,
          }),
        });
        if (!response.ok) throw new Error();
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
      if (!demo) await loadCalendar();
      cancelRangeSelection();
    } catch {
      await loadCalendar().catch(() => undefined);
      notify(
        "Les dates n’ont pas toutes pu être synchronisées. Vérifiez le planning puis réessayez.",
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
      } else if (
        !(
          import.meta.env.DEV &&
          new URLSearchParams(location.search).has("demo")
        )
      ) {
        const response = await fetch("/api/calendar", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "delete-period", id: target.id }),
        });
        if (!response.ok) throw new Error();
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
  /** Repasse un congé accordé en congé souhaité : la période enregistrée est
   *  supprimée — donc rendue au solde — et chacun de ses jours reçoit la
   *  marque verte. Le chemin inverse de la validation. */
  async function revertPeriodToWish(target: LeavePeriod) {
    setSavingRange(true);
    try {
      const demo =
        import.meta.env.DEV && new URLSearchParams(location.search).has("demo");
      if (!demo) {
        const post = async (payload: Record<string, unknown>) => {
          const response = await fetch("/api/calendar", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error();
        };
        if (target.legacy) await clearLegacyPeriod(target);
        else await post({ action: "delete-period", id: target.id });
        for (const key of rangeKeys(target.from, target.to)) {
          const current = entries[key];
          await post({
            action: "save-leaves",
            date: key,
            // Un congé « Divers » posé sur le même jour ne doit pas partir
            // avec la période : on ne touche qu'à la marque de souhait.
            leave: Boolean(current?.leave),
            wish: true,
          });
        }
      }
      if (!target.legacy)
        setPeriods((current) =>
          current.filter((period) => period.id !== target.id),
        );
      // La marque est posée localement avant le rechargement : sans cela, la
      // case restait sans couleur le temps de l'aller-retour, et le passage
      // paraissait n'avoir rien fait.
      setEntries((current) => {
        const next = { ...current };
        for (const key of rangeKeys(target.from, target.to))
          next[key] = { ...(next[key] || emptyEntry()), wish: true };
        return next;
      });
      await loadCalendar();
      setDayDate(null);
    } catch {
      notify("Le congé n’a pas pu être repassé en souhaité. Réessayez.");
    } finally {
      setSavingRange(false);
    }
  }
  function beginRequest(kind: RequestKind) {
    setRequestKind(kind);
    setActiveType(kind === "leave" ? "annual" : "recovery_day");
    setSelections({});
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
    changeAllowancesMonth(deltaX < 0 ? 1 : -1);
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
      // La récupération d'un jour férié suit le même critère qu'une
      // récupération en journée : un jour entier, sans solde. Elle se marque
      // donc de la même façon sur le planning.
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
      if (requestKind === "leave" || requestKind === "recovery") {
        // La récupération n'a qu'une seule brique sur le planning — en
        // journée entière, sans solde. « recovery_day » et
        // « recovery_holiday » y répondent tous les deux ; les variantes en
        // demi-journée ou en heures restent propres au formulaire, sans
        // équivalent à marquer.
        const leavePeriods: Array<{
          from: string;
          to: string;
          leaveType: LeaveType;
          halfMoment?: HalfMoment;
        }> =
          requestKind === "leave"
            ? [
                ...groups.annual.map((period) => ({
                  ...period,
                  leaveType: "annual" as const,
                })),
                ...groups.rtt.map((period) => ({
                  ...period,
                  leaveType: "rtt" as const,
                })),
                ...groups.fraction.map((period) => ({
                  ...period,
                  leaveType: "fraction" as const,
                })),
                ...groups.childcare.map((period) => ({
                  ...period,
                  leaveType: "childcare" as const,
                })),
                ...groups.exceptional.map((period) => ({
                  ...period,
                  leaveType: "exceptional" as const,
                })),
                ...selectedList
                  .filter((item) => item.type === "half")
                  .map((item) => ({
                    from: item.date,
                    to: item.date,
                    leaveType: "half" as const,
                    // L'horaire choisi dans le formulaire dit quelle moitié
                    // colorer sur le planning : avant 13 h 30, c'est le matin.
                    halfMoment: item.start
                      ? halfMomentFromStart(item.start)
                      : undefined,
                  })),
              ]
            : [...groups.recoveryDay, ...groups.recoveryHoliday].map(
                (period) => ({
                  ...period,
                  leaveType: "recovery" as const,
                }),
              );
        if (
          !(
            import.meta.env.DEV &&
            new URLSearchParams(location.search).has("demo")
          )
        ) {
          for (const period of leavePeriods) {
            const response = await fetch("/api/calendar", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "save-period",
                group,
                ...period,
              }),
            });
            if (!response.ok) throw new Error("sync");
          }
        }
      }
      localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
      window.location.href = "/formulaire/index.html?planning=1";
    } catch {
      setSavingRequest(false);
      notify(
        "La demande n’a pas pu être synchronisée avec le planning. Réessayez.",
      );
    }
  }

  function renderDay(date: Date, compact = false) {
    const info = getDayInfo(date, group);
    const key = dateKey(date);
    const entry = entries[key];
    const selected = selections[key];
    const today = sameDate(date, now);
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
    // déjà grise.
    const visibleLeave = Boolean(
      showLeaves && hasLeavePeriod && info.kind !== "off",
    );
    const wishOutline = wishDay && info.kind !== "off" && !hasLeavePeriod;
    // Deux types se distinguent du liseré rouge plein : la récupération prend
    // un aplat orange, la demi-journée un liseré sur sa seule moitié. Une
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
            : "Congé professionnel"
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
      visibleNote ? "Note enregistrée" : "",
    ]
      .filter(Boolean)
      .join(" — ");
    return (
      <button
        type="button"
        key={key}
        className={`${compact ? "mini-day" : "day"} ${info.kind}${visibleLeave && !myRecovery && !myHalfMoment ? " leave-day" : ""}${myRecovery ? " recovery-day" : ""}${myHalfMoment ? ` half-${myHalfMoment}` : ""}${wishOutline ? " wish-day" : ""}${today ? " today" : ""}${visibleNote ? " has-note" : ""}${selected ? " request-selected" : ""}${inPendingRange ? " range-selected" : ""}${rangeEdge ? " range-edge" : ""}`}
        style={
          selected
            ? ({
                "--selection-color": TYPE_COLORS[selected.type],
              } as React.CSSProperties)
            : rangeSelecting
              ? ({ "--range-preview": "var(--leave)" } as React.CSSProperties)
              : noteSelecting
                ? ({ "--range-preview": noteColor } as React.CSSProperties)
                : undefined
        }
        onClick={() => handleDay(date)}
        title={title}
        aria-label={`${longDate(date)}, ${info.holiday ? `${info.holiday}, ` : ""}${DAY_LABELS[info.kind]}${selected ? `, ${TYPE_LABELS[selected.type]} sélectionné` : ""}${leaveLabel ? `, ${leaveLabel}` : ""}${visibleNote ? ", note enregistrée" : ""}`}
      >
        <span className={info.holiday ? "holiday-date" : "date-number"}>
          {date.getDate()}
        </span>
        {personalDay && (
          <span
            className={`personal-marker${visibleLeave ? " with-companions" : ""}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" />
              <path d="M5.5 20c.6-4.2 2.8-6.4 6.5-6.4s5.9 2.2 6.5 6.4z" />
            </svg>
          </span>
        )}
        {selected && <span className="selection-corner" aria-hidden="true" />}
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
      baseSalary: formProfile?.baseSalary,
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
      [field]: value,
    };
    // Le taux net/brut est un pourcentage, pas un montant : le même calcul
    // ×100 en fait des points de base (79,65 % → 7965) plutôt que des
    // centimes, sans avoir besoin d'un second chemin de conversion.
    const cents = Math.round(value * 100);
    setSavingPay(field);
    try {
      if (
        !(import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
      ) {
        const response = await fetch("/api/calendar", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "save-form-profile",
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
          }),
        });
        if (!response.ok) throw new Error("sync");
      }
      setFormProfile(nextProfile);
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
      baseSalary: formProfile?.baseSalary,
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
    };
    setFormProfile(nextProfile);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
      return;
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          ciaMonth: month,
        }),
      });
      if (!response.ok) throw new Error("sync");
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
      baseSalary: formProfile?.baseSalary,
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
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
      return;
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          sundayCarryover: count,
          sundayCarryoverYear: target.year,
          sundayCarryoverMonth: target.month,
          sundayCarryoverFromYear: fromYear,
          sundayCarryoverFromMonth: fromMonth,
        }),
      });
      if (!response.ok) throw new Error("sync");
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
      baseSalary: formProfile?.baseSalary,
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
      sundayCarryover: 0,
      sundayCarryoverYear,
      sundayCarryoverMonth,
      sundayCarryoverFromYear,
      sundayCarryoverFromMonth,
    };
    setFormProfile(nextProfile);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
      return;
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          sundayCarryover: 0,
        }),
      });
      if (!response.ok) throw new Error("sync");
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
      !(import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
    ) {
      try {
        const response = await fetch("/api/calendar", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "save-leaves",
            date: key,
            leave: Boolean(current?.leave),
            wish: Boolean(current?.wish),
            holidayPay: choice,
          }),
        });
        if (!response.ok) throw new Error();
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

  /** Les huit champs des « Éléments de paie » qu'un bulletin peut renseigner
   *  tout seul. Les deux taux net/brut n'y figurent pas : ce sont des ratios
   *  qui se calculent à la main à partir de plusieurs lignes de
   *  cotisations, pas un montant écrit tel quel sur le bulletin. */
  // IFSE et CIA écartés d'entrée pour une contractuelle : pas la peine de
  // les chercher sur un bulletin qui ne les porte pas.
  const PAYSLIP_IMPORT_FIELDS = [
    { key: "baseSalary" as const, label: "Traitement de base" },
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
  async function importPayslips(files: File[]) {
    setPayslipImportError("");
    setPayslipImportResult(null);
    setPayslipError("");
    setPayslipCheck(null);
    if (!files.length) return;
    setPayslipImportBusy(true);
    setPayslipToolsOpen(true);
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
      const bestForCheck = items.find(
        (item) => item.reading.gross || item.reading.baseSalary,
      );
      if (bestForCheck) {
        setPayslipCheck(bestForCheck);
      } else {
        setPayslipError(
          "Aucun bulletin n’a pu être lu pour la comparaison. Sa mise en page a peut-être changé.",
        );
      }
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
      const applied = PAYSLIP_IMPORT_FIELDS.filter(
        (field) => found[field.key] !== undefined,
      );
      if (!applied.length) {
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
        baseSalary: found.baseSalary ?? formProfile?.baseSalary,
        ifse: found.ifse ?? formProfile?.ifse,
        carenceDay: found.carenceDay ?? formProfile?.carenceDay,
        otherFixed: found.otherFixed ?? formProfile?.otherFixed,
        cia: found.cia ?? formProfile?.cia,
        ciaMonth: ciaMonth ?? formProfile?.ciaMonth,
        netRatioFixed: formProfile?.netRatioFixed,
        netRatioVariable: formProfile?.netRatioVariable,
        navigo: found.navigo ?? formProfile?.navigo,
        mealVoucherDeduction:
          found.mealVoucherDeduction ?? formProfile?.mealVoucherDeduction,
        pasRate: found.pasRate ?? formProfile?.pasRate,
      };
      if (
        !(import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
      ) {
        const body: Record<string, unknown> = {
          action: "save-form-profile",
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
        };
        if (found.baseSalary !== undefined)
          body.baseSalaryCents = Math.round(found.baseSalary * 100);
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
        const response = await fetch("/api/calendar", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error("sync");
      }
      setFormProfile(nextProfile);
      setPayslipImportResult({
        applied: applied.map((field) => ({
          label: field.label,
          value:
            field.key === "pasRate"
              ? `${found[field.key]!.toLocaleString("fr-FR")} %`
              : euros(found[field.key]!),
        })),
        missing: PAYSLIP_IMPORT_FIELDS.filter(
          (field) => found[field.key] === undefined,
        ).map((field) => field.label),
      });
    } catch {
      setPayslipImportError(
        "La mise à jour n’a pas pu être enregistrée. Réessayez.",
      );
    } finally {
      setPayslipImportBusy(false);
    }
  }

  /** Le brut d'un mois quelconque de l'année affichée, pour comparer un
   *  bulletin au mois qu'il porte et non à celui qui est ouvert. */
  function grossForMonth(index: number) {
    const month = allowances?.monthly.find((slot) => slot.index === index);
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
      sick
    );
  }


  /** Le volet de vérification d'un bulletin, séparé des primes : on y va pour
   *  contrôler, pas pour consulter. */
  function renderPayslipCheck() {
    if (!allowances || !monthPay || !sickLeaves) return null;
    const missing =
      !baseSalary || (!isContractuel && !ifse) || !carenceDay || !otherFixed;
    const showPayslipHelp = missing || payslipHelpOpen;
    const showPayslipTools = missing || payslipToolsOpen;
    const statusValue = formProfile?.status || "fonctionnaire";
    const statusIndex = PAY_STATUS_OPTIONS.findIndex(
      (option) => option.value === statusValue,
    );
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
      monthPay.sickDays
        ? {
            key: "sick",
            label: `Arrêt maladie (${monthPay.sickDays} j)`,
            detail: "carence et retenue de 10 %",
            amount: -monthPay.sick,
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
    return (
      <div className="request-archive-content allowances">
        <div className="status-field">
          <span>Je suis</span>
          <div
            className="status-switch"
            aria-label="Statut"
            style={{ "--status-index": statusIndex } as React.CSSProperties}
          >
            {PAY_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={statusValue === option.value ? "active" : ""}
                onClick={() => changeStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

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
              fixes plus rares (indemnité de résidence…). Donnez-lui quelques
              bulletins PDF : elle y reconnaît ces valeurs et remplit les
              champs toute seule, sans que vous ayez à les recopier.
            </p>
            {!isContractuel ? (
              <p className="allowance-note">
                Pour un fonctionnaire, s’y ajoutent l’IFSE et le CIA.
              </p>
            ) : null}
            <p className="allowance-note">
              Tout se passe sur cet appareil, en toute sécurité : vos
              bulletins et les montants qu’ils contiennent ne sont jamais
              envoyés ni conservés, nulle part.
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

        {showPayslipTools ? (
          <section className="allowance-card">
            <header>
              <span>Vérifier un bulletin</span>
              {!missing ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setPayslipToolsOpen(false)}
                >
                  Replier
                </button>
              ) : null}
            </header>
            <p className="allowance-note">
              Choisissez un ou plusieurs bulletins PDF : les valeurs de vos
              bulletins se remplissent toutes seules dans les champs d’«
              Éléments de paie », et le bulletin le plus récent est comparé au
              calcul de l’appli. Si une erreur est repérée, vous en serez
              informé. Les fichiers sont lus sur cet appareil et ne sont ni
              envoyés, ni conservés.
            </p>
            <label className="payslip-drop">
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                disabled={payslipImportBusy}
                onChange={(event) => {
                  // Copier chaque fichier dans un tableau avant de vider le
                  // champ : `event.target.value = ""` vide aussi la FileList
                  // déjà récupérée (elle n'est pas figée), une simple
                  // affectation ne suffit pas comme pour un input à un seul
                  // fichier.
                  const files = Array.from(event.target.files || []);
                  event.target.value = "";
                  if (files.length) void importPayslips(files);
                }}
              />
              <span>
                {payslipImportBusy
                  ? "Lecture en cours…"
                  : "Choisir un ou plusieurs bulletins PDF"}
              </span>
            </label>
            {payslipImportError ? (
              <p className="allowance-note warn">{payslipImportError}</p>
            ) : null}
            {payslipImportResult ? (
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
              </>
            ) : null}
            {payslipError ? (
              <p className="allowance-note warn">{payslipError}</p>
            ) : null}
            {payslipCheck ? (
            payslipCheck.reading.month === undefined ||
            payslipCheck.reading.year !== allowances.year ? (
              <p className="allowance-note warn">
                Ce bulletin
                {payslipCheck.reading.month !== undefined
                  ? ` porte ${MONTHS[payslipCheck.reading.month]} ${payslipCheck.reading.year}`
                  : " n’indique pas sa période"}{" "}
                : affichez {payslipCheck.reading.year || "l’année"} dans le
                planning pour le comparer.
              </p>
            ) : (
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
        ) : (
          <p className="allowance-note">
            <button
              type="button"
              className="text-button"
              onClick={() => setPayslipToolsOpen(true)}
            >
              Vérifier un bulletin
            </button>
          </p>
        )}

        <section className="allowance-card allowance-card-lead">
          <header>
            <div className="pay-month-nav">
              {/* Au clic pour la souris (PC) ; le glissé fait déjà ce travail
                  au doigt sur ce même bloc plus bas. */}
              <button
                type="button"
                className="pay-nav-arrow"
                onClick={() => changeAllowancesMonth(-1)}
                aria-label="Mois précédent"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m12.5 5-5 5 5 5" />
                </svg>
              </button>
              <span>La paie de {MONTHS[monthPay.index]}</span>
              <button
                type="button"
                className="pay-nav-arrow"
                onClick={() => changeAllowancesMonth(1)}
                aria-label="Mois suivant"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m7.5 5 5 5-5 5" />
                </svg>
              </button>
            </div>
            {/* Cette carte suit le mois affiché dans le planning, pas
                forcément le mois en cours : un raccourci pour y revenir sans
                quitter Infos paye, seulement quand on s'en est éloigné. */}
            {(view.getMonth() !== now.getMonth() ||
              view.getFullYear() !== now.getFullYear()) && (
              <button
                type="button"
                className="text-button"
                onClick={goToday}
              >
                Aujourd’hui
              </button>
            )}
          </header>
          <div className="pay-headline">
            <p className="pay-amount">
              <span>Brut</span>
              <strong>{euros(monthPay.gross)}</strong>
            </p>
            {monthNet === null ? null : (
              <p className="pay-amount net">
                <span>Net estimé</span>
                <strong>{euros(monthNet)}</strong>
              </p>
            )}
          </div>
          {monthPayRows.length ? (
            <table className="allowance-table">
              <tbody>
                {monthPayRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">
                      {row.label}
                      <small>{row.detail}</small>
                    </th>
                    <td
                      className={
                        row.amount < 0
                          ? "negative"
                          : row.amount > 0
                            ? "positive"
                            : ""
                      }
                    >
                      {euros(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

        <section className="allowance-card">
          <header>
            <span>Éléments de paie</span>
          </header>
          {missing ? (
            <p className="allowance-note warn">
              Renseignez ces montants pour que les calculs soient justes. Ils se
              lisent tous sur un bulletin.
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
                hint: "Ex. 79,41",
                use: "cotisations sur le traitement, l’IFSE et les éléments fixes, qui portent la pension civile",
                percent: true,
              },
              {
                field: "netRatioVariable" as const,
                label: "Taux net avant impôt — primes",
                value: netRatioVariable,
                hint: "Ex. 89,92",
                use: "cotisations sur les dimanches, fériés et le CIA, non soumis à la pension civile : bien moins ponctionnés",
                percent: true,
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
              {item.value ? null : <small>{item.use}</small>}
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
        </section>
      </div>
    );
  }
  function renderAllowances() {
    if (!allowances) return null;
    const { sundayTotal } = allowances;
    return (
      <>
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
                        <ChoicePicker
                          value={item.choice || ""}
                          options={HOLIDAY_PAY_OPTIONS}
                          onChange={(choice) =>
                            choice && void chooseHolidayPay(item.key, choice)
                          }
                          ariaLabel={`Choisir la compensation du ${shortDate(item.key)}`}
                          className="holiday-pay-picker"
                          layout="list"
                          placeholder="À décider"
                        />
                        {item.choice ? (
                          <small>
                            {euros(holidayAllowance(baseSalary, item.choice))}
                          </small>
                        ) : null}
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
                        <ChoicePicker
                          value={item.choice || ""}
                          options={HOLIDAY_PAY_OPTIONS}
                          onChange={(choice) =>
                            choice && void chooseHolidayPay(item.key, choice)
                          }
                          ariaLabel={`Choisir la compensation du ${shortDate(item.key)}`}
                          className="holiday-pay-picker"
                          layout="list"
                          placeholder="À décider"
                        />
                        {item.choice && baseSalary ? (
                          <small>
                            {euros(holidayAllowance(baseSalary, item.choice))}
                          </small>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </>
    );
  }

  function renderLeaveBalances() {
    return (
      <div className="request-archive-content">
        <div className="leave-balance-grid">
          {leaveStats.balances.map((balance) => (
            <button
              type="button"
              key={balance.type}
              className={balance.type}
              onClick={() => setBalanceDetailType(balance.type)}
              aria-label={`Afficher le détail de ${leaveTypeLabel(balance.type)}`}
            >
              <span>{typeLabelFor(balance.type, balance.remaining)}</span>
              <strong>
                {balance.remaining.toLocaleString("fr-FR")}
                <i>restant{s(balance.remaining)}</i>
              </strong>
              <small>
                {balance.used.toLocaleString("fr-FR")} utilisé
                {s(balance.used)} sur {balance.allowance}
              </small>
              <em>Voir le détail</em>
            </button>
          ))}
          {COUNTED_ONLY_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className={type}
              onClick={() => setBalanceDetailType(type)}
              aria-label={`Afficher le détail de ${TYPE_LABELS[type]}`}
            >
              <span>
                {typeLabelFor(type, leaveStats.countedOnly[type].used)}
              </span>
              <strong>
                {leaveStats.countedOnly[type].used.toLocaleString("fr-FR")}
                <i>pris</i>
              </strong>
              <small>sans effet sur les congés</small>
              <em>Voir le détail</em>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /** Les volets d'accueil : une grille d'onglets figée, puis le contenu de
   *  ceux qui sont ouverts, en dessous.
   *
   *  Les deux sont séparés à dessein. Tant que le volet ouvert portait son
   *  propre contenu, il devait s'élargir sur toute la ligne pour l'afficher —
   *  et la grille le renvoyait alors à la ligne suivante, si bien que
   *  l'onglet de droite plongeait d'un cran sous le doigt qui venait de le
   *  toucher. Les onglets occupent maintenant des cases fixes, quoi qu'il
   *  arrive. */
  function renderHomePanels(
    label: string,
    panels: Array<{
      key: string;
      tone: string;
      icon: React.ReactNode;
      title: string;
      summary: string;
      open: boolean;
      toggle: () => void;
      content: () => React.ReactNode;
    }>,
    extraClass = "",
  ) {
    return (
      <section
        className={`home-panels${extraClass ? ` ${extraClass}` : ""}`}
        aria-label={label}
      >
        <div className="home-panel-grid">
          {panels.map((panel) => (
            <button
              key={panel.key}
              id={`home-panel-${panel.key}`}
              className={`home-panel-toggle tone-${panel.tone}${panel.open ? " open" : ""}`}
              type="button"
              onClick={panel.toggle}
              aria-expanded={panel.open}
              aria-controls={`home-panel-body-${panel.key}`}
            >
              <span
                className={`home-panel-icon ${panel.tone}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24">{panel.icon}</svg>
              </span>
              <strong>{panel.title}</strong>
              <small>{panel.summary}</small>
              <span className="home-panel-caret" aria-hidden="true">
                <svg viewBox="0 0 20 20">
                  <path d="m5 7.5 5 5 5-5" />
                </svg>
              </span>
            </button>
          ))}
        </div>
        {panels
          .filter((panel) => panel.open)
          .map((panel) => (
            <div
              key={panel.key}
              id={`home-panel-body-${panel.key}`}
              className={`home-panel-body ${panel.tone}`}
              role="region"
              aria-labelledby={`home-panel-${panel.key}`}
            >
              {panel.content()}
            </div>
          ))}
      </section>
    );
  }

  function renderNotesContent() {
    const query = noteQuery.trim();
    return (
      <div className="request-archive-content">
        {hasAnyNote && (
          <input
            type="search"
            className="note-search-input"
            value={noteQuery}
            onChange={(event) => setNoteQuery(event.target.value)}
            placeholder="Rechercher dans les notes…"
            aria-label="Rechercher dans les notes"
          />
        )}
        {query ? (
          noteSearchResults.length ? (
            renderNoteItems(noteSearchResults)
          ) : (
            <p className="upcoming-empty">
              Aucune note ne correspond à « {query} ».
            </p>
          )
        ) : upcoming.length ? (
          renderNoteItems(upcoming)
        ) : (
          <p className="upcoming-empty">Aucune note à venir.</p>
        )}
      </div>
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

  function renderMonthCalendar(year: number, month: number, compact = false) {
    const offset = (localDate(year, month, 1).getDay() + 6) % 7;
    const days = monthDays(year, month);
    const trailingDays = 42 - offset - days;
    return (
      <>
        <div className={compact ? "mini-weekdays" : "weekdays"}>
          {SHORT_DAYS.map((day, index) => (
            <span key={`${day}-${index}`}>
              {compact
                ? day
                : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][index]}
            </span>
          ))}
        </div>
        <div className={compact ? "mini-grid" : "calendar-grid"}>
          {Array.from({ length: offset }, (_, index) => (
            <span
              className={compact ? "mini-blank" : "day-blank"}
              key={`blank-${index}`}
            />
          ))}
          {Array.from({ length: days }, (_, index) =>
            renderDay(localDate(year, month, index + 1), compact),
          )}
          {Array.from({ length: trailingDays }, (_, index) => (
            <span
              className={compact ? "mini-blank" : "day-blank"}
              key={`trailing-blank-${index}`}
            />
          ))}
        </div>
      </>
    );
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
          <p className="eyebrow">Mon planning</p>
          <h1>Planning et congés</h1>
        </div>
        <div className="header-actions">
          <div className="header-tools">
            <button
              className="refresh-button header-refresh-button"
              type="button"
              onClick={() => void refreshCalendar()}
              disabled={refreshingCalendar}
              aria-label={
                refreshingCalendar
                  ? "Actualisation du planning"
                  : "Rafraîchir le planning"
              }
              title="Rafraîchir"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6v5h-5" />
                <path d="M19 11a7.5 7.5 0 1 0 .15 4.1" />
              </svg>
            </button>
          </div>
          <div className="view-switch" aria-label="Mode d’affichage">
            <button
              className={mode === "month" ? "active" : ""}
              onClick={() => setMode("month")}
              type="button"
            >
              Mois
            </button>
            <button
              className={mode === "year" ? "active" : ""}
              onClick={() => setMode("year")}
              type="button"
            >
              Année
            </button>
          </div>
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
      </header>

      {renderHomePanels("Résumé du planning", [
          {
            key: "notes",
            tone: "notes",
            icon: (
              <>
                <path d="M4 6h16v12H4z" />
                <path d="M7 10h10M7 14h6" />
              </>
            ),
            title: "Prochaines notes",
            summary: upcoming.length
              ? `${upcoming.length} ${upcoming.length > 1 ? "notes" : "note"}`
              : "aucune",
            open: notesOpen,
            toggle: () => setNotesOpen((current) => !current),
            content: renderNotesContent,
          },
          {
            key: "balances",
            tone: "balances",
            icon: (
              <>
                <path d="M4 6h16v12H4z" />
                <path d="M8 10v4M12 9v5M16 11v3" />
              </>
            ),
            title: "Solde de congés",
            summary: `${totalLeaveRemaining.toLocaleString("fr-FR")} j restants`,
            open: balancesOpen,
            toggle: () => setBalancesOpen((current) => !current),
            content: renderLeaveBalances,
          },
          ...(allowances
            ? [
                {
                  key: "allowances",
                  tone: "allowances",
                  icon: (
                    <path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" />
                  ),
                  title: "Infos primes",
                  summary: `${allowances.sundayDone} dimanche${s(allowances.sundayDone)} · ${allowances.holidays.length} férié${s(allowances.holidays.length)}${
                    allowances.holidayPending
                      ? ` · ${allowances.holidayPending} à décider`
                      : ""
                  }`,
                  open: allowancesOpen,
                  toggle: () => setAllowancesOpen((current) => !current),
                  content: () => (
                    <div className="request-archive-content allowances">
                      {renderAllowances()}
                    </div>
                  ),
                },
                {
                  key: "payslip",
                  tone: "payslip",
                  icon: (
                    <>
                      <path d="M6 3h9l4 4v14H6z" />
                      <path d="M15 3v4h4M9 12h6M9 16h4" />
                    </>
                  ),
                  title: "Infos paye",
                  // Le net, pas le brut : c'est ce qui tombe sur le compte.
                  // Le brut reprend la main tant que les taux manquent — ce
                  // qui est aussi le cas par défaut pour une contractuelle,
                  // tant qu'elle n'a pas calibré ses propres taux.
                  summary:
                    monthNet !== null && monthPay
                      ? `${euros(monthNet)} net en ${MONTHS[monthPay.index]}`
                      : monthPay
                        ? `${euros(monthPay.gross)} brut en ${MONTHS[monthPay.index]}`
                        : "",
                  open: payslipOpen,
                  toggle: () => setPayslipOpen((current) => !current),
                  content: () => (
                    <div
                      onTouchStart={startAllowancesSwipe}
                      onTouchEnd={endAllowancesSwipe}
                    >
                      {renderPayslipCheck()}
                    </div>
                  ),
                },
              ]
            : []),
        ])}

      {mode !== "year" && (
        <section className="controls" aria-label="Choix du planning">
          <div className="year-choice" aria-label="Choix de l’année affichée">
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
          <div className="year-choice" aria-label="Choix du groupe">
            <span className="year-choice-label">Groupe</span>
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
        {!rangeSelecting && (
          <button
            className="primary-action toolbar-leave-action"
            type="button"
            onClick={() =>
              requestKind
                ? document
                    .getElementById("request-panel")
                    ?.scrollIntoView({ behavior: "smooth" })
                : setRequestChooser(true)
            }
          >
            {requestKind ? "Demande en cours" : "Poser un congé"}
          </button>
        )}
      </section>

      {mode === "year" && (
        <section
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
                <ChoicePicker
                  value={schoolVacationZone}
                  options={SCHOOL_ZONE_OPTIONS}
                  onChange={setSchoolVacationZone}
                  ariaLabel="Choisir la zone de vacances scolaires"
                  layout="list"
                  className="leave-type-picker school-vacation-zone-picker"
                />
              )}
            </div>
            <button
              type="button"
              className="pdf-action selected-group"
              disabled={pdfExporting !== null}
              onClick={() =>
                void exportAnnualPlanning(
                  "selected",
                  showSchoolVacationsOnPdf ? schoolVacationZone : null,
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
                  showSchoolVacationsOnPdf ? schoolVacationZone : null,
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
                  showSchoolVacationsOnPdf ? schoolVacationZone : null,
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
          className="request-panel calendar-request-panel"
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
                  ? "Sélectionnez vos congés"
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
          {requestKind === "leave" ? (
            <div className="type-tabs" aria-label="Type de congé">
              {(
                [
                  "annual",
                  "half",
                  "rtt",
                  "fraction",
                  "childcare",
                  "exceptional",
                ] as SelectionType[]
              ).map(
                (type) => (
                  <button
                    type="button"
                    className={activeType === type ? "active" : ""}
                    style={
                      {
                        "--type-color": TYPE_COLORS[type],
                      } as React.CSSProperties
                    }
                    onClick={() => setActiveType(type)}
                    key={type}
                  >
                    <i />
                    {TYPE_LABELS[type]}
                    {selectedCounts[type] ? (
                      <b>{selectedCounts[type]}</b>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          ) : (
            <>
              <div className="type-tabs" aria-label="Type de récupération">
                {(
                  [
                    "recovery_day",
                    "recovery_half",
                    "recovery_hours",
                    "recovery_holiday",
                  ] as SelectionType[]
                ).map((type) => (
                  <button
                    type="button"
                    className={activeType === type ? "active" : ""}
                    style={
                      {
                        "--type-color": TYPE_COLORS[type],
                      } as React.CSSProperties
                    }
                    onClick={() => setActiveType(type)}
                    key={type}
                  >
                    <i />
                    {TYPE_LABELS[type]}
                    {selectedCounts[type] ? (
                      <b>{selectedCounts[type]}</b>
                    ) : null}
                  </button>
                ))}
              </div>
              <p className="request-help">
                Un horaire sera demandé pour les demi-journées, les heures et
                les récupérations de jours fériés.
              </p>
            </>
          )}
          <div className="request-bottom">
            <p>
              <strong>{selectedList.length}</strong>{" "}
              {selectedList.length > 1
                ? "dates sélectionnées"
                : "date sélectionnée"}
              . Cliquez sur une date colorée pour la retirer.
            </p>
            <div className="request-actions">
              <button
                className="text-button"
                type="button"
                onClick={openBlankForm}
                disabled={savingRequest}
              >
                Ouvrir le formulaire vierge
              </button>
              <button
                className="validate-button"
                type="button"
                onClick={validateAndOpenForm}
                disabled={!selectedList.length || savingRequest}
              >
                {savingRequest
                  ? "Synchronisation…"
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
          {renderMonthCalendar(view.getFullYear(), view.getMonth())}
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
              {renderMonthCalendar(view.getFullYear(), index, true)}
            </article>
          ))}
        </section>
      )}
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
            <span className="step-label">Nouvelle demande</span>
            <h2 id="request-choice-title">Que souhaitez-vous préparer ?</h2>
            <div className="choice-grid">
              <button type="button" onClick={() => beginRequest("leave")}>
                <strong>Demande de congé</strong>
                <span>
                  Congés annuels, demi-journée, RTT, fractionnement, garde
                  d’enfant ou jour exceptionnel
                </span>
              </button>
              <button type="button" onClick={() => beginRequest("recovery")}>
                <strong>Demande de récupérations</strong>
                <span>Sélection d’une date puis saisie des horaires</span>
              </button>
            </div>
          </section>
        </div>
      )}

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
                Congés, jours « Divers », congés souhaités et notes se posent
                sur cette journée, y compris pendant un jour de repos.
              </p>
            )}
            {!quickNoteMode && (
              <>
                <div className="leave-choices">
                  <button
                        type="button"
                        className={dayLeave ? "leave active" : "leave"}
                        onClick={() => {
                          setDayLeave((value) => {
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
                        Congé professionnel
                        <span>{dayLeave ? "Ajouté" : "Ajouter"}</span>
                      </button>
                      <button
                        type="button"
                        className={
                          dayPersonalLeave
                            ? "personal-day active"
                            : "personal-day"
                        }
                        onClick={() =>
                          setDayPersonalLeave((value) => !value)
                        }
                      >
                        <i />
                        Divers
                        <span>
                          {dayPersonalLeave ? "Ajouté" : "Ajouter"}
                        </span>
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
                {dayLeave && (
                  <div className="leave-type-field">
                    <span>Type de congé</span>
                    <ChoicePicker
                      value={dayLeaveType}
                      options={LEAVE_TYPE_OPTIONS}
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
                        <div
                          className="period-menu"
                          ref={
                            periodMenuId === period.id ? periodMenuRef : null
                          }
                        >
                          <button
                            className="period-menu-trigger"
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={periodMenuId === period.id}
                            aria-label={`Actions pour ${periodLabel(period.from, period.to)}`}
                            onClick={() =>
                              setPeriodMenuId((current) =>
                                current === period.id ? "" : period.id,
                              )
                            }
                          >
                            Actions
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                              <path d="m5 7.5 5 5 5-5" />
                            </svg>
                          </button>
                          {periodMenuId === period.id && (
                            <div className="period-menu-panel" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setPeriodMenuId("");
                                  editDayLeavePeriod(period);
                                }}
                              >
                                Modifier
                              </button>
                              {(
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={savingRange}
                                    onClick={() => {
                                      setPeriodMenuId("");
                                      void revertPeriodToWish(period);
                                    }}
                                  >
                                    Repasser en souhaité
                                  </button>
                                )}
                              <button
                                className="period-menu-delete"
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setPeriodMenuId("");
                                  setDayDate(null);
                                  setDeletingPeriod(period);
                                }}
                              >
                                Annuler ce congé
                              </button>
                            </div>
                          )}
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
            {noteText.trim() && (
              <div className="leave-range-box">
                <button
                  className="separate-date-button"
                  type="button"
                  onClick={beginNoteDateSelection}
                >
                  <strong>Choisir plusieurs dates</strong>
                  <span>
                    Sélectionnez plusieurs jours, même dans des mois
                    différents
                  </span>
                </button>
              </div>
            )}
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
              {balanceDetail.quota ? "Solde" : "Suivi"} {view.getFullYear()}
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
            {balanceDetail.details.length ? (
              <div className="balance-detail-list">
                {balanceDetail.details.map((detail, index) => (
                  <button
                    type="button"
                    key={`${detail.date}-${detail.units}-${index}`}
                    onClick={() => {
                      const date = fromKey(detail.date);
                      setBalanceDetailType(null);
                      setView(
                        localDate(date.getFullYear(), date.getMonth(), 1),
                      );
                      setMode("month");
                      openDay(date);
                    }}
                  >
                    <span>{longDate(fromKey(detail.date))}</span>
                    <strong>
                      {balanceDetail.quota ? "−" : ""}
                      {detail.units.toLocaleString("fr-FR")} jour
                    </strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="balance-detail-empty">
                {balanceDetail.quota
                  ? "Aucun jour n’est encore déduit dans cette catégorie."
                  : "Aucun jour d’arrêt enregistré cette année."}
              </p>
            )}
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

      {rangeOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setRangeOpen(false)
          }
        >
          <section
            className="modal-card range-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="range-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setRangeOpen(false)}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">Mon planning</span>
            <h2 id="range-title">Ajouter une période de congés</h2>
            <p>
              Choisissez le type de congé, puis sélectionnez une ou plusieurs
              dates directement dans le calendrier.
            </p>
            <div className="leave-type-field">
              <span>Type de congé</span>
              <ChoicePicker
                value={rangeLeaveType}
                options={LEAVE_TYPE_OPTIONS}
                onChange={setRangeLeaveType}
                ariaLabel="Sélectionner le type de congé"
                className="leave-type-picker"
              />
            </div>
            {rangeLeaveType === "half" && (
                <div className="leave-type-field">
                  <span>Moitié de journée</span>
                  <ChoicePicker
                    value={rangeHalfMoment}
                    options={HALF_MOMENT_OPTIONS}
                    onChange={setRangeHalfMoment}
                    ariaLabel="Choisir le matin ou l’après-midi"
                    className="leave-type-picker"
                  />
                </div>
              )}
            <div className="modal-actions range-create-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setRangeOpen(false)}
              >
                Annuler
              </button>
              <button
                className="save-button"
                type="button"
                onClick={beginRangeSelection}
              >
                Sélectionner dans le calendrier
              </button>
            </div>
            {managedPeriods.length > 0 && (
              <div className="saved-periods">
                <div className="saved-periods-heading">
                  <span>Périodes enregistrées</span>
                  <small>{managedPeriods.length}</small>
                </div>
                <div className="saved-periods-list">
                  {managedPeriods.map((period) => (
                    <article className="saved-period" key={period.id}>
                      <i className="leave" />
                      <div>
                        <strong>{periodLabel(period.from, period.to)}</strong>
                        <span>{leaveTypeLabel(period.leaveType)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => editLeavePeriod(period)}
                      >
                        Modifier
                      </button>
                      <button
                        className="period-delete"
                        type="button"
                        onClick={() => setDeletingPeriod(period)}
                      >
                        Supprimer
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {timeDate && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card time-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="time-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setTimeDate(null)}
              aria-label="Fermer"
            >
              ×
            </button>
            <span className="step-label">{TYPE_LABELS[activeType]}</span>
            <h2 id="time-title">Indiquez les horaires</h2>
            <p>{longDate(fromKey(timeDate))}</p>
            <div className="time-fields">
              <label htmlFor="request-time-start">
                <span>De</span>
                <input
                  id="request-time-start"
                  aria-label="De"
                  type="time"
                  min="09:00"
                  max="19:30"
                  step="900"
                  value={timeStart}
                  onChange={(event) => setTimeStart(event.target.value)}
                />
              </label>
              <label htmlFor="request-time-end">
                <span>À</span>
                <input
                  id="request-time-end"
                  aria-label="À"
                  type="time"
                  min="09:00"
                  max="19:30"
                  step="900"
                  value={timeEnd}
                  onChange={(event) => setTimeEnd(event.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setTimeDate(null)}
              >
                Annuler
              </button>
              <button
                className="save-button"
                type="button"
                onClick={commitTime}
              >
                Valider les horaires
              </button>
            </div>
          </section>
        </div>
      )}

      {warningDate && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card warning-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="warning-title"
          >
            <span className="warning-symbol">!</span>
            <h2 id="warning-title">Journée non travaillée</h2>
            <p>
              Le {shortDate(warningDate)} est un jour de repos ou un jour férié
              non travaillé pour le groupe {group}. Voulez-vous vraiment
              l’ajouter à la demande ?
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setWarningDate(null)}
              >
                Annuler
              </button>
              <button
                className="warning-button"
                type="button"
                onClick={confirmWarning}
              >
                Sélectionner quand même
              </button>
            </div>
          </section>
        </div>
      )}

      {deletingPeriod && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card warning-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-period-title"
          >
            <span className="warning-symbol">!</span>
            <h2 id="delete-period-title">Annuler cette période ?</h2>
            <p>
              {periodLabel(deletingPeriod.from, deletingPeriod.to)} ·{" "}
              {leaveTypeLabel(deletingPeriod.leaveType)}
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDeletingPeriod(null)}
              >
                Conserver
              </button>
              <button
                className="delete-confirm-button"
                type="button"
                onClick={deleteLeavePeriod}
                disabled={savingRange}
              >
                {savingRange ? "Annulation…" : "Annuler la période"}
              </button>
            </div>
          </section>
        </div>
      )}

      {message && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && dismiss()
          }
        >
          <section
            className="modal-card message-modal"
            role="alertdialog"
            aria-modal="true"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => dismiss()}
              aria-label="Fermer"
            >
              ×
            </button>
            <h2>Impossible de continuer</h2>
            <p>{message}</p>
            <div className="modal-actions">
              <button
                className="save-button"
                type="button"
                onClick={() => dismiss()}
              >
                Compris
              </button>
            </div>
          </section>
        </div>
      )}
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
