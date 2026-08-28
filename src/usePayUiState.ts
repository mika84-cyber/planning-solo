import { useRef, useState } from "react";
import type { PayslipReading } from "./payslip";
import type { PayScreen } from "./PayPage";

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
  const [payScreen, setPayScreen] = useState<PayScreen>("overview");
  const [payProfileOpen, setPayProfileOpen] = useState(false);
  const [payPeriodOpen, setPayPeriodOpen] = useState(false);
  const [payMonthSlide, setPayMonthSlide] = useState<"" | "out-left" | "out-right" | "in-left" | "in-right">("");
  const payMonthSlideTimer = useRef<number | null>(null);
  const [payslipCheck, setPayslipCheck] = useState<PayslipCheck | null>(null);
  const [payslipError, setPayslipError] = useState("");
  const [payslipImportBusy, setPayslipImportBusy] = useState(false);
  const [payslipImportError, setPayslipImportError] = useState("");
  const [payslipImportResult, setPayslipImportResult] = useState<PayslipImportResult | null>(null);
  const [payslipImportMode, setPayslipImportMode] = useState<"verify" | "calibrate" | null>(null);
  const [payslipNeedsPeriod, setPayslipNeedsPeriod] = useState(false);
  const [payslipFallbackMonth, setPayslipFallbackMonth] = useState(0);
  const [payslipFallbackYear, setPayslipFallbackYear] = useState(2026);
  const [payslipRateSamples, setPayslipRateSamples] = useState<Array<{ name: string; reading: PayslipReading }>>([]);
  const [payslipHelpOpen, setPayslipHelpOpen] = useState(false);
  const [payslipResultDetailsOpen, setPayslipResultDetailsOpen] = useState(false);
  const [paySettingsOpen, setPaySettingsOpen] = useState(false);
  const [payEstimateDetailsOpen, setPayEstimateDetailsOpen] = useState(false);
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
    payScreen, setPayScreen, payProfileOpen, setPayProfileOpen,
    payPeriodOpen, setPayPeriodOpen, payMonthSlide, setPayMonthSlide,
    payMonthSlideTimer, payslipCheck, setPayslipCheck, payslipError, setPayslipError,
    payslipImportBusy, setPayslipImportBusy, payslipImportError, setPayslipImportError,
    payslipImportResult, setPayslipImportResult, payslipImportMode, setPayslipImportMode,
    payslipNeedsPeriod, setPayslipNeedsPeriod, payslipFallbackMonth, setPayslipFallbackMonth,
    payslipFallbackYear, setPayslipFallbackYear, payslipRateSamples, setPayslipRateSamples,
    payslipHelpOpen, setPayslipHelpOpen, payslipResultDetailsOpen, setPayslipResultDetailsOpen,
    paySettingsOpen, setPaySettingsOpen, payEstimateDetailsOpen, setPayEstimateDetailsOpen,
    payDrafts, setPayDrafts, savingPay, setSavingPay,
  };
}
