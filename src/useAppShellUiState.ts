import { useRef, useState } from "react";
import type { MainSection } from "./AppNavigation";
import type { SharedGrandPalaisEvent } from "./grandPalaisProgramTypes";
import type { UsefulContactsPayload } from "./usefulContactsTypes";
import type { SchoolZone } from "./planningLogic";

const SCHOOL_VACATIONS_VISIBLE_KEY = "planning:school-vacations-v1";
const SCHOOL_VACATIONS_ZONE_KEY = "planning:school-zone-v1";

/** Navigation, menus et préférences temporaires du shell applicatif. */
export function useAppShellUiState() {
  const [quickNoteMode, setQuickNoteMode] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [homeSection, setHomeSection] = useState<MainSection>("home");
  const [prefetchedContacts, setPrefetchedContacts] = useState<UsefulContactsPayload | null>(null);
  const [approvedGrandPalaisUpdates, setApprovedGrandPalaisUpdates] = useState<SharedGrandPalaisEvent[]>([]);
  const sectionSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [guidePromptOpen, setGuidePromptOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const guidePromptCheckedRef = useRef(false);
  const [groupChooserOpen, setGroupChooserOpen] = useState(false);
  const [noteQuery, setNoteQuery] = useState("");
  const [narrowScreen, setNarrowScreen] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [appUpdateAvailable, setAppUpdateAvailable] = useState(false);
  const [appUpdatePromptOpen, setAppUpdatePromptOpen] = useState(false);
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  const [dataManagementBusy, setDataManagementBusy] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const [viewportDebugEnabled] = useState(() => new URLSearchParams(location.search).has("debug"));
  const [viewportSize, setViewportSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [showSchoolVacationsOnPdf, setShowSchoolVacationsOnPdf] = useState(false);
  const [showSchoolVacations, setShowSchoolVacationsState] = useState(() => {
    const saved = localStorage.getItem(SCHOOL_VACATIONS_VISIBLE_KEY);
    return saved === "1" || (saved === null && import.meta.env.DEV && location.search.includes("local-test=1"));
  });
  const [schoolZone, setSchoolZoneState] = useState<SchoolZone>(() => {
    const saved = localStorage.getItem(SCHOOL_VACATIONS_ZONE_KEY);
    return saved === "A" || saved === "B" ? saved : "C";
  });
  const setShowSchoolVacations = (visible: boolean) => {
    localStorage.setItem(SCHOOL_VACATIONS_VISIBLE_KEY, visible ? "1" : "0");
    setShowSchoolVacationsState(visible);
  };
  const setSchoolZone = (zone: SchoolZone) => {
    localStorage.setItem(SCHOOL_VACATIONS_ZONE_KEY, zone);
    setSchoolZoneState(zone);
  };
  const [calendarSlide, setCalendarSlide] = useState<"" | "out-left" | "out-right" | "in-left" | "in-right">("");
  const monthRefs = useRef<Record<number, HTMLElement | null>>({});
  const monthSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const allowancesSwipeStart = useRef<{ x: number; y: number } | null>(null);

  return {
    quickNoteMode, setQuickNoteMode, notesOpen, setNotesOpen,
    homeSection, setHomeSection, prefetchedContacts, setPrefetchedContacts,
    approvedGrandPalaisUpdates, setApprovedGrandPalaisUpdates, sectionSwipeStartRef,
    mainMenuOpen, setMainMenuOpen, guidePromptOpen, setGuidePromptOpen,
    guideOpen, setGuideOpen, guidePromptCheckedRef, groupChooserOpen, setGroupChooserOpen,
    feedbackOpen, setFeedbackOpen,
    noteQuery, setNoteQuery, narrowScreen, setNarrowScreen, pdfOpen, setPdfOpen,
    accountMenuOpen, setAccountMenuOpen, checkingAppUpdate, setCheckingAppUpdate,
    appUpdateAvailable, setAppUpdateAvailable, appUpdatePromptOpen, setAppUpdatePromptOpen,
    dataManagementOpen, setDataManagementOpen, dataManagementBusy, setDataManagementBusy,
    accountMenuRef, accountButtonRef, viewportDebugEnabled, viewportSize, setViewportSize,
    showSchoolVacationsOnPdf, setShowSchoolVacationsOnPdf,
    showSchoolVacations, setShowSchoolVacations, schoolZone, setSchoolZone,
    calendarSlide, setCalendarSlide,
    monthRefs, monthSwipeStart, allowancesSwipeStart,
  };
}
