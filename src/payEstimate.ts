export type PayEstimateField =
  | "baseSalary"
  | "ifse"
  | "otherFixed"
  | "carenceDay"
  | "pasRate";

export type PayEstimateReadinessInput = {
  isContractuel: boolean;
  availableFields: ReadonlySet<PayEstimateField>;
  sickDays: number;
};

/**
 * Décrit précisément ce qui manque avant d'afficher une projection.
 * Une valeur égale à zéro reste une valeur connue : on teste sa présence,
 * jamais sa valeur de vérité.
 */
export function payEstimateReadiness({
  isContractuel,
  availableFields,
  sickDays,
}: PayEstimateReadinessInput) {
  const grossMissing = [
    !availableFields.has("baseSalary") ? "traitement de base" : "",
    !isContractuel && !availableFields.has("ifse") ? "IFSE" : "",
    !isContractuel && !availableFields.has("otherFixed")
      ? "autres éléments fixes"
      : "",
    sickDays > 0 && !availableFields.has("carenceDay")
      ? "montant d’un jour de carence"
      : "",
  ].filter(Boolean);
  const netMissing = [
    ...grossMissing,
    !availableFields.has("pasRate") ? "taux d’imposition (PAS)" : "",
  ].filter(Boolean);

  return {
    grossMissing,
    netMissing,
    grossReady: grossMissing.length === 0,
    netReady: netMissing.length === 0,
  };
}

/** Les heures supplémentaires et les mécénats sont exonérés d'impôt sur le
 *  revenu : ils sortent du net imposable, où ne revient que la CSG
 *  déductible prélevée sur eux (6,8 % de 98,25 %). Vérifié au centime sur un
 *  bulletin d'octobre 2026 (net imposable 2 404,18 €). */
const EXEMPT_TAXABLE_SHARE = 1 - 0.9825 * 0.068;

/** L'impôt du mois : le taux appliqué au net imposable, reconstitué à partir
 *  du net avant impôt (facteur correcteur), moins les heures exonérées. */
export function estimatedIncomeTax(netBeforeTax: number, pasRate: number, adjustment: number, exempt = 0) {
  return Math.round(Math.max(0, netBeforeTax * adjustment - exempt * EXEMPT_TAXABLE_SHARE) * pasRate) / 100;
}
