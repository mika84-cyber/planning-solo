export type PayslipReviewCheck = {
  key: string;
  label: string;
  found: number | undefined;
  expected: number;
  tolerance?: number;
};

export type PayslipReviewSummary = {
  verdict: string;
  tone: "ok" | "partial" | "warning" | "unknown";
  issues: PayslipReviewCheck[];
  verified: PayslipReviewCheck[];
  unavailable: PayslipReviewCheck[];
};

const PAYSLIP_GAP_EXPLANATIONS: Record<string, string> = {
  gross: "Le brut peut varier si une prime, une retenue ou un rappel n’a pas encore été renseigné dans l’application.",
  "net-before-tax": "Vérifiez les cotisations, les titres-repas et les remboursements : ils peuvent modifier le net sans modifier le traitement de base.",
  base: "Vérifiez l’indice, le temps de travail et la date d’effet d’un changement de situation.",
  residence: "Le taux d’indemnité de résidence ou sa base de calcul peut avoir changé.",
  ifse: "Vérifiez le montant IFSE enregistré dans le profil de paie et la présence d’un rappel sur le bulletin.",
  "other-fixed": "Une indemnité fixe peut manquer dans le profil ou avoir été regroupée sous un autre libellé sur le bulletin.",
  cia: "Le CIA est ponctuel : vérifiez le mois de versement et le montant enregistré.",
  navigo: "Le remboursement dépend du justificatif, du montant de l’abonnement et d’une éventuelle régularisation.",
  "meal-vouchers": "Le nombre de titres-repas réellement prélevés peut différer selon les absences et le calendrier de traitement.",
  "pas-rate": "Le taux de prélèvement à la source appliqué par l’employeur peut avoir été actualisé par l’administration fiscale.",
  sundays: "Un dimanche peut être payé le mois suivant en raison du délai de traitement.",
  carence: "Un jour de carence apparaît sur le bulletin alors qu’aucun arrêt maladie correspondant n’est enregistré dans l’application.",
};

export function explainPayslipGap(check: PayslipReviewCheck) {
  return PAYSLIP_GAP_EXPLANATIONS[check.key] ||
    "Vérifiez la ligne correspondante sur le bulletin et la valeur enregistrée dans votre profil de paie.";
}

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
    if (unavailable.length) {
      return {
        verdict: "Vérification partielle — aucun écart sur les lignes vérifiées",
        tone: "partial",
        issues,
        verified,
        unavailable,
      };
    }
    return {
      verdict: "Comparaison complète — aucun écart",
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
