/** Écart toléré entre le bulletin et les éléments retrouvés : les arrondis. */
export const EARLY_PAYMENT_TOLERANCE_CENTS = 50;

/**
 * Ce qu'un bulletin a payé en avance.
 *
 * Mécénats et heures « à payer » se règlent normalement le mois suivant ;
 * quand un bulletin en paie plus que prévu, on cherche, du plus ancien au
 * plus récent, les éléments du mois qui expliquent ce surplus. S'ils ne
 * l'expliquent pas entièrement, on laisse choisir un par un.
 */
export function matchEarlyPayment<T>(candidates: T[], centsOf: (item: T) => number, surplusCents: number) {
  if (surplusCents < EARLY_PAYMENT_TOLERANCE_CENTS || !candidates.length)
    return { candidates: [] as T[], matched: [] as T[] };
  const matched: T[] = [];
  let matchedCents = 0;
  for (const item of candidates) {
    if (matchedCents + centsOf(item) > surplusCents + EARLY_PAYMENT_TOLERANCE_CENTS) continue;
    matched.push(item);
    matchedCents += centsOf(item);
  }
  return {
    candidates,
    matched: Math.abs(matchedCents - surplusCents) <= EARLY_PAYMENT_TOLERANCE_CENTS ? matched : [],
  };
}
