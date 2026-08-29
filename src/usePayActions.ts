import type { Dispatch, SetStateAction } from "react";
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
import {
  calculateNetRatios,
  extractPayslipTokens,
  payCalibrationRegime,
  readPayslip,
  readingsForCalibrationRegime,
  type PayCalibrationRegime,
  type PayslipReading,
} from "./payslip";
import { shouldReportMissingPayslipField } from "./payslipReview";
import {
  MONTHS,
  SUNDAY_ALLOWANCE,
  localDate,
  s,
  unpaidSundays,
  type HolidayPay,
} from "./planningLogic";
import { strikePayEstimate } from "./strike";
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
  view: Date;
  setView: SetState<Date>;
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
}

export function parsedPayDraft(draft: string) {
  return Number(draft.replace(",", ".").replace(/\s/g, ""));
}

export function payAmountPayload(
  field: PayDraftKey,
  value: number,
  payYear: number,
  profile: FormProfile,
) {
  const scaled = Math.round(value * 100);
  return {
    action: "save-form-profile",
    payYear,
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

export function nextSundayPayoutSlot(year: number, month: number) {
  if (month === 6) return { year, month: 9 };
  if (month === 9) return { year, month: 11 };
  if (month === 11) return { year: year + 1, month: 0 };
  if (month === 0) return { year, month: 6 };
  return null;
}

export function payslipImportFields(isContractuel: boolean): PayslipImportField[] {
  return [
    { key: "baseSalary", label: "Traitement de base" },
    { key: "residenceAllowance", label: "Indemnité de résidence" },
    ...(isContractuel ? [] : [{ key: "ifse" as const, label: "IFSE" }]),
    { key: "carenceDay", label: "Jour de carence" },
    { key: "otherFixed", label: "Autres éléments fixes" },
    ...(isContractuel ? [] : [{ key: "cia" as const, label: "CIA" }]),
    { key: "navigo", label: "Navigo remboursé" },
    { key: "mealVoucherDeduction", label: "Titres repas (retenue)" },
    { key: "pasRate", label: "Taux d’imposition (PAS)" },
  ];
}

export function usePayActions(options: PayActionsOptions) {
  const {
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
    post,
  } = options;
  const payYear = String(view.getFullYear());
  const importFields = payslipImportFields(isContractuel);

  async function savePayAmount(field: PayDraftKey) {
    const value = parsedPayDraft(payDrafts[field]);
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
          payAmountPayload(field, value, Number(payYear), nextProfile),
        );
      setFormProfile(nextProfile);
      setPayProfiles((current) => ({
        ...current,
        [payYear]: { ...(current[payYear] || {}), [field]: value },
      }));
      setPayDrafts((current) => ({ ...current, [field]: "" }));
    } catch {
      notify("Le montant n’a pas pu être enregistré. Réessayez.");
    } finally {
      setSavingPay(null);
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

  function grossForMonth(index: number) {
    const month = allowances?.monthly.find((slot) => slot.index === index);
    const overtime = paidOvertimeForPayPeriod(view.getFullYear(), index);
    const mecenat = mecenatForPayMonth(
      mecenatEntries,
      view.getFullYear(),
      index,
    );
    const strike = strikePayEstimate(
      periods,
      group,
      payProfiles,
      view.getFullYear(),
      index,
      { entries, recoveryUses },
    );
    const sick = isContractuel ? 0 : sickLeaves?.byMonth[index]?.total || 0;
    return (
      baseSalary +
      ifse +
      otherFixed +
      (index === ciaMonth ? cia : 0) +
      SUNDAY_ALLOWANCE.monthlyFlat +
      (month?.sunday || 0) +
      (month?.holiday || 0) -
      sick -
      (!isContractuel && strike.totalDeduction !== null
        ? strike.totalDeduction
        : 0) +
      overtime.amount +
      mecenat.grossAmountCents / 100
    );
  }

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
      const items: PayslipCheck[] = [];
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
        profileSource?.reading.year ?? view.getFullYear(),
      );
      const targetPayMonth = profileSource?.reading.month ?? view.getMonth();
      const targetNetRatioRegime: PayCalibrationRegime = payCalibrationRegime(
        Number(targetPayYear),
        targetPayMonth,
      );
      const targetPayProfile = payProfiles[targetPayYear];
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
      const rateSamplesByPeriod = new Map<string, PayslipCheck>();
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
      const applied = importFields.filter(
        (field) => found[field.key] !== undefined,
      );
      if (!applied.length && !calculatedRates) {
        setPayslipImportError(
          "Aucun des montants attendus n’a été reconnu sur ces bulletins.",
        );
        return;
      }
      const nextProfile: FormProfile = {
        ...payProfileBase(formProfile, group),
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
        return next;
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
            automaticSundayReport
              ? `${automaticSundayReport.count} dimanche${s(
                  automaticSundayReport.count,
                )} non payé${s(automaticSundayReport.count)} retiré${s(
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

  return {
    savePayAmount,
    saveCiaMonth,
    nextSundayPayoutSlot,
    reportMissingSundays,
    clearSundayCarryover,
    chooseHolidayPay,
    importPayslips,
    applyPayslipFallbackPeriod,
    grossForMonth,
  };
}
