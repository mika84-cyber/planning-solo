import { calendarErrorMessage, postCalendar } from "./calendarApi";
import { EMPTY_MANUAL_ADJUSTMENTS } from "./payAllowances";
import type { CetAccount } from "./cet";
import type { FormProfile, ManualYearAdjustments } from "./appModel";
import { LEAVE_ALLOWANCES } from "./planningLogic";

type ProfileAdjustmentOptions = {
  demoMode: boolean;
  group: number;
  absenceYear: number;
  formProfile: FormProfile | null;
  setFormProfile: (profile: FormProfile | null) => void;
  manualAdjustmentDraft: Record<keyof ManualYearAdjustments, string>;
  setManualAdjustmentDraft: (
    draft: Record<keyof ManualYearAdjustments, string>,
  ) => void;
  setManualAdjustmentsOpen: (open: boolean) => void;
  setSavingManualAdjustments: (saving: boolean) => void;
  savingCet: boolean;
  setSavingCet: (saving: boolean) => void;
  setBalanceDetailType: (type: null) => void;
  notify: (message: string) => void;
  confirm: (message: string) => void;
};

/** Le rattrapage d'une reprise en cours d'année et le compte épargne-temps :
 *  deux écritures sur le profil, qui passent par le même enregistrement. */
export function useProfileAdjustmentActions({
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
}: ProfileAdjustmentOptions) {
  /** Le profil à écrire, complété au besoin pour une première saisie. */
  function profileBase(): FormProfile {
    return (
      formProfile || {
        fullName: "",
        group: String(group),
        signature: "",
      }
    );
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
      ...profileBase(),
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
      ...profileBase(),
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

  return { openManualAdjustments, saveManualAdjustments, saveCetAccount };
}
