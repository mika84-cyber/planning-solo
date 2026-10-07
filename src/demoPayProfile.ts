import type { FormProfile, PayProfile } from "./appModel";

/**
 * Le profil de paie fictif de la démonstration de prévisualisation : un agent
 * fonctionnaire à temps plein du groupe 2. Sans lui, la démo affiche
 * « Montant à estimer » partout où un traitement est nécessaire (heures sup,
 * estimation de paie, contrôle du bulletin).
 *
 * Il n'est chargé que si VITE_DEMO_PAY_PROFILE vaut « true » : la suite de
 * tests garde une démo sans profil, pour vérifier aussi ce cas.
 */
export const DEMO_PAY_PROFILE: FormProfile = {
  fullName: "",
  group: "2",
  signature: "",
  status: "fonctionnaire",
  workQuota: "full",
  baseSalary: 1801.73,
  residenceAllowance: 54.05,
  ifse: 416.66,
  carenceDay: 75,
  otherFixed: 54.05,
  pasRate: 1.7,
  netRatioFixed: 78.4,
  netRatioVariable: 86.2,
  netRatioRegime: "culture-psc",
};

export function demoPayProfiles(year: number): Record<string, PayProfile> {
  const { baseSalary, residenceAllowance, ifse, carenceDay, otherFixed, netRatioFixed, netRatioVariable, netRatioRegime } = DEMO_PAY_PROFILE;
  return { [String(year)]: { baseSalary, residenceAllowance, ifse, carenceDay, otherFixed, netRatioFixed, netRatioVariable, netRatioRegime } };
}
