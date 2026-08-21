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
