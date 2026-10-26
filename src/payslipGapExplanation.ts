/** D'où vient l'écart entre le bulletin et l'estimation, pas à pas.
 *
 *  Les lignes qui diffèrent sont des causes, chiffrées sur le brut ; viennent
 *  ensuite ce qui en découle — les cotisations prélevées sur ce brut, puis
 *  l'impôt — jusqu'au net versé. La somme des lignes est l'écart du net, au
 *  centime : ce que les lignes connues n'expliquent pas devient une ligne
 *  « inexpliquée », jamais un écart passé sous silence. */
import { euros } from "./appModel";
import { estimatedIncomeTax } from "./payEstimate";
import { describePayslipGap, type PayslipReviewCheck } from "./payslipReview";
import type { PayslipGapFigures, PayslipGapRecord } from "./payslipVerificationRecords";
import { SUNDAY_ALLOWANCE, sundayCountLabel } from "./planningLogic";

export type PayslipGapLine = {
  key: string;
  /** La cause, ou ce qui en découle, en quelques mots. */
  title: string;
  detail: string;
  /** L'effet sur le net versé — sur le brut tant que le net n'est pas lu. */
  amount: number;
  /** Une ligne du bulletin qui diffère, ce qui en découle, ou un reste que
   *  rien n'explique. */
  kind: "cause" | "follow" | "unknown";
  /** Le contrôle en cause, pour proposer le geste qui va avec. */
  check?: PayslipReviewCheck;
  /** Ce que l'application en a déjà fait à la lecture du bulletin :
   *  « enregistré dans votre profil », « reporté sur décembre 2026 ». */
  applied?: string;
  /** Le texte qui fonde la somme due, cité dans le courrier. */
  reference?: string;
};

/** L'estimation d'un mois telle qu'elle était avant la lecture de son
 *  bulletin : la lecture met le profil à jour, et l'écart s'expliquerait
 *  sinon contre une estimation qui a déjà suivi le bulletin. */
export type PayEstimateSnapshot = {
  year: number;
  month: number;
  gross: number;
  netBeforeTax?: number;
  incomeTax?: number;
  /** Ce que l'estimation attendait, ligne par ligne, sous la clé du contrôle. */
  expected: Record<string, number>;
  netRatioFixed: number;
  netRatioVariable: number;
};


export type PayslipGapExplanation = {
  /** « net » quand le bulletin et l'estimation donnent un net avant impôt. */
  level: "net" | "gross";
  expected: PayslipGapFigures;
  actual: PayslipGapFigures;
  /** Payé moins prévu, sur le net — sur le brut au niveau « gross ». */
  gap: number;
  lines: PayslipGapLine[];
  /** La part de l'écart qu'aucune ligne n'explique. */
  unexplained: number;
  /** Aucune ligne ne diffère et l'écart n'est qu'un arrondi : le bulletin
   *  correspond à l'estimation. */
  matches: boolean;
};

export type PayslipGapInput = {
  checks: PayslipReviewCheck[];
  expected: { gross: number; netBeforeTax?: number; incomeTax?: number };
  actual: { gross?: number; netBeforeTax?: number; incomeTax?: number };
  /** Les parts du brut gardées en net, en %, comme l'estimation. */
  netRatioFixed: number;
  netRatioVariable: number;
  /** Les rappels et lignes ponctuelles lus sur le bulletin, absents de
   *  l'estimation : une cause connue, pas un écart inexpliqué. */
  oneOff?: { amount: number; labels: string[] };
  /** Les causes déjà prises en compte, et comment, sous la clé du contrôle
   *  ou de la ligne. Une cause prise en compte n'est plus inexpliquée. */
  applied?: Record<string, string>;
  /** Le détail d'une ligne, quand l'écran en sait plus (majoration de nuit
   *  des mécénats non payée), et le texte qui fonde la somme due. */
  details?: Record<string, string>;
  references?: Record<string, string>;
  /** L'impôt comme l'estimation le calcule : taux, facteur du net imposable,
   *  et heures sup et mécénats payés, exonérés. */
  taxBase?: { pasRate: number; adjustment: number; exemptActual: number };
};

/** En deçà, un écart n'est qu'un arrondi. */
export const PAYSLIP_GAP_TOLERANCE = 0.5;

const cents = (value: number) => Math.round(value * 100) / 100;

/** Les lignes du brut, et leur part : le traitement et les indemnités fixes
 *  gardent un autre taux de cotisations que les primes. */
const GROSS_PARTS: Record<string, "fixed" | "variable"> = {
  base: "fixed",
  residence: "fixed",
  ifse: "fixed",
  "other-fixed": "fixed",
  status: "fixed",
  carence: "fixed",
  cia: "variable",
  overtime: "variable",
  mecenat: "variable",
  "one-off": "variable",
  "sunday-flat": "variable",
  holidays: "variable",
  sundays: "variable",
};

const isIssue = (check: PayslipReviewCheck) =>
  check.found !== undefined && Math.abs(check.found - check.expected) >= (check.tolerance ?? 0.05);

function grossCause(check: PayslipReviewCheck, residenceGap: number): PayslipGapLine | null {
  const found = check.found as number;
  const difference = found - check.expected;
  if (check.key === "sundays") {
    const count = Math.round(difference * 2) / 2;
    const several = (value: number) => (value >= 2 ? "s" : "");
    return {
      key: check.key,
      title: describePayslipGap(check),
      detail: `${sundayCountLabel(found)} payé${several(found)} sur le bulletin, ${sundayCountLabel(check.expected)} attendu${several(check.expected)}`,
      amount: cents(count * SUNDAY_ALLOWANCE.perSunday),
      kind: "cause",
      check,
    };
  }
  if (check.key === "carence") {
    return { key: check.key, title: describePayslipGap(check), detail: "retenue sur le brut", amount: -cents(found), kind: "cause", check };
  }
  if (check.key === "status") {
    return { key: check.key, title: describePayslipGap(check), detail: "Un contractuel n’en perçoit pas : votre statut est sans doute « Fonctionnaire ».", amount: cents(found), kind: "cause", check };
  }
  // Les autres éléments fixes du bulletin comprennent l'indemnité de
  // résidence, déjà comptée sur sa propre ligne.
  const amount = cents(check.key === "other-fixed" ? difference - residenceGap : difference);
  if (Math.abs(amount) < 0.01) return null;
  return {
    key: check.key,
    title: describePayslipGap(check),
    detail: `${euros(found)} sur le bulletin, ${euros(check.expected)} prévus`,
    amount,
    kind: "cause",
    check,
  };
}

/** Ce que les cotisations prélèvent : « ce demi-dimanche », « cet écart ». */
function contributionSubject(causes: PayslipGapLine[]) {
  const sundays = causes.length === 1 && causes[0].check?.key === "sundays" ? causes[0].check : undefined;
  if (!sundays || sundays.found === undefined) return "cet écart de brut";
  const count = Math.abs(Math.round((sundays.found - sundays.expected) * 2) / 2);
  return count === 0.5 ? "ce demi-dimanche" : count === 1 ? "ce dimanche" : `ces ${sundayCountLabel(count)} dimanches`;
}

export function explainPayslipGapChain(input: PayslipGapInput): PayslipGapExplanation | null {
  const { checks, expected, actual } = input;
  if (actual.gross === undefined) return null;
  const finish = (line: PayslipGapLine): PayslipGapLine => {
    const key = line.check?.key ?? line.key;
    const applied = input.applied?.[key];
    const detail = input.details?.[key];
    const reference = input.references?.[key];
    return {
      ...line,
      ...(detail ? { detail } : {}),
      ...(reference ? { reference } : {}),
      ...(applied ? { applied, kind: line.kind === "unknown" ? "cause" : line.kind } : {}),
    };
  };
  const issues = checks.filter(isIssue);
  const byKey = new Map(checks.map((check) => [check.key, check]));
  const residence = byKey.get("residence");
  const residenceGap = residence?.found !== undefined ? residence.found - residence.expected : 0;

  const oneOff = input.oneOff && Math.abs(input.oneOff.amount) >= 0.01 ? input.oneOff : undefined;
  const causes = [
    ...issues
      .filter((check) => GROSS_PARTS[check.key])
      .map((check) => grossCause(check, residenceGap))
      .filter((line): line is PayslipGapLine => Boolean(line)),
    ...(oneOff
      ? [{
          key: "one-off",
          title: oneOff.amount < 0 ? "Retenue ponctuelle" : "Rappel ou ligne ponctuelle",
          detail: oneOff.labels.join(" · ") || "ligne du bulletin, pour ce mois seulement",
          amount: cents(oneOff.amount),
          kind: "cause" as const,
          check: { key: "one-off", label: "Ligne ponctuelle", found: cents(oneOff.amount), expected: 0 },
        }]
      : []),
  ];
  const grossGap = cents(actual.gross - expected.gross);
  const residual = cents(grossGap - causes.reduce((sum, line) => sum + line.amount, 0));
  const unexplainedOnGross = Math.abs(residual) >= PAYSLIP_GAP_TOLERANCE;
  const grossLines: PayslipGapLine[] = [
    ...causes,
    ...(unexplainedOnGross
      ? [{
          key: "gross-other",
          title: residual < 0 ? "Brut plus bas, sans ligne en cause" : "Brut plus élevé, sans ligne en cause",
          detail: "Une prime, une retenue ou un rappel que l’application ne connaît pas : à chercher sur le bulletin.",
          amount: residual,
          kind: "unknown" as const,
          check: byKey.get("gross"),
        }]
      : []),
  ];

  if (actual.netBeforeTax === undefined || expected.netBeforeTax === undefined) {
    return {
      level: "gross",
      expected: { gross: expected.gross },
      actual: { gross: actual.gross },
      gap: grossGap,
      lines: grossLines.map(finish),
      unexplained: unexplainedOnGross ? residual : 0,
      matches: !grossLines.length && Math.abs(grossGap) < PAYSLIP_GAP_TOLERANCE,
    };
  }

  // Ce qui touche le net sans passer par le brut.
  const netCauses: PayslipGapLine[] = issues
    .filter((check) => check.key === "meal-vouchers" || check.key === "navigo")
    .map((check) => {
      const difference = (check.found as number) - check.expected;
      return {
        key: check.key,
        title: describePayslipGap(check),
        detail: `${euros(check.found as number)} sur le bulletin, ${euros(check.expected)} prévus`,
        amount: cents(check.key === "meal-vouchers" ? -difference : difference),
        kind: "cause" as const,
        check,
      };
    });

  const grossTotal = grossLines.reduce((sum, line) => sum + line.amount, 0);
  const netCauseTotal = netCauses.reduce((sum, line) => sum + line.amount, 0);
  const contributions = cents(actual.netBeforeTax - expected.netBeforeTax - grossTotal - netCauseTotal);
  const keptShare = (line: PayslipGapLine) =>
    (GROSS_PARTS[line.check?.key ?? ""] === "fixed" ? input.netRatioFixed : input.netRatioVariable) / 100;
  const predicted = cents(-grossLines.reduce((sum, line) => sum + line.amount * (1 - keptShare(line)), 0));
  const contributionLines: PayslipGapLine[] = [];
  const subject = contributionSubject(causes);
  const followLine = (amount: number): PayslipGapLine => ({
    key: "contributions",
    title: amount > 0 ? "Moins de cotisations" : "Plus de cotisations",
    detail: `prélevées sur ${subject}`,
    amount,
    kind: "follow",
  });
  if (grossLines.length && Math.abs(contributions - predicted) < PAYSLIP_GAP_TOLERANCE) {
    if (Math.abs(contributions) >= 0.01) contributionLines.push(followLine(contributions));
  } else {
    if (grossLines.length && Math.abs(predicted) >= 0.01) contributionLines.push(followLine(predicted));
    const rest = cents(contributions - (grossLines.length ? predicted : 0));
    if (Math.abs(rest) >= 0.01) {
      contributionLines.push({
        key: "contributions-other",
        title: rest > 0 ? "Cotisations plus basses que prévu" : "Cotisations plus élevées que prévu",
        detail: "Un taux de cotisation a pu changer : comparez le total des cotisations du bulletin.",
        amount: rest,
        kind: Math.abs(rest) < PAYSLIP_GAP_TOLERANCE ? "follow" : "unknown",
      });
    }
  }

  // L'impôt : prélevé sur le net imposable, au taux du bulletin ; les heures
  // sup et les mécénats, exonérés, n'y entrent pas.
  const expectedTax = expected.incomeTax ?? 0;
  const rateCheck = byKey.get("pas-rate");
  const rateChanged = rateCheck ? isIssue(rateCheck) : false;
  const effectiveRate = expected.netBeforeTax ? expectedTax / expected.netBeforeTax : 0;
  const rateRatio = rateChanged && rateCheck?.expected ? (rateCheck.found as number) / rateCheck.expected : 1;
  const { taxBase } = input;
  const paidRate = rateCheck?.found ?? taxBase?.pasRate;
  const modelTax = taxBase && paidRate !== undefined
    ? estimatedIncomeTax(actual.netBeforeTax, paidRate, taxBase.adjustment, taxBase.exemptActual)
    : undefined;
  const actualTax = actual.incomeTax ?? modelTax ?? cents(actual.netBeforeTax * effectiveRate * rateRatio);
  const taxEffect = cents(expectedTax - actualTax);
  const predictedTax = modelTax !== undefined
    ? cents(expectedTax - modelTax)
    : cents((expected.netBeforeTax - actual.netBeforeTax) * effectiveRate * rateRatio + expectedTax * (1 - rateRatio));
  // Le net imposable n'est qu'approché : quelques pour cent de l'impôt près.
  const taxTolerance = Math.max(PAYSLIP_GAP_TOLERANCE, actualTax * 0.02);
  const exemptNote = taxBase && taxBase.exemptActual > 0 ? " ; heures sup et mécénats exonérés" : "";
  const rate = (rateCheck?.found ?? rateCheck?.expected ?? effectiveRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const taxLines: PayslipGapLine[] = [];
  if (rateChanged && rateCheck) {
    taxLines.push({
      key: "pas-rate",
      title: describePayslipGap(rateCheck),
      detail: `${euros(actualTax)} d’impôt prélevé, ${euros(expectedTax)} prévus`,
      amount: taxEffect,
      kind: "cause",
      check: rateCheck,
    });
  } else if (Math.abs(taxEffect - predictedTax) < taxTolerance) {
    if (Math.abs(taxEffect) >= 0.01) {
      taxLines.push({
        key: "income-tax",
        title: taxEffect > 0 ? "Moins d’impôt" : "Plus d’impôt",
        detail: `${rate} % sur ce qui reste${exemptNote}`,
        amount: taxEffect,
        kind: "follow",
      });
    }
  } else {
    taxLines.push({
      key: "income-tax",
      title: taxEffect > 0 ? "Impôt plus bas que prévu" : "Impôt plus élevé que prévu",
      detail: `${euros(actualTax)} prélevés, ${euros(expectedTax)} prévus : le taux ou son assiette a pu changer.`,
      amount: taxEffect,
      kind: "unknown",
    });
  }

  const expectedNet = cents(expected.netBeforeTax - expectedTax);
  const actualNet = cents(actual.netBeforeTax - actualTax);
  // Sans cause, quelques centimes de cotisations ou d'impôt ne sont qu'un
  // arrondi : rien à expliquer.
  const allLines = [...grossLines, ...contributionLines, ...netCauses, ...taxLines];
  const matches = allLines.every((line) => line.kind === "follow") && Math.abs(actualNet - expectedNet) < PAYSLIP_GAP_TOLERANCE;
  const lines = matches ? [] : allLines.map(finish);
  return {
    level: "net",
    expected: { gross: expected.gross, netBeforeTax: expected.netBeforeTax, incomeTax: expectedTax, net: expectedNet },
    actual: { gross: actual.gross, netBeforeTax: actual.netBeforeTax, incomeTax: actualTax, net: actualNet },
    gap: cents(actualNet - expectedNet),
    lines,
    unexplained: cents(lines.filter((line) => line.kind === "unknown").reduce((sum, line) => sum + line.amount, 0)),
    matches,
  };
}

/** Le titre du résultat : ce que la personne a en moins, ou en plus. */
export function payslipGapHeadline(explanation: PayslipGapExplanation) {
  const on = explanation.level === "net" ? "votre net" : "votre brut";
  if (explanation.matches) {
    return Math.abs(explanation.gap) < 0.01
      ? "Le bulletin correspond à l’estimation"
      : `Le bulletin correspond à l’estimation, à ${euros(Math.abs(explanation.gap))} près`;
  }
  if (Math.abs(explanation.gap) < 0.01) return `Les écarts se compensent sur ${on}`;
  return explanation.gap < 0
    ? `Il manque ${euros(-explanation.gap)} sur ${on}`
    : `${euros(explanation.gap)} de plus que prévu sur ${on}`;
}

/** L'écart est-il entièrement expliqué par des lignes connues ? */
export function isPayslipGapExplained(explanation: PayslipGapExplanation) {
  return Math.abs(explanation.unexplained) < PAYSLIP_GAP_TOLERANCE;
}

/** Ce que la décision garde de l'explication : les lignes, sans le contrôle
 *  qui les a produites, mais avec ce qu'il comparait. */
export function payslipGapRecord(explanation: PayslipGapExplanation): PayslipGapRecord {
  return {
    level: explanation.level,
    expected: explanation.expected,
    actual: explanation.actual,
    gap: explanation.gap,
    lines: explanation.lines.map(({ check, ...line }) => ({
      ...line,
      ...(check?.found === undefined ? {} : { found: check.found, expected: check.expected }),
    })),
  };
}
