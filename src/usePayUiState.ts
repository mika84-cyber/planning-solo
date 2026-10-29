import { useCallback, useEffect, useRef, useState } from "react";
import type { PayslipReading } from "./payslip";
import type { PayEstimateSnapshot } from "./payslipGapExplanation";
import type { PayScreen } from "./PayPage";
import { localDate } from "./planningLogic";

export type PayDraftKey =
  | "baseSalary"
  | "ifse"
  | "carenceDay"
  | "otherFixed"
  | "cia"
  | "netRatioFixed"
  | "netRatioVariable"
  | "navigo"
  | "mealVoucherDeduction"
  | "pasRate";

export type PayslipCheck = { name: string; reading: PayslipReading };

export type PayslipImportResult = {
  applied: Array<{ label: string; value: string }>;
  missing: string[];
  adjustment?: string;
};

/** État d’interface de Ma paie ; les calculs restent dans les modules métier. */
export function usePayUiState() {
  const [payView, setPayView] = useState(() => {
    const today = new Date();
    return localDate(today.getFullYear(), today.getMonth(), 1);
  });
  const [payScreen, setPayScreenState] = useState<PayScreen>("overview");
  const payScreenRef = useRef<PayScreen>("overview");
  /* Chaque sous-écran de Ma paie (primes, détail du calcul, année) est une
     entrée de l'historique, posée sur la rubrique paie : le bouton Retour du
     téléphone revient à l'écran précédent, et non à la page d'avant. Revenir
     au tableau de bord retire l'entrée du sous-écran quitté : par Retour si
     l'écran d'avant était dans la paie (`payReturn` « back »), en la
     remplaçant si l'on venait d'une autre page (« stay » : la flèche ← promet
     le tableau de bord, et Retour rendra ensuite la page de départ). */
  const setPayScreen = useCallback((screen: PayScreen) => {
    const current = payScreenRef.current;
    if (screen === current) return;
    const state = history.state || {};
    if (screen === "overview" && state.payScreen === current) {
      if (state.payReturn === "back") {
        // L'écran se rétablit à l'arrivée de popstate.
        payScreenRef.current = "overview";
        history.back();
        return;
      }
      history.replaceState({ ...state, payScreen: undefined, payReturn: undefined }, "", location.href);
    } else if (screen !== "overview") {
      history.pushState({ ...state, planningSection: "pay", payScreen: screen, payReturn: state.planningSection === "pay" ? "back" : "stay" }, "", location.href);
    }
    payScreenRef.current = screen;
    setPayScreenState(screen);
  }, []);
  useEffect(() => {
    const restore = (event: PopStateEvent) => {
      const screen: PayScreen = event.state?.payScreen ?? "overview";
      payScreenRef.current = screen;
      setPayScreenState(screen);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const [payProfileOpen, setPayProfileOpen] = useState(false);
  const [payProfileFocusRequested, setPayProfileFocusRequested] = useState(false);
  const [payVerificationRequested, setPayVerificationRequested] = useState(false);
  const [payMonthSlide, setPayMonthSlide] = useState<"" | "out-left" | "out-right" | "in-left" | "in-right">("");
  const payMonthSlideTimer = useRef<number | null>(null);
  const [payslipCheck, setPayslipCheck] = useState<PayslipCheck | null>(null);
  const [payslipError, setPayslipError] = useState("");
  const [payslipImportBusy, setPayslipImportBusy] = useState(false);
  const [payslipImportError, setPayslipImportError] = useState("");
  const [payslipImportResult, setPayslipImportResult] = useState<PayslipImportResult | null>(null);
  const [payslipImportMode, setPayslipImportMode] = useState<"verify" | "calibrate" | null>(null);
  const [payslipNeedsPeriod, setPayslipNeedsPeriod] = useState(false);
  /** Une première photo lue, à laquelle manque l'autre page du bulletin. */
  const [payslipPhotoPending, setPayslipPhotoPending] = useState(false);
  const [payslipFallbackMonth, setPayslipFallbackMonth] = useState(0);
  const [payslipFallbackYear, setPayslipFallbackYear] = useState(2026);
  const [payslipRateSamples, setPayslipRateSamples] = useState<Array<{ name: string; reading: PayslipReading }>>([]);
  const [payslipHelpOpen, setPayslipHelpOpen] = useState(false);
  const [payslipResultDetailsOpen, setPayslipResultDetailsOpen] = useState(false);
  // L'estimation du mois juste avant la lecture de son bulletin.
  const [payEstimateSnapshot, setPayEstimateSnapshot] = useState<PayEstimateSnapshot | null>(null);
  const [paySettingsOpen, setPaySettingsOpen] = useState(false);
  const [payAdvancedOpen, setPayAdvancedOpen] = useState(false);
  const [payDrafts, setPayDrafts] = useState<Record<PayDraftKey, string>>({
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
  const [savingPay, setSavingPay] = useState<PayDraftKey | null>(null);

  return {
    payView, setPayView, payScreen, setPayScreen, payProfileOpen, setPayProfileOpen,
    payProfileFocusRequested, setPayProfileFocusRequested,
    payVerificationRequested, setPayVerificationRequested,
    payMonthSlide, setPayMonthSlide,
    payMonthSlideTimer, payslipCheck, setPayslipCheck, payslipError, setPayslipError,
    payslipImportBusy, setPayslipImportBusy, payslipImportError, setPayslipImportError,
    payslipImportResult, setPayslipImportResult, payslipImportMode, setPayslipImportMode,
    payslipNeedsPeriod, setPayslipNeedsPeriod, payslipPhotoPending, setPayslipPhotoPending,
    payslipFallbackMonth, setPayslipFallbackMonth,
    payslipFallbackYear, setPayslipFallbackYear, payslipRateSamples, setPayslipRateSamples,
    payslipHelpOpen, setPayslipHelpOpen, payslipResultDetailsOpen, setPayslipResultDetailsOpen,
    payEstimateSnapshot, setPayEstimateSnapshot,
    paySettingsOpen, setPaySettingsOpen, payAdvancedOpen, setPayAdvancedOpen,
    payDrafts, setPayDrafts, savingPay, setSavingPay,
  };
}
