import type { Dispatch, SetStateAction } from "react";
import type { FormProfile } from "./appModel";
import { calendarErrorMessage } from "./calendarApi";
import type { WorkQuota, WorkSchedule } from "./overtime";
import type { PayCalendarPost } from "./usePayActions";

type WorkProfileActionsOptions = {
  demoMode: boolean;
  group: number;
  formProfile: FormProfile | null;
  setFormProfile: Dispatch<SetStateAction<FormProfile | null>>;
  setPayProfileOpen: (open: boolean) => void;
  notify: (message: string) => void;
  post: PayCalendarPost;
};

/** La quotité et les horaires habituels du profil de calcul : enregistrés
 *  sur-le-champ, et rendus tels quels si le serveur refuse. */
export function useWorkProfileActions({
  demoMode,
  group,
  formProfile,
  setFormProfile,
  setPayProfileOpen,
  notify,
  post,
}: WorkProfileActionsOptions) {
  function changeWorkQuota(nextQuota: WorkQuota) {
    const previousProfile = formProfile;
    const nextProfile: FormProfile = {
      fullName: formProfile?.fullName || "",
      group: formProfile?.group || String(group),
      signature: formProfile?.signature || "",
      status: formProfile?.status,
      workQuota: nextQuota,
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
    };
    setFormProfile(nextProfile);
    if (demoMode)
      return;
    void post({
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

  /** Le profil garde la saisie telle quelle, même à moitié faite : sans cela
   *  on ne pourrait jamais choisir l'heure de début avant celle de fin. Seule
   *  une plage complète et cohérente part au serveur — il refuse une plage à
   *  moitié remplie, et la saisie s'effaçait alors aussitôt. Deux champs vides
   *  effacent les horaires. `announce` signale une plage à compléter, lors
   *  de l'enregistrement explicite. */
  async function changeWorkSchedule(nextSchedule: WorkSchedule | undefined, announce = false) {
    const schedule = nextSchedule;
    const previousProfile = formProfile;
    const nextProfile: FormProfile = {
      ...(formProfile || { fullName: "", group: String(group), signature: "" }),
      workSchedule: schedule,
    };
    setFormProfile(nextProfile);
    if (demoMode) return true;
    const cleared = !schedule?.start && !schedule?.end;
    const complete = Boolean(schedule?.start && schedule?.end && schedule.start < schedule.end);
    if (!cleared && !complete) {
      if (announce)
        notify(schedule?.start && schedule?.end
          ? "L’heure de fin doit suivre l’heure de début."
          : "Indiquez l’heure de début et l’heure de fin.");
      return !announce;
    }
    try {
      await post({
        action: "save-form-profile",
        fullName: nextProfile.fullName,
        group: nextProfile.group,
        signature: nextProfile.signature,
        workSchedule: cleared ? null : schedule,
      });
      return true;
    } catch (error) {
      setFormProfile(previousProfile);
      notify(calendarErrorMessage(error, "Les horaires habituels n’ont pas pu être enregistrés."));
      return false;
    }
  }

  async function saveCalculationProfile() {
    const saved = await changeWorkSchedule(formProfile?.workSchedule, true);
    if (!saved) return;
    setPayProfileOpen(false);
  }

  return { changeWorkQuota, changeWorkSchedule, saveCalculationProfile };
}
