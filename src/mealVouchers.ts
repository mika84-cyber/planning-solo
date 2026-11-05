/**
 * Les titres repas : ce que la paie retient chaque mois. La valeur du titre
 * dépend de l'indice de rémunération et fixe la part de l'agent ; le nombre de
 * titres se choisit mois par mois, 20 au plus et 220 sur l'année. Tant que
 * rien n'est renseigné : 20 titres par mois, donc aucun en décembre ni retenue.
 */
export type MealVoucherTier = { faceCents: number; agentCents: number; indices: string };

export const MEAL_VOUCHER_TIERS: readonly MealVoucherTier[] = [
  { faceCents: 1030, agentCents: 412, indices: "Indices < 427" },
  { faceCents: 990, agentCents: 495, indices: "Indices 428 à 604" },
];
export const MEAL_VOUCHERS_PER_MONTH = 20;
export const MEAL_VOUCHERS_PER_YEAR = 220;

/** Le choix d'une année : la valeur du titre et le nombre de titres de chacun
 *  des douze mois. Gardé dans le profil sous l'année (« 2026 »). */
export type MealVoucherPlan = { faceCents: number; counts: number[] };
export type MealVoucherPlans = Record<string, MealVoucherPlan>;

const repeat = (count: number, times: number) => Array.from({ length: times }, () => count);
export const DEFAULT_MEAL_VOUCHER_COUNTS = [...repeat(20, 11), 0];
export const MEAL_VOUCHER_PRESETS = [
  { key: "default", label: "20 par mois", detail: "Rien en décembre", counts: DEFAULT_MEAL_VOUCHER_COUNTS },
  { key: "spread", label: "18 par mois", detail: "20 en novembre et décembre", counts: [...repeat(18, 10), 20, 20] },
];

export const mealVoucherTotal = (counts: readonly number[]) => counts.reduce((sum, count) => sum + count, 0);
const agentCents = (plan: MealVoucherPlan) => MEAL_VOUCHER_TIERS.find((tier) => tier.faceCents === plan.faceCents)?.agentCents ?? 0;
/** La part de l'agent sur un titre, en euros. */
export const mealVoucherAgentPart = (plan: MealVoucherPlan) => agentCents(plan) / 100;

/** Le choix qui vaut pour une année : le sien, sinon le dernier fait avant
 *  elle. Il ne remonte pas : remplir 2027 ne change pas l'estimation de 2026. */
export function mealVoucherPlanFor(plans: MealVoucherPlans | undefined, year: number): MealVoucherPlan | null {
  const known = Object.keys(plans ?? {}).filter((key) => Number(key) <= year).sort().at(-1);
  return known && plans ? plans[known] : null;
}

/** Ce que la paie du mois retient. Sans choix, le montant connu du profil (lu
 *  sur un bulletin), onze mois sur douze : 20 titres par mois, rien en décembre. */
export function mealVoucherRetention(plan: MealVoucherPlan | null, month: number, fallback: number) {
  if (!plan) return month === 11 ? 0 : fallback;
  return (plan.counts[month] * agentCents(plan)) / 100;
}

/** La retenue d'un mois ordinaire, quand ce mois-ci n'en a pas : la paie la
 *  montre barrée, plutôt que de laisser deviner pourquoi le net grimpe. */
export function mealVoucherWaived(plan: MealVoucherPlan | null, month: number, fallback: number) {
  if (!plan) return month === 11 ? fallback : 0;
  return plan.counts[month] ? 0 : (Math.max(...plan.counts) * agentCents(plan)) / 100;
}

/** La valeur du titre que trahit une retenue lue sur un bulletin : 99,00 € est
 *  un multiple de 4,95 €, part de l'agent sur un titre à 9,90 €. */
export function faceCentsFromRetention(retention: number) {
  const cents = Math.round(retention * 100);
  if (cents <= 0) return undefined;
  return MEAL_VOUCHER_TIERS.find((tier) => cents % tier.agentCents === 0 && cents <= MEAL_VOUCHERS_PER_MONTH * tier.agentCents)?.faceCents;
}

export function sanitizeMealVoucherPlans(value: unknown): MealVoucherPlans {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const plans: MealVoucherPlans = {};
  for (const [year, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(year) || !raw || typeof raw !== "object") continue;
    const { faceCents, counts } = raw as { faceCents?: unknown; counts?: unknown };
    if (!MEAL_VOUCHER_TIERS.some((tier) => tier.faceCents === faceCents) || !Array.isArray(counts) || counts.length !== 12) continue;
    if (counts.some((count) => !Number.isInteger(count) || count < 0 || count > MEAL_VOUCHERS_PER_MONTH)) continue;
    if (mealVoucherTotal(counts) > MEAL_VOUCHERS_PER_YEAR) continue;
    plans[year] = { faceCents: faceCents as number, counts: [...counts] };
  }
  return plans;
}
