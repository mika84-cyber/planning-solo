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
