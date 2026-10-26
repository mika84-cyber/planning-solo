/** Un mois dont l'écart avec le bulletin a été accepté prend les montants du
 *  bulletin : chaque ligne en cause reprend ce que le bulletin porte, une
 *  ligne qu'il porte seul s'ajoute, et le brut, le net avant impôt, l'impôt
 *  et le net versé sont les siens. Les montants sont absolus : la lecture du
 *  bulletin a pu mettre le profil à jour, rien ne se compte deux fois. */
import type { PayDashboardVariable } from "./PayDashboard";
import type { PayCalculationBreakdown } from "./PayEstimateDetails";
import type { PayslipGapRecord, PayslipGapRecordLine } from "./payslipVerificationRecords";
import { SUNDAY_ALLOWANCE, sundayCountLabel } from "./planningLogic";

const cents = (value: number) => Math.round(value * 100) / 100;

/** Les lignes du brut, sous la clé que leur donne la composition. */
const GROSS_KEYS = new Set(["base", "residence", "ifse", "other-fixed", "cia", "sunday-flat", "sundays", "holidays"]);

/** Une ligne de brut sans place dans la composition (rappel, carence, reste
 *  inexpliqué) : elle s'ajoute, sous son propre nom. */
const EXTRA_GROSS_KEYS = new Set(["one-off", "carence", "status", "gross-other"]);

export type PayMonthFigures = {
  gross: number;
  net: number | null;
  calculation: PayCalculationBreakdown;
  variables: PayDashboardVariable[];
};

/** Le montant que le bulletin porte sur une ligne en cause ; ses autres
 *  éléments fixes comprennent l'indemnité de résidence, qui a sa ligne. */
function paidAmount(line: PayslipGapRecordLine, residence: number | undefined) {
  if (line.found === undefined) return undefined;
  if (line.key === "sundays") return cents(line.found * SUNDAY_ALLOWANCE.perSunday);
  return line.key === "other-fixed" ? cents(line.found - (residence ?? 0)) : line.found;
}

export function correctedPayMonth(figures: PayMonthFigures, gap: PayslipGapRecord): PayMonthFigures {
  const { actual } = gap;
  if (actual.gross === undefined) return figures;
  const byKey = new Map(gap.lines.map((line) => [line.key, line]));
  const sundays = byKey.get("sundays");
  const missing = sundays?.found !== undefined && sundays.expected !== undefined ? sundays.expected - sundays.found : 0;
  const residence = byKey.get("residence")?.found
    ?? figures.calculation.grossComposition.find((row) => row.key === "residence")?.amount
    ?? undefined;
  const correct = <Row extends { key: string; label: string; amount: number | null }>(row: Row): Row => {
    const line = GROSS_KEYS.has(row.key) ? byKey.get(row.key) : undefined;
    const amount = line ? paidAmount(line, residence) : undefined;
    if (!line || amount === undefined) return row;
    return {
      ...row,
      amount,
      ...(row.key === "sundays" && line.found !== undefined ? { label: `Dimanches (${sundayCountLabel(line.found)})` } : {}),
    };
  };
  const extras = gap.lines.filter((line) => EXTRA_GROSS_KEYS.has(line.key));

  const { calculation } = figures;
  const shifted = (value: number | null, shift: number) => (value === null ? null : cents(value + shift));
  const meal = byKey.get("meal-vouchers")?.found ?? calculation.mealVoucherDeduction;
  const navigo = byKey.get("navigo")?.found ?? calculation.navigo;
  const grossShift = actual.gross - figures.gross;
  // Sans net lu sur le bulletin, l'écart du brut descend jusqu'au net avec
  // les taux de l'estimation.
  const netKnown = gap.level === "net" && actual.netBeforeTax !== undefined;
  const keptShift = netKnown ? 0 : grossShift * (calculation.netRatioVariable / 100);
  const taxRate = calculation.netBeforeTax && calculation.incomeTax !== null ? calculation.incomeTax / calculation.netBeforeTax : 0;
  const netBeforeTax = netKnown ? (actual.netBeforeTax as number) : shifted(calculation.netBeforeTax, keptShift);
  const incomeTax = netKnown ? actual.incomeTax ?? calculation.incomeTax : shifted(calculation.incomeTax, keptShift * taxRate);
  const net = netKnown ? actual.net ?? figures.net : shifted(figures.net, keptShift - (incomeTax ?? 0) + (calculation.incomeTax ?? 0));
  // Ce que le brut ne garde pas : brut − net avant impôt − titres repas + Navigo.
  const contributions = netBeforeTax === null ? calculation.estimatedContributions : cents(actual.gross - netBeforeTax - meal + navigo);
  const withheld = (contributionsValue: number | null, mealValue: number, tax: number | null) =>
    (contributionsValue ?? 0) + mealValue + (tax ?? 0);
  const totalDeductions = calculation.totalDeductions === null
    ? null
    : cents(calculation.totalDeductions - withheld(calculation.estimatedContributions, calculation.mealVoucherDeduction, calculation.incomeTax) + withheld(contributions, meal, incomeTax));

  return {
    gross: actual.gross,
    net,
    variables: [
      ...figures.variables.map((row) =>
        row.key === "sundays" && missing > 0
          ? { ...correct(row), quantity: `payés sur le bulletin · ${missing === 0.5 ? "½" : sundayCountLabel(missing)} manquant${missing >= 2 ? "s" : ""}` }
          : correct(row)),
      ...extras.map((line) => ({ key: `payslip-${line.key}`, label: line.title, quantity: line.detail, amount: line.amount })),
    ],
    calculation: {
      ...calculation,
      grossComposition: [
        ...calculation.grossComposition.map(correct),
        ...extras.map((line) => ({ key: `payslip-${line.key}`, label: line.title, detail: line.detail, amount: line.amount })),
      ],
      grossBeforeDeductions: cents(calculation.grossBeforeDeductions + grossShift),
      estimatedContributions: contributions,
      mealVoucherDeduction: meal,
      navigo,
      netBeforeTax,
      incomeTax,
      totalDeductions,
    },
  };
}

/** Ce que la note du net payé rappelle : le montant prévu, et l'écart en
 *  quelques mots, d'après sa première cause. */
export function acceptedGapSummary(gap: PayslipGapRecord) {
  const causes = gap.lines.filter((line) => line.kind !== "follow");
  const first = causes[0]?.title ?? "";
  // « Un demi-dimanche » devient « un demi-dimanche » ; « IFSE » reste tel quel.
  const lowered = /^.[a-zà-ÿ]/.test(first) ? first.charAt(0).toLowerCase() + first.slice(1) : first;
  const others = causes.length - 1;
  return {
    expected: gap.level === "net" ? gap.expected.net : gap.expected.gross,
    gap: gap.gap,
    cause: others > 0 ? `${lowered}, et ${others} autre${others > 1 ? "s" : ""} cause${others > 1 ? "s" : ""}` : lowered,
  };
}
