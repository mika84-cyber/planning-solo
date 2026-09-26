/** Jours de fractionnement des agents d'accueil, d'après la note de service
 *  « Demande de congés ».
 *
 *  Comptent les jours de congés annuels (et jours spécifiques du ministère,
 *  compris dans les CA de l'application) pris hors de la période du 1er mai
 *  au 31 octobre ; les ARTT n'y entrent pas et les demi-journées comptent
 *  pour moitié. De 4 à 6,5 jours : 1 jour de fractionnement ; 7 jours et
 *  plus : 2 jours.
 *
 *  Ce calcul s'applique à partir de 2027 ; les années précédentes gardent
 *  les 2 jours accordés d'office. Partagé par l'application et le serveur. */

export const FRACTION_RULE_START_YEAR = 2027;
/** Droit accordé d'office avant 2027, et plafond des saisies sans date. */
export const FIXED_FRACTION_ALLOWANCE = 2;
/** Agents d'accueil : jours posés hors période → jours de fractionnement. */
export const FRACTION_STEPS = [
  { from: 4, grant: 1 },
  { from: 7, grant: 2 },
] as const;

/** Hors de la période du 1er mai au 31 octobre. */
export function isOffSeasonDate(key: string) {
  const month = Number(key.slice(5, 7));
  return month < 5 || month > 10;
}

export function usesFractionRule(year: number) {
  return year >= FRACTION_RULE_START_YEAR;
}

/** Jours de fractionnement accordés pour l'année. */
export function fractionAllowance(year: number, offSeasonDays: number) {
  if (!usesFractionRule(year)) return FIXED_FRACTION_ALLOWANCE;
  return FRACTION_STEPS.reduce<number>((grant, step) => (offSeasonDays >= step.from ? step.grant : grant), 0);
}
