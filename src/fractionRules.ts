/** Jours de fractionnement, d'après la note de service « Demande de congés ».
 *
 *  Comptent les jours de congés annuels (et jours spécifiques du ministère,
 *  compris dans les CA de l'application) pris hors de la période du 1er mai
 *  au 31 octobre ; les ARTT n'y entrent pas. Selon la catégorie de l'agent,
 *  un premier puis un second seuil ouvrent 1 puis 2 jours (pour les ASI en
 *  24 heures : ½ puis 1 garde). Les demi-journées comptent pour moitié.
 *
 *  Ce calcul s'applique à partir de 2027 ; les années précédentes gardent
 *  les 2 jours accordés d'office. Partagé par l'application et le serveur. */

export type FractionCategory =
  | "visitor_service"
  | "cashier"
  | "security"
  | "gtc_day"
  | "gtc_night"
  | "asi_12h"
  | "asi_24h"
  | "general";

export const DEFAULT_FRACTION_CATEGORY: FractionCategory = "visitor_service";
export const FRACTION_RULE_START_YEAR = 2027;
/** Droit accordé d'office avant 2027, et plafond des saisies sans date. */
export const FIXED_FRACTION_ALLOWANCE = 2;

type FractionRule = { label: string; steps: Array<{ from: number; grant: number }> };

export const FRACTION_RULES: Record<FractionCategory, FractionRule> = {
  visitor_service: { label: "Agent d’accueil", steps: [{ from: 4, grant: 1 }, { from: 7, grant: 2 }] },
  cashier: { label: "Caissier", steps: [{ from: 4, grant: 1 }, { from: 7, grant: 2 }] },
  security: { label: "Agent de sûreté", steps: [{ from: 4, grant: 1 }, { from: 7, grant: 2 }] },
  gtc_day: { label: "GTC de jour", steps: [{ from: 4, grant: 1 }, { from: 7, grant: 2 }] },
  gtc_night: { label: "GTC de nuit", steps: [{ from: 3, grant: 1 }, { from: 5, grant: 2 }] },
  asi_12h: { label: "ASI en 12 heures", steps: [{ from: 3, grant: 1 }, { from: 5, grant: 2 }] },
  asi_24h: { label: "ASI en 24 heures", steps: [{ from: 2, grant: 0.5 }, { from: 3, grant: 1 }] },
  // « de 5 à 7,5 jours : 1 jour ; au-delà : 2 jours ».
  general: { label: "Cadre général (hors planning)", steps: [{ from: 5, grant: 1 }, { from: 8, grant: 2 }] },
};

export const FRACTION_CATEGORY_OPTIONS = (Object.keys(FRACTION_RULES) as FractionCategory[]).map((value) => ({
  value,
  label: FRACTION_RULES[value].label,
}));

export function isFractionCategory(value: unknown): value is FractionCategory {
  return typeof value === "string" && Object.hasOwn(FRACTION_RULES, value);
}

/** Hors de la période du 1er mai au 31 octobre. */
export function isOffSeasonDate(key: string) {
  const month = Number(key.slice(5, 7));
  return month < 5 || month > 10;
}

export function usesFractionRule(year: number) {
  return year >= FRACTION_RULE_START_YEAR;
}

/** Jours de fractionnement accordés pour l'année. */
export function fractionAllowance(year: number, category: FractionCategory | undefined, offSeasonDays: number) {
  if (!usesFractionRule(year)) return FIXED_FRACTION_ALLOWANCE;
  const rule = FRACTION_RULES[category ?? DEFAULT_FRACTION_CATEGORY];
  return rule.steps.reduce((grant, step) => (offSeasonDays >= step.from ? step.grant : grant), 0);
}

/** Le palier suivant : combien de jours hors période il manque encore, et ce
 *  qu'il accorde. `null` quand le maximum est atteint ou avant 2027. */
export function nextFractionStep(year: number, category: FractionCategory | undefined, offSeasonDays: number) {
  if (!usesFractionRule(year)) return null;
  const step = FRACTION_RULES[category ?? DEFAULT_FRACTION_CATEGORY].steps.find((item) => offSeasonDays < item.from);
  return step ? { missing: step.from - offSeasonDays, grant: step.grant } : null;
}
