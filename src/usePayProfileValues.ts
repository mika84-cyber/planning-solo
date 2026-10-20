import type { FormProfile, PayProfile } from "./appModel";
import { dailyMinutesForQuota, type WorkQuota } from "./overtime";
import {
  defaultNetRatiosForPeriod,
  inspectNetRatioCalibration,
  payCalibrationRegime,
  readingsForCalibrationRegime,
  type PayslipReading,
} from "./payslip";
import { RESIDENCE_ALLOWANCE_RATE } from "./planningLogic";
import { effectivePayProfile } from "./usePayActions";

type PayProfileValuesInput = {
  formProfile: FormProfile | null;
  payProfiles: Record<string, PayProfile>;
  /** Le mois de paie affiché dans Ma paie. */
  payView: Date;
  /** Les bulletins lus, pour calibrer les taux de net. */
  payslipRateSamples: Array<{ reading: PayslipReading }>;
};

/**
 * Les valeurs du profil de paie pour le mois affiché : statut, quotité,
 * traitement et primes fixes, taux de net et de prélèvement, report de
 * dimanches. Ce sont des lectures directes du profil, sans mémo : elles
 * sont recalculées à chaque rendu, comme lorsqu'elles vivaient dans App.tsx.
 */
export function usePayProfileValues({ formProfile, payProfiles, payView, payslipRateSamples }: PayProfileValuesInput) {
  // Au premier usage, le statut demandé est désormais « contractuel ». Dès
  // qu'un choix est enregistré, la valeur persistée reprend naturellement la
  // priorité lors des ouvertures suivantes.
  const isContractuel = formProfile?.status !== "fonctionnaire";
  // Seul un statut réellement choisi écarte l'IFSE et le CIA : tant que le
  // statut n'est qu'une valeur de repli, une IFSE lue sur un bulletin reste
  // comptée, au cas où la personne serait fonctionnaire.
  const confirmedContractuel = formProfile?.status === "contractuel";
  const workQuota: WorkQuota = formProfile?.workQuota || "full";
  const workDayMinutes = dailyMinutesForQuota(workQuota);
  const payYear = String(payView.getFullYear());
  // Les réglages généraux restent disponibles pour tous les mois. Les valeurs
  // annuelles ou datées ne remplacent que les champs propres à leur période ;
  // le contrôle d'un bulletin reste, lui, filtré sur son mois plus bas.
  const activePayProfile = effectivePayProfile(
    payProfiles,
    payYear,
    payView.getMonth(),
    formProfile || {},
  );
  const hasPayValue = (field: keyof PayProfile) =>
    activePayProfile[field] !== undefined;
  const baseSalary = activePayProfile.baseSalary ?? 0;
  // Un contractuel n'a ni IFSE ni CIA.
  const ifse = confirmedContractuel ? 0 : activePayProfile.ifse ?? 0;
  const carenceDay = activePayProfile.carenceDay ?? 0;
  // Pour une contractuelle, la seule ligne fixe confirmée est l'indemnité de
  // résidence (3 % du traitement) : calculée toute seule plutôt que saisie,
  // et pas la somme à cinq lignes propre à un fonctionnaire (résidence +
  // SMIC comp. + ICHCSG + MGEN − transfert), dont rien ne dit qu'elle
  // s'applique à elle. Une valeur déjà saisie à la main reste prioritaire,
  // au cas où son bulletin réel montrerait autre chose.
  const otherFixed =
    activePayProfile.otherFixed ??
    (isContractuel ? baseSalary * RESIDENCE_ALLOWANCE_RATE : 0);
  const cia = confirmedContractuel ? 0 : activePayProfile.cia ?? 0;
  const ciaMonth = activePayProfile.ciaMonth;
  const residenceAllowance =
    activePayProfile.residenceAllowance ??
    (isContractuel ? baseSalary * RESIDENCE_ALLOWANCE_RATE : undefined);
  const viewedPayRegime = payCalibrationRegime(
    payView.getFullYear(),
    payView.getMonth(),
  );
  const defaultNetRatios = defaultNetRatiosForPeriod(
    payView.getFullYear(),
    payView.getMonth(),
    confirmedContractuel,
  );
  // Les profils antérieurs à ce champ ont tous été calibrés sous le régime
  // collectif actuel : on les traite comme tels pour ne pas changer les
  // estimations récentes déjà validées.
  const storedNetRatioRegime =
    activePayProfile.netRatioRegime ??
    "culture-psc";
  const storedNetRatioFixed = activePayProfile.netRatioFixed;
  const storedNetRatioVariable = activePayProfile.netRatioVariable;
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
  const navigo = activePayProfile.navigo ?? 0;
  const mealVoucherDeduction =
    activePayProfile.mealVoucherDeduction ??
    0;
  const pasRate = activePayProfile.pasRate ?? 0;
  /** L'administration prélève le PAS sur une assiette « net imposable »
   *  toujours un peu plus large que le net avant impôt reconstitué ici —
   *  jamais détaillée sur le bulletin. Facteur correcteur calibré sur 3
   *  bulletins réels (2026), stable à ± 0,7 point près sur les trois : sans
   *  lui, appliquer le taux affiché tel quel sous-estime l'impôt retenu. */
  const pasBaseAdjustment = confirmedContractuel
    // Contractuel : net imposable 2 322,05 € pour 2 171,39 € de net avant
    // impôt sur un bulletin réel (juin 2026), la part employeur de la
    // mutuelle et la CSG non déductible s'y ajoutant.
    ? 1.069
    : 1.057;
  const sundayCarryover = formProfile?.sundayCarryover || 0;
  const sundayCarryoverYear = formProfile?.sundayCarryoverYear;
  const sundayCarryoverMonth = formProfile?.sundayCarryoverMonth;
  const sundayCarryoverFromYear = formProfile?.sundayCarryoverFromYear;
  const sundayCarryoverFromMonth = formProfile?.sundayCarryoverFromMonth;
  const deductionPayMonths = formProfile?.deductionPayMonths;

  return {
    isContractuel,
    confirmedContractuel,
    workQuota,
    workDayMinutes,
    payYear,
    hasPayValue,
    baseSalary,
    ifse,
    carenceDay,
    otherFixed,
    cia,
    ciaMonth,
    residenceAllowance,
    viewedPayRegime,
    netRatioFixed,
    netRatioVariable,
    payslipRateCalibration,
    navigo,
    mealVoucherDeduction,
    pasRate,
    pasBaseAdjustment,
    sundayCarryover,
    sundayCarryoverYear,
    sundayCarryoverMonth,
    sundayCarryoverFromYear,
    sundayCarryoverFromMonth,
    deductionPayMonths,
  };
}

export type PayProfileValues = ReturnType<typeof usePayProfileValues>;
