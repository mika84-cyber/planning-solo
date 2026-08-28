import { useRef, useState } from "react";
import type { MainSection } from "./AppNavigation";
import type { SharedGrandPalaisEvent } from "./grandPalaisProgramTypes";
import type { UsefulContactsPayload } from "./usefulContactsTypes";

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
    noteQuery, setNoteQuery, narrowScreen, setNarrowScreen, pdfOpen, setPdfOpen,
    accountMenuOpen, setAccountMenuOpen, checkingAppUpdate, setCheckingAppUpdate,
    appUpdateAvailable, setAppUpdateAvailable, appUpdatePromptOpen, setAppUpdatePromptOpen,
    dataManagementOpen, setDataManagementOpen, dataManagementBusy, setDataManagementBusy,
    accountMenuRef, accountButtonRef, viewportDebugEnabled, viewportSize, setViewportSize,
    showSchoolVacationsOnPdf, setShowSchoolVacationsOnPdf, calendarSlide, setCalendarSlide,
    monthRefs, monthSwipeStart, allowancesSwipeStart,
  };
}
