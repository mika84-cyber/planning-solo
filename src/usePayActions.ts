import { useRef, type Dispatch, type SetStateAction } from "react";
import type {
  Entries,
  FormProfile,
  LeavePeriod,
  PayProfile,
} from "./appModel";
import { emptyEntry, euros } from "./appModel";
import type { MecenatEntry } from "./mecenat";
import { mecenatForPayMonth } from "./mecenat";
import type { RecoveryUse } from "./overtime";
import { holidayRecoveryMinutesForQuota } from "./overtime";
import {
  calculateNetRatios,
  defaultNetRatiosForPeriod,
  fixedExtraTotal,
  isAutomaticExtraLine,
  payCalibrationRegime,
  readingsForCalibrationRegime,
  type PayCalibrationRegime,
  type PayslipReading,
} from "./payslip";
import {
  isIncompletePayslipReading,
  isPayslipImage,
  mergePayslipPageReadings,
  readPayslipFiles,
} from "./payslipOcr";
import { shouldReportMissingPayslipField } from "./payslipReview";
import { sundayReportAfterReading } from "./sundayReport";
import {
  amountsPosedOnlyBy,
  combinePayslipRateReadings,
  mergePayslipRateSamples,
  payslipPeriodKey,
  payslipRateSamplesFromReadings,
  type PosedAmountField,
} from "./payslipRateSamples";
import { inspectPayslipPhotos } from "./payslipImageQuality";
import { browserConfirm, type ConfirmAction } from "./confirmDialog";
import {
  MONTHS,
  SUNDAY_ALLOWANCE,
  localDate,
  s,
  type HolidayPay,
} from "./planningLogic";
import { strikePayEstimate } from "./strike";
import { monthGross, strikeDeduction } from "./payMonth";
import {
  attachCarencesToPayslips,
  deductionSliceLabel,
  ofPayMonth,
  withDeductionPayMonth,
  type DeductionSlice,
} from "./deductionPayMonth";
import { sickLeaveDates } from "./sickLeaveSummary";
import type {
  PayDraftKey,
  PayslipCheck,
  PayslipImportResult,
} from "./usePayUiState";

type SetState<T> = Dispatch<SetStateAction<T>>;

export type PayCalendarPost = <T = { ok: true }>(
  payload: Record<string, unknown>,
) => Promise<T>;

export type PayAllowanceMonth = {
  index: number;
  sunday: number;
  sundayCount: number;
  holiday: number;
  /** Part des fériés compensés : absente des anciens résumés. */
  compensated?: number;
};

export type PayAllowancesSummary = {
  year: number;
  monthly: PayAllowanceMonth[];
};

type SickLeaveSummary = {
  byMonth: Array<{ total: number }>;
};

type PaidOvertimeSummary = { amount: number };

export type PayslipImportFieldKey =
  | "baseSalary"
  | "residenceAllowance"
  | "ifse"
  | "carenceDay"
  | "otherFixed"
  | "cia"
  | "navigo"
  | "mealVoucherDeduction"
  | "pasRate";

export type PayslipImportField = {
  key: PayslipImportFieldKey;
  label: string;
};

type PayActionsOptions = {
  demoMode: boolean;
  group: number;
  payView: Date;
  setPayView: SetState<Date>;
  formProfile: FormProfile | null;
  setFormProfile: SetState<FormProfile | null>;
  payProfiles: Record<string, PayProfile>;
  setPayProfiles: SetState<Record<string, PayProfile>>;
  payDrafts: Record<PayDraftKey, string>;
  setPayDrafts: SetState<Record<PayDraftKey, string>>;
  setSavingPay: SetState<PayDraftKey | null>;
  sundayCarryoverYear?: number;
  sundayCarryoverMonth?: number;
  sundayCarryoverFromYear?: number;
  sundayCarryoverFromMonth?: number;
  entries: Entries;
  setEntries: SetState<Entries>;
  isContractuel: boolean;
  allowances: PayAllowancesSummary | null | undefined;
  payslipCheck: PayslipCheck | null;
  setPayslipCheck: SetState<PayslipCheck | null>;
  payslipFallbackMonth: number;
  payslipFallbackYear: number;
  setPayslipFallbackMonth: SetState<number>;
  setPayslipFallbackYear: SetState<number>;
  payslipRateSamples: PayslipCheck[];
  setPayslipRateSamples: SetState<PayslipCheck[]>;
  setPayslipImportMode: SetState<"verify" | "calibrate" | null>;
  setPayslipImportError: SetState<string>;
  setPayslipImportResult: SetState<PayslipImportResult | null>;
  setPayslipError: SetState<string>;
  setPayslipNeedsPeriod: SetState<boolean>;
  setPayslipPhotoPending: SetState<boolean>;
  setPayslipImportBusy: SetState<boolean>;
  setPayslipResultDetailsOpen: SetState<boolean>;
  baseSalary: number;
  ifse: number;
  otherFixed: number;
  cia: number;
  ciaMonth?: number;
  sickLeaves: SickLeaveSummary | null;
  paidOvertimeForPayPeriod: (
    payYear: number,
    payMonth: number,
  ) => PaidOvertimeSummary;
  mecenatEntries: MecenatEntry[];
  periods: LeavePeriod[];
  recoveryUses: RecoveryUse[];
  notify: (message: string) => void;
  /** Un message de réussite, discret (toast). */
  showSuccess?: (message: string) => void;
  /** La question posée dans l'application (photo peu nette, ligne inconnue…). */
  confirmAction?: ConfirmAction;
  post: PayCalendarPost;
};

export function payProfileBase(
  formProfile: FormProfile | null,
  group: number,
): FormProfile {
  return {
    fullName: formProfile?.fullName || "",
    group: formProfile?.group || String(group),
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
    deductionPayMonths: formProfile?.deductionPayMonths,
    // Le report de dimanches en cours n'appartient qu'aux écrans qui le posent
    // ou le retirent : les autres enregistrements doivent le laisser tel quel.
    sundayCarryover: formProfile?.sundayCarryover,
    sundayCarryoverYear: formProfile?.sundayCarryoverYear,
    sundayCarryoverMonth: formProfile?.sundayCarryoverMonth,
    sundayCarryoverFromYear: formProfile?.sundayCarryoverFromYear,
    sundayCarryoverFromMonth: formProfile?.sundayCarryoverFromMonth,
    // Gardés dans le compte et renvoyés par leurs seuls écrans : un autre
    // enregistrement ne doit pas les faire disparaître de l'écran, ni faire
    // renvoyer ensuite une table des décisions amputée des mois précédents.
    payslipVerifications: formProfile?.payslipVerifications,
    payslipRateSamples: formProfile?.payslipRateSamples,
  };
}

/** La clé envoyée au serveur pour chaque montant ; `null` l'efface. */
const AMOUNT_BODY_KEYS: Record<PosedAmountField, string> = {
  baseSalary: "baseSalaryCents",
  ifse: "ifseCents",
  otherFixed: "otherFixedCents",
  carenceDay: "carenceCents",
  navigo: "navigoCents",
  mealVoucherDeduction: "mealVoucherDeductionCents",
};

/** Efface des montants du profil de l'année et de ses mois : ils venaient
 *  d'un bulletin mal lu, remplacé ou retiré. */
function withoutAmounts(profiles: Record<string, PayProfile>, year: string, fields: PosedAmountField[]) {
  if (!fields.length) return profiles;
  const next = { ...profiles };
  for (const key of Object.keys(next))
    if (key === year || key.startsWith(`${year}-`))
      next[key] = { ...next[key], ...Object.fromEntries(fields.map((field) => [field, undefined])) };
  return next;
}

function payValuesFromProfile(profile: FormProfile | null): PayProfile {
  return {
    baseSalary: profile?.baseSalary,
    residenceAllowance: profile?.residenceAllowance,
    ifse: profile?.ifse,
    carenceDay: profile?.carenceDay,
    otherFixed: profile?.otherFixed,
    cia: profile?.cia,
    ciaMonth: profile?.ciaMonth,
    netRatioFixed: profile?.netRatioFixed,
    netRatioVariable: profile?.netRatioVariable,
    netRatioRegime: profile?.netRatioRegime,
    navigo: profile?.navigo,
    mealVoucherDeduction: profile?.mealVoucherDeduction,
    pasRate: profile?.pasRate,
  };
}

export function effectivePayProfile(
  profiles: Record<string, PayProfile>,
  year: number | string,
  month: number,
  savedProfile: PayProfile = {},
) {
  const definedValues = (profile: PayProfile | undefined) =>
    Object.fromEntries(
      Object.entries(profile || {}).filter(([, value]) => value !== undefined),
    ) as PayProfile;
  const yearText = String(year);
  // Le profil général contient les réglages de paie durables. Il reste la
  // base de chaque mois ; l'historique annuel puis les changements datés ne
  // remplacent que les valeurs réellement enregistrées pour leur période.
  // Les profils issus de l'API possèdent aussi des clés à `undefined` : elles
  // ne doivent surtout pas effacer les valeurs durables lors de la fusion.
  let effective = {
    ...definedValues(savedProfile),
    ...definedValues(profiles[yearText]),
  };
  for (let index = 0; index <= month; index += 1) {
    const key = `${yearText}-${String(index + 1).padStart(2, "0")}`;
    effective = { ...effective, ...definedValues(profiles[key]) };
  }
  return effective;
}

export function hasPayProfileHistory(
  profiles: Record<string, PayProfile>,
  year: number | string,
) {
  const prefix = `${String(year)}-`;
  return Object.keys(profiles).some((key) => key === String(year) || key.startsWith(prefix));
}

export function parsedPayDraft(draft: string) {
  return Number(draft.replace(",", ".").replace(/\s/g, ""));
}

export function payAmountPayload(
  field: PayDraftKey,
  value: number,
  payYear: number,
  payMonth: number,
  profile: FormProfile,
) {
  const scaled = Math.round(value * 100);
  return {
    action: "save-form-profile",
    payYear,
    payMonth,
    fullName: profile.fullName,
    group: profile.group,
    signature: profile.signature,
    ...(field === "baseSalary" ? { baseSalaryCents: scaled } : {}),
    ...(field === "ifse" ? { ifseCents: scaled } : {}),
    ...(field === "carenceDay" ? { carenceCents: scaled } : {}),
    ...(field === "otherFixed" ? { otherFixedCents: scaled } : {}),
    ...(field === "cia" ? { ciaCents: scaled } : {}),
    ...(field === "netRatioFixed" ? { netRatioFixedBp: scaled } : {}),
    ...(field === "netRatioVariable" ? { netRatioVariableBp: scaled } : {}),
    ...(field === "navigo" ? { navigoCents: scaled } : {}),
    ...(field === "mealVoucherDeduction"
      ? { mealVoucherDeductionCents: scaled }
      : {}),
    ...(field === "pasRate" ? { pasRateBp: scaled } : {}),
  };
}

export function annualPayProfilePayload(
  payYear: number,
  profile: FormProfile,
  values: PayProfile,
) {
  const cents = (value: number | undefined) =>
    value === undefined ? undefined : Math.round(value * 100);
  return {
    action: "save-form-profile",
    payYear,
    fullName: profile.fullName,
    group: profile.group,
    signature: profile.signature,
    baseSalaryCents: cents(values.baseSalary),
    residenceAllowanceCents: cents(values.residenceAllowance),
    ifseCents: cents(values.ifse),
    carenceCents: cents(values.carenceDay),
    otherFixedCents: cents(values.otherFixed),
    ciaCents: cents(values.cia),
    ciaMonth: values.ciaMonth,
    netRatioFixedBp: cents(values.netRatioFixed),
    netRatioVariableBp: cents(values.netRatioVariable),
    netRatioRegime: values.netRatioRegime,
    navigoCents: cents(values.navigo),
    mealVoucherDeductionCents: cents(values.mealVoucherDeduction),
    pasRateBp: cents(values.pasRate),
  };
}

export function nextSundayPayoutSlot(year: number, month: number) {
  if (month === 6) return { year, month: 9 };
  if (month === 9) return { year, month: 11 };
  if (month === 11) return { year: year + 1, month: 0 };
  if (month === 0) return { year, month: 6 };
  return null;
}

export function payslipImportFields(
  isContractuel: boolean,
  fonctionnaireAmountsDetected = false,
): PayslipImportField[] {
  const includeFonctionnaireAmounts = !isContractuel || fonctionnaireAmountsDetected;
  return [
    { key: "baseSalary", label: "Traitement de base" },
    { key: "residenceAllowance", label: "Indemnité de résidence" },
    ...(includeFonctionnaireAmounts ? [{ key: "ifse" as const, label: "IFSE" }] : []),
    { key: "carenceDay", label: "Jour de carence" },
    { key: "otherFixed", label: "Autres éléments fixes" },
    ...(includeFonctionnaireAmounts ? [{ key: "cia" as const, label: "CIA" }] : []),
    { key: "navigo", label: "Navigo remboursé" },
    { key: "mealVoucherDeduction", label: "Titres repas (retenue)" },
    { key: "pasRate", label: "Taux d’imposition (PAS)" },
  ];
}

export function usePayActions(options: PayActionsOptions) {
  const {
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
    setPayslipPhotoPending,
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
    showSuccess = notify,
    confirmAction = browserConfirm,
    post,
  } = options;
  const payYear = String(payView.getFullYear());
  /** Enregistre un montant du profil à partir du mois affiché : celui saisi
   *  dans le champ, ou, devant un écart du bulletin, celui que le bulletin
   *  porte (`explicitValue`). */
  async function savePayAmount(field: PayDraftKey, explicitValue?: number) {
    const value = explicitValue ?? parsedPayDraft(payDrafts[field]);
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
      ...payProfileBase(formProfile, group),
      [field]: value,
    };
    setSavingPay(field);
    try {
      if (!demoMode)
        await post(
          payAmountPayload(field, value, Number(payYear), payView.getMonth(), nextProfile),
        );
      setFormProfile(nextProfile);
      const monthKey = `${payYear}-${String(payView.getMonth() + 1).padStart(2, "0")}`;
      setPayProfiles((current) => ({
        ...current,
        [payYear]: current[payYear] || payValuesFromProfile(formProfile),
        [monthKey]: { ...(current[monthKey] || {}), [field]: value },
      }));
      setPayDrafts((current) => ({ ...current, [field]: "" }));
    } catch {
      notify("Le montant n’a pas pu être enregistré. Réessayez.");
    } finally {
      setSavingPay(null);
    }
  }

  async function saveAnnualPayProfile(values: PayProfile) {
    const nextProfile = payProfileBase(formProfile, group);
    try {
      if (!demoMode) {
        await post(annualPayProfilePayload(Number(payYear), nextProfile, values));
      }
      setPayProfiles((current) => ({ ...current, [payYear]: values }));
      showSuccess(`Profil de paie ${payYear} actualisé.`);
    } catch {
      notify("Le profil annuel n’a pas pu être enregistré. Réessayez.");
    }
  }

  /** Retire un bulletin mal lu des taux : ses montants ne comptent plus, et
   *  les deux taux se recalent sur les bulletins qui restent — ou reviennent
   *  aux taux de départ du statut s'il n'en reste aucun. */
  async function removePayslipRateSample(period: string) {
    const year = payView.getFullYear();
    const month = payView.getMonth();
    const regime = payCalibrationRegime(year, month);
    const stored = { ...(formProfile?.payslipRateSamples || {}) };
    const removed = stored[period];
    delete stored[period];
    // Les montants que ce seul bulletin avait posés dans le profil s'en vont
    // avec lui : une mauvaise lecture ne laisse rien derrière elle.
    const clearedAmounts = removed
      ? amountsPosedOnlyBy(removed, effectivePayProfile(payProfiles, year, month, formProfile || {}), Object.values(stored))
      : [];
    const session = payslipRateSamples.filter(({ reading }) =>
      reading.year === undefined || reading.month === undefined || payslipPeriodKey(reading.year, reading.month) !== period);
    const fallback = defaultNetRatiosForPeriod(year, month, formProfile?.status === "contractuel");
    const rates = calculateNetRatios(
      readingsForCalibrationRegime(combinePayslipRateReadings(stored, session).map((item) => item.reading), regime),
      fallback,
    ) ?? fallback;
    const nextProfile: FormProfile = {
      ...payProfileBase(formProfile, group),
      ...rates,
      netRatioRegime: regime,
      payslipRateSamples: stored,
      ...Object.fromEntries(clearedAmounts.map((field) => [field, undefined])),
    };
    try {
      if (!demoMode)
        await post({
          action: "save-form-profile",
          payYear: year,
          payMonth: month,
          fullName: nextProfile.fullName,
          group: nextProfile.group,
          signature: nextProfile.signature,
          removePayslipRateSamples: [period],
          ...Object.fromEntries(clearedAmounts.map((field) => [AMOUNT_BODY_KEYS[field], null])),
          netRatioFixedBp: Math.round(rates.netRatioFixed * 100),
          netRatioVariableBp: Math.round(rates.netRatioVariable * 100),
          netRatioRegime: regime,
        });
      setFormProfile(nextProfile);
      setPayslipRateSamples(session);
      const monthKey = `${payYear}-${String(month + 1).padStart(2, "0")}`;
      setPayProfiles((current) => withoutAmounts({
        ...current,
        [payYear]: { ...(current[payYear] || {}), ...rates, netRatioRegime: regime },
        ...(current[monthKey] ? { [monthKey]: { ...current[monthKey], ...rates, netRatioRegime: regime } } : {}),
      }, payYear, clearedAmounts));
      // La liste et les deux taux se mettent à jour sous les yeux : pas de message.
    } catch {
      notify("Le bulletin n’a pas pu être retiré. Réessayez.");
    }
  }

  async function saveCiaMonth(month: number) {
    const nextProfile: FormProfile = {
      ...payProfileBase(formProfile, group),
      ciaMonth: month,
    };
    setFormProfile(nextProfile);
    if (demoMode) return;
    try {
      await post({
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

  async function reportMissingSundays(
    fromYear: number,
    fromMonth: number,
    count: number,
  ) {
    const target = nextSundayPayoutSlot(fromYear, fromMonth);
    if (!target) return;
    const previous = formProfile;
    const nextProfile: FormProfile = {
      ...payProfileBase(formProfile, group),
      sundayCarryover: count,
      sundayCarryoverYear: target.year,
      sundayCarryoverMonth: target.month,
      sundayCarryoverFromYear: fromYear,
      sundayCarryoverFromMonth: fromMonth,
    };
    setFormProfile(nextProfile);
    if (demoMode) return;
    try {
      await post({
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
    } catch {
      setFormProfile(previous);
      notify("Le report n’a pas pu être enregistré. Réessayez.");
    }
  }

  async function clearSundayCarryover() {
    const previous = formProfile;
    const nextProfile: FormProfile = {
      ...payProfileBase(formProfile, group),
      sundayCarryover: 0,
      sundayCarryoverYear,
      sundayCarryoverMonth,
      sundayCarryoverFromYear,
      sundayCarryoverFromMonth,
    };
    setFormProfile(nextProfile);
    if (demoMode) return;
    try {
      await post({
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

  /** Rattache une tranche de maladie ou de grève à la paie qui l'a
   *  réellement retenue ; `null` la rend à la règle du 10. */
  async function moveDeduction(
    slice: Pick<DeductionSlice, "key" | "ruleMonth">,
    payMonth: string | null,
  ) {
    const previous = formProfile;
    const deductionPayMonths = withDeductionPayMonth(formProfile?.deductionPayMonths, slice, payMonth);
    const nextProfile: FormProfile = {
      ...payProfileBase(formProfile, group),
      deductionPayMonths,
    };
    setFormProfile(nextProfile);
    if (demoMode) return;
    try {
      await post({
        action: "save-form-profile",
        fullName: nextProfile.fullName,
        group: nextProfile.group,
        signature: nextProfile.signature,
        deductionPayMonths,
      });
    } catch {
      setFormProfile(previous);
      notify("Le mois de la retenue n’a pas pu être enregistré. Réessayez.");
    }
  }

  async function chooseHolidayPay(key: string, choice: HolidayPay) {
    const current = entries[key];
    if (!demoMode) {
      try {
        await post({
          action: "save-leaves",
          date: key,
          leave: Boolean(current?.leave),
          wish: Boolean(current?.wish),
          holidayPay: choice,
          holidayRecoveryMinutes: choice === "recovery"
            ? holidayRecoveryMinutesForQuota(formProfile?.workQuota || "full")
            : undefined,
        });
      } catch {
        notify("Le choix n’a pas pu être enregistré. Réessayez.");
        return;
      }
    }
    setEntries((currentEntries) => ({
      ...currentEntries,
      [key]: {
        ...(currentEntries[key] || emptyEntry()),
        holidayPay: choice,
        holidayRecoveryMinutes: choice === "recovery"
          ? holidayRecoveryMinutesForQuota(formProfile?.workQuota || "full")
          : undefined,
      },
    }));
  }

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
    setPayView(localDate(payslipFallbackYear, payslipFallbackMonth, 1));
    setPayslipNeedsPeriod(false);
    setPayslipResultDetailsOpen(false);
  }

  function grossForMonth(index: number) {
    const month = allowances?.monthly.find((slot) => slot.index === index);
    const overtime = paidOvertimeForPayPeriod(payView.getFullYear(), index);
    const mecenat = mecenatForPayMonth(
      mecenatEntries,
      payView.getFullYear(),
      index,
    );
    const strike = strikePayEstimate(
      periods,
      group,
      payProfiles,
      payView.getFullYear(),
      index,
      { entries, recoveryUses },
      formProfile?.deductionPayMonths,
    );
    // La même formule que l'estimation du mois (voir payMonth.ts) : maladie
    // et grève se retiennent quel que soit le statut, et la vérification d'un
    // bulletin ne peut plus attendre un autre brut que celui affiché.
    return monthGross({
      baseSalary,
      ifse,
      otherFixed,
      cia: index === ciaMonth ? cia : 0,
      monthlyFlat: SUNDAY_ALLOWANCE.monthlyFlat,
      sunday: month?.sunday || 0,
      holiday: month?.holiday || 0,
      compensated: month?.compensated || 0,
      sickTotal: sickLeaves?.byMonth[index]?.total || 0,
      strikeDeduction: strikeDeduction(strike.totalDeduction),
      overtimeAmount: overtime.amount,
      mecenatGross: mecenat.grossAmountCents / 100,
    }).gross;
  }

  /** Les pages lues du dernier bulletin vérifié, telles quelles : une page
   *  ajoutée ensuite s'y joint sans relire ni redemander les premières. */
  const payslipPagesRef = useRef<PayslipReading[]>([]);

  async function importPayslips(
    files: File[],
    mode: "verify" | "calibrate" = "verify",
    previousPages: PayslipReading[] = [],
    // Les photos déjà lues suffisent : la personne dit qu'il n'y a pas
    // d'autre page, et la vérification se termine avec ce qu'on a.
    { completePhotos = false }: { completePhotos?: boolean } = {},
  ) {
    setPayslipImportMode(mode);
    setPayslipImportError("");
    setPayslipImportResult(null);
    setPayslipError("");
    setPayslipNeedsPeriod(false);
    // Une page ajoutée garde le résultat affiché tant que la lecture n'a pas
    // abouti : un échec ne fait pas perdre la vérification déjà faite.
    if (mode === "verify" && !previousPages.length) {
      setPayslipCheck(null);
      setPayslipResultDetailsOpen(false);
      setPayslipPhotoPending(false);
    }
    if (!files.length && !(completePhotos && previousPages.length)) return;
    const includesPhoto = files.some(isPayslipImage) || completePhotos;
    if (mode === "calibrate" && files.length < 2) {
      setPayslipImportError(
        "Choisissez au moins deux bulletins de mois différents pour affiner les taux.",
      );
      return;
    }
    if (includesPhoto) {
      const qualityReports = await inspectPayslipPhotos(files);
      if (qualityReports.length) {
        const details = qualityReports.flatMap(({ file, issues }) =>
          issues.map((issue) => `${file.name} : ${issue.label} — ${issue.advice}`),
        );
        const continueAnyway = await confirmAction({
          title: "La lecture risque d’être moins fiable",
          message: details.join("\n"),
          confirmLabel: "Analyser quand même",
          cancelLabel: "Reprendre la photo",
        });
        if (!continueAnyway) {
          setPayslipImportError(`Photo à reprendre. ${details.join(" ")}`);
          return;
        }
      }
    }
    setPayslipImportBusy(true);
    try {
      let items: PayslipCheck[] = [];
      const failures: string[] = [];
      for (const result of files.length ? await readPayslipFiles(files) : []) {
        if (result.reading) {
          items.push({
            name: result.file.name,
            reading: result.reading,
          });
        } else {
          // Un fichier illisible ne doit pas empêcher de lire les autres.
          failures.push(result.error || "Fichier illisible.");
        }
      }
      if (!items.length && !(completePhotos && previousPages.length)) {
        setPayslipImportError(
          failures[0] || "Aucun de ces fichiers n’a pu être ouvert.",
        );
        return;
      }
      const pages = mode === "verify" ? [...previousPages, ...items.map((item) => item.reading)] : [];
      // Les pages lues ne font qu'un bulletin ; une seule photo, déclarée
      // complète, reste ce bulletin.
      if (mode === "verify" && (pages.length > 1 || (completePhotos && !items.length))) {
        try {
          items = [{
            name: `Bulletin (${pages.length} page${s(pages.length)})`,
            reading: pages.length > 1 ? mergePayslipPageReadings(pages) : pages[0],
          }];
        } catch (error) {
          setPayslipImportError(
            error instanceof Error
              ? error.message
              : "Impossible de réunir ces pages.",
          );
          return;
        }
      }
      if (mode === "verify") payslipPagesRef.current = pages;
      // Une ligne de rémunération inconnue : l'utilisateur dit si elle revient
      // chaque mois (elle rejoint les éléments fixes) ou si elle est ponctuelle.
      for (const item of items) {
        const lines = item.reading.extraLines || [];
        for (const line of lines) {
          if (isAutomaticExtraLine(line) || line.fixed !== undefined) continue;
          line.fixed = await confirmAction({
            title: "Une ligne que l’application ne connaît pas",
            message: `« ${line.label} » : ${euros(line.amount)}\nÉlément fixe, versé chaque mois ? Il s’ajoutera aux autres éléments fixes. Sinon, ponctuel : compté pour ce mois seulement.`,
            confirmLabel: "Élément fixe",
            cancelLabel: "Ponctuel",
          });
        }
        const fixedExtra = fixedExtraTotal(lines);
        if (fixedExtra) {
          item.reading = {
            ...item.reading,
            otherFixed: Math.round(((item.reading.otherFixed || 0) + fixedExtra) * 100) / 100,
          };
        }
      }
      const fonctionnaireAmountsDetected = items.some(
        ({ reading }) => reading.ifse !== undefined || reading.cia !== undefined,
      );
      const importFields = payslipImportFields(
        isContractuel,
        fonctionnaireAmountsDetected && formProfile?.status !== "contractuel",
      );
      items.sort((a, b) => {
        const rank = (reading: PayslipReading) =>
          reading.year !== undefined && reading.month !== undefined
            ? reading.year * 12 + reading.month
            : -1;
        return rank(b.reading) - rank(a.reading);
      });
      const readableItems = items.filter(
        (item) => item.reading.gross || item.reading.baseSalary,
      );
      const bestForCheck =
        readableItems.find(
          (item) =>
            item.reading.year === payView.getFullYear() &&
            item.reading.month === payView.getMonth(),
        ) || readableItems[0];
      if (bestForCheck && mode === "verify") {
        setPayslipCheck(bestForCheck);
        if (
          bestForCheck.reading.year !== undefined &&
          bestForCheck.reading.month !== undefined
        ) {
          setPayView(
            localDate(
              bestForCheck.reading.year,
              bestForCheck.reading.month,
              1,
            ),
          );
        } else {
          setPayslipFallbackMonth(payView.getMonth());
          setPayslipFallbackYear(payView.getFullYear());
          setPayslipNeedsPeriod(true);
        }
      } else if (mode === "verify") {
        setPayslipError(
          "Aucun bulletin n’a pu être lu pour la comparaison. Sa mise en page a peut-être changé.",
        );
      }
      const profileSource =
        mode === "verify"
          ? bestForCheck || items[0]
          : readableItems[0] || items[0];
      const targetPayYear = String(
        profileSource?.reading.year ?? payView.getFullYear(),
      );
      const targetPayMonth = profileSource?.reading.month ?? payView.getMonth();
      const targetNetRatioRegime: PayCalibrationRegime = payCalibrationRegime(
        Number(targetPayYear),
        targetPayMonth,
      );
      const targetPayProfile = effectivePayProfile(payProfiles, targetPayYear, targetPayMonth);
      const found: Partial<Record<PayslipImportFieldKey, number>> = {};
      let importedCiaMonth: number | undefined;
      for (const field of importFields) {
        for (const item of items) {
          const value = item.reading[field.key];
          if (value === undefined) continue;
          found[field.key] = value;
          if (field.key === "cia") importedCiaMonth = item.reading.month;
          break;
        }
      }
      const monthlyPayProfiles = items.flatMap((item) => {
        const reading = item.reading;
        if (
          reading.year === undefined ||
          reading.month === undefined ||
          (reading.baseSalary === undefined &&
            reading.residenceAllowance === undefined)
        )
          return [];
        return [
          {
            year: reading.year,
            month: reading.month,
            baseSalary: reading.baseSalary,
            residenceAllowance: reading.residenceAllowance,
          },
        ];
      });
      // Les bulletins vérifiés lors des visites précédentes, gardés dans le
      // compte, comptent avec ceux de cette visite : septembre vérifié
      // aujourd'hui et août demain suffisent à affiner les deux taux.
      const nextRateSamples = combinePayslipRateReadings(
        formProfile?.payslipRateSamples,
        [...payslipRateSamples, ...items],
      );
      const addedRateSamples = payslipRateSamplesFromReadings(
        items.map(({ reading }) => reading),
      );
      // Un mois relu remplace sa première lecture : les montants que celle-ci
      // seule avait posés, et que la nouvelle ne porte pas, s'effacent.
      const storedSamples = formProfile?.payslipRateSamples || {};
      const clearedAmounts = Object.keys(addedRateSamples).flatMap((period) => {
        const previous = storedSamples[period];
        if (!previous) return [];
        const others = Object.entries(storedSamples).filter(([key]) => key !== period).map(([, sample]) => sample);
        return amountsPosedOnlyBy(previous, effectivePayProfile(payProfiles, targetPayYear, targetPayMonth, formProfile || {}), others, found);
      });
      const compatibleRateReadings = readingsForCalibrationRegime(
        nextRateSamples.map((item) => item.reading),
        targetNetRatioRegime,
      );
      // Dès le premier bulletin, les taux de départ du statut se calent sur
      // le net réel ; des bulletins aux primes différentes les séparent.
      const calculatedRates = calculateNetRatios(
        compatibleRateReadings,
        defaultNetRatiosForPeriod(Number(targetPayYear), targetPayMonth, formProfile?.status === "contractuel"),
      );
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
        const { year: fromYear, month: fromMonth } = bestForCheck.reading;
        // Le report qu'une lecture précédente de ce même mois avait provoqué :
        // relu, le mois repart du compte entier, et cette lecture décide seule.
        const reported =
          formProfile?.sundayCarryover &&
          formProfile.sundayCarryoverFromYear === fromYear &&
          formProfile.sundayCarryoverFromMonth === fromMonth
            ? formProfile.sundayCarryover
            : 0;
        const expected =
          allowances.monthly.find((slot) => slot.index === fromMonth)?.sundayCount || 0;
        const decision = sundayReportAfterReading({
          expected,
          reported,
          paid: bestForCheck.reading.sundaysBeyondTen,
        });
        const target = nextSundayPayoutSlot(fromYear, fromMonth)
          ?? (formProfile?.sundayCarryoverYear !== undefined && formProfile.sundayCarryoverMonth !== undefined
            ? { year: formProfile.sundayCarryoverYear, month: formProfile.sundayCarryoverMonth }
            : null);
        if (decision.kind === "keep" || !target) return null;
        return {
          count: decision.kind === "report" ? decision.count : 0,
          previous: reported,
          fromYear,
          fromMonth,
          target,
        };
      })();
      const applied = importFields.filter(
        (field) => found[field.key] !== undefined,
      );
      if (!applied.length && !calculatedRates) {
        setPayslipImportError(
          "Aucun des montants attendus n’a été reconnu sur ces bulletins.",
        );
        return;
      }
      // Un bulletin photographié fait deux pages : tant qu'il en manque une,
      // rien n'est demandé ni enregistré ; on attend l'autre photo (ou que
      // la personne dise qu'il n'y en a pas).
      if (
        includesPhoto &&
        mode === "verify" &&
        !completePhotos &&
        isIncompletePayslipReading(bestForCheck?.reading)
      ) {
        setPayslipPhotoPending(true);
        return;
      }
      setPayslipPhotoPending(false);
      if (includesPhoto) {
        const detected = [
          ...applied.map((field) => {
            const value = found[field.key];
            return `${field.label} : ${field.key === "pasRate" ? `${value?.toLocaleString("fr-FR")} %` : euros(value || 0)}`;
          }),
          ...(calculatedRates ? ["Taux d’estimation affinés"] : []),
        ];
        const confirmed = await confirmAction({
          title: "Valeurs lues sur la photo",
          message: `Photo analysée sur cet appareil. Vérifiez :\n${detected.join("\n")}`,
          confirmLabel: "Enregistrer dans mon profil",
          cancelLabel: "Ne pas enregistrer",
        });
        if (!confirmed) {
          setPayslipImportError("Les valeurs détectées sur la photo n’ont pas été enregistrées.");
          return;
        }
      }
      setPayslipRateSamples(nextRateSamples);
      // Un « Jour de carence » nomme le premier jour d'un arrêt : cet arrêt
      // est donc retenu sur la paie de ce bulletin, quoi qu'en dise la règle
      // du 10. Seuls les arrêts enregistrés dans l'application sont rattachés.
      const { payMonths: deductionPayMonths, attached } = attachCarencesToPayslips(
        sickLeaveDates(periods),
        items.map(({ reading }) => reading),
        formProfile?.deductionPayMonths,
      );
      const attachedByPayslip = attached.map(({ slice, payMonth }) =>
        `${deductionSliceLabel(slice)} rattaché à la paie ${ofPayMonth(payMonth)}, comme le montre le bulletin.`,
      );
      const nextProfile: FormProfile = {
        ...payProfileBase(formProfile, group),
        deductionPayMonths,
        baseSalary:
          found.baseSalary ??
          targetPayProfile?.baseSalary ??
          formProfile?.baseSalary,
        residenceAllowance:
          found.residenceAllowance ??
          targetPayProfile?.residenceAllowance ??
          formProfile?.residenceAllowance,
        ifse: found.ifse ?? targetPayProfile?.ifse ?? formProfile?.ifse,
        carenceDay:
          found.carenceDay ??
          targetPayProfile?.carenceDay ??
          formProfile?.carenceDay,
        otherFixed:
          found.otherFixed ??
          targetPayProfile?.otherFixed ??
          formProfile?.otherFixed,
        cia: found.cia ?? targetPayProfile?.cia ?? formProfile?.cia,
        ciaMonth:
          importedCiaMonth ?? targetPayProfile?.ciaMonth ?? formProfile?.ciaMonth,
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
        navigo:
          found.navigo ?? targetPayProfile?.navigo ?? formProfile?.navigo,
        mealVoucherDeduction:
          found.mealVoucherDeduction ??
          targetPayProfile?.mealVoucherDeduction ??
          formProfile?.mealVoucherDeduction,
        pasRate:
          found.pasRate ?? targetPayProfile?.pasRate ?? formProfile?.pasRate,
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
        payslipRateSamples: mergePayslipRateSamples(
          formProfile?.payslipRateSamples,
          addedRateSamples,
        ),
        ...Object.fromEntries(clearedAmounts.map((field) => [field, undefined])),
      };
      if (!demoMode) {
        const body: Record<string, unknown> = {
          action: "save-form-profile",
          payYear: Number(targetPayYear),
          payMonth: targetPayMonth,
          monthlyPayProfiles: monthlyPayProfiles.map((profile) => ({
            year: profile.year,
            month: profile.month,
            ...(profile.baseSalary !== undefined
              ? { baseSalaryCents: Math.round(profile.baseSalary * 100) }
              : {}),
            ...(profile.residenceAllowance !== undefined
              ? {
                  residenceAllowanceCents: Math.round(
                    profile.residenceAllowance * 100,
                  ),
                }
              : {}),
          })),
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
        if (importedCiaMonth !== undefined) body.ciaMonth = importedCiaMonth;
        if (found.navigo !== undefined)
          body.navigoCents = Math.round(found.navigo * 100);
        if (found.mealVoucherDeduction !== undefined)
          body.mealVoucherDeductionCents = Math.round(
            found.mealVoucherDeduction * 100,
          );
        if (found.pasRate !== undefined)
          body.pasRateBp = Math.round(found.pasRate * 100);
        for (const field of clearedAmounts) body[AMOUNT_BODY_KEYS[field]] = null;
        if (calculatedRates) {
          body.netRatioFixedBp = Math.round(
            calculatedRates.netRatioFixed * 100,
          );
          body.netRatioVariableBp = Math.round(
            calculatedRates.netRatioVariable * 100,
          );
          body.netRatioRegime = targetNetRatioRegime;
        }
        if (attachedByPayslip.length) body.deductionPayMonths = deductionPayMonths;
        // Seuls les montants utiles au calcul des taux, jamais le fichier.
        if (Object.keys(addedRateSamples).length)
          body.payslipRateSamples = addedRateSamples;
        if (automaticSundayReport) {
          body.sundayCarryover = automaticSundayReport.count;
          body.sundayCarryoverYear = automaticSundayReport.target.year;
          body.sundayCarryoverMonth = automaticSundayReport.target.month;
          body.sundayCarryoverFromYear = automaticSundayReport.fromYear;
          body.sundayCarryoverFromMonth = automaticSundayReport.fromMonth;
        }
        await post(body);
      }
      setFormProfile(nextProfile);
      setPayProfiles((current) => {
        const next: Record<string, PayProfile> = {
          ...current,
          [targetPayYear]: {
            ...(current[targetPayYear] || {}),
            ...Object.fromEntries(
              importFields
                .filter((field) => found[field.key] !== undefined)
                .map((field) => [field.key, found[field.key]]),
            ),
            ...(importedCiaMonth !== undefined
              ? { ciaMonth: importedCiaMonth }
              : {}),
            ...(calculatedRates || {}),
            ...(calculatedRates
              ? { netRatioRegime: targetNetRatioRegime }
              : {}),
          },
        };
        for (const profile of monthlyPayProfiles) {
          const key = `${profile.year}-${String(profile.month + 1).padStart(2, "0")}`;
          next[key] = {
            ...(next[key] || {}),
            ...(profile.baseSalary !== undefined
              ? { baseSalary: profile.baseSalary }
              : {}),
            ...(profile.residenceAllowance !== undefined
              ? { residenceAllowance: profile.residenceAllowance }
              : {}),
          };
        }
        return withoutAmounts(next, targetPayYear, clearedAmounts);
      });
      setPayslipImportResult({
        applied: [
          ...applied.map((field) => {
            const value = found[field.key];
            return {
              label: field.label,
              value:
                value === undefined
                  ? "—"
                  : field.key === "pasRate"
                    ? `${value.toLocaleString("fr-FR")} %`
                    : euros(value),
            };
          }),
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
        missing: importFields
          .filter(
            (field) =>
              found[field.key] === undefined &&
              shouldReportMissingPayslipField(field.key, mode),
          )
          .map((field) => field.label),
        adjustment:
          [
            ...attachedByPayslip,
            automaticSundayReport
              ? automaticSundayReport.count === 0
                ? `Le report de ${automaticSundayReport.previous} dimanche${s(automaticSundayReport.previous)} de ${MONTHS[automaticSundayReport.fromMonth]} vers ${MONTHS[automaticSundayReport.target.month]}, venu d’une lecture précédente, est retiré : ce bulletin les paie.`
                : `${automaticSundayReport.count} dimanche${s(
                    automaticSundayReport.count,
                  )} non payé${s(automaticSundayReport.count)} retiré${s(
                    automaticSundayReport.count,
                  )} automatiquement du net de ${MONTHS[automaticSundayReport.fromMonth]} et reporté${s(
                    automaticSundayReport.count,
                  )} sur ${MONTHS[automaticSundayReport.target.month]}${
                    automaticSundayReport.previous && automaticSundayReport.previous !== automaticSundayReport.count
                      ? ` (au lieu de ${automaticSundayReport.previous} d’après la lecture précédente)`
                      : ""
                  }.`
              : undefined,
            // Dit seulement quand il explique des taux pas encore affinés :
            // un ancien bulletin gardé ne doit pas le répéter à chaque fois.
            ignoredRateSampleCount > 0 && !calculatedRates
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

  return {
    savePayAmount,
    saveAnnualPayProfile,
    saveCiaMonth,
    removePayslipRateSample,
    nextSundayPayoutSlot,
    reportMissingSundays,
    clearSundayCarryover,
    moveDeduction,
    chooseHolidayPay,
    importPayslips,
    /** Ajoute une ou plusieurs pages au bulletin qui vient d'être vérifié. */
    addPayslipPages: (files: File[]) => importPayslips(files, "verify", payslipPagesRef.current),
    /** Termine la vérification d'un bulletin photographié avec les pages déjà lues. */
    finishPayslipPhotos: () => importPayslips([], "verify", payslipPagesRef.current, { completePhotos: true }),
    applyPayslipFallbackPeriod,
    grossForMonth,
  };
}
