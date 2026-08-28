export type PayslipReviewCheck = {
  key: string;
  label: string;
  found: number | undefined;
  expected: number;
  tolerance?: number;
};

export type PayslipReviewSummary = {
  verdict: string;
  tone: "ok" | "warning" | "unknown";
  issues: PayslipReviewCheck[];
  verified: PayslipReviewCheck[];
  unavailable: PayslipReviewCheck[];
};

/** CIA et carence sont des lignes ponctuelles : leur absence est normale sur
 * un bulletin ordinaire et ne doit pas être présentée comme une anomalie. */
export function shouldReportMissingPayslipField(
  key: string,
  mode: "verify" | "calibrate",
) {
  return mode !== "verify" || (key !== "cia" && key !== "carenceDay");
}

/** Une carence lue sur le bulletin devient un écart seulement lorsqu'aucun
 * arrêt maladie n'avait été enregistré pour ce mois dans l'application. */
export function isUnplannedPayslipCarence(
  foundCarence: number | undefined,
  plannedSickDays: number,
) {
  return foundCarence !== undefined && foundCarence > 0 && plannedSickDays <= 0;
}

/**
 * Résume uniquement les comparaisons que le bulletin permet réellement de
 * faire. Une ligne absente reste « non vérifiable » au lieu de devenir une
 * anomalie inventée.
 */
export function summarizePayslipReview(
  checks: PayslipReviewCheck[],
): PayslipReviewSummary {
  const unavailable = checks.filter((check) => check.found === undefined);
  const verified = checks.filter((check) => check.found !== undefined);
  const issues = verified.filter(
    (check) =>
      Math.abs((check.found as number) - check.expected) >=
      (check.tolerance ?? 0.05),
  );

  if (!verified.length) {
    return {
      verdict: "Comparaison impossible",
      tone: "unknown",
      issues,
      verified,
      unavailable,
    };
  }
  if (!issues.length) {
    return {
      verdict: "Tout semble correct",
      tone: "ok",
      issues,
      verified,
      unavailable,
    };
  }
  return {
    verdict: `${issues.length} point${issues.length > 1 ? "s" : ""} à vérifier`,
    tone: "warning",
    issues,
    verified,
    unavailable,
  };
}
