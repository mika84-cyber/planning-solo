/**
 * La lecture d'une photo de bulletin, à partir de ses fragments placés :
 * les rubriques (remises en lignes), les cases du pied de page (retrouvées
 * par leur place sous leur libellé), le statut et le temps de travail de
 * l'en-tête, puis la preuve par le calcul.
 *
 * Tout est calcul : aucun accès au navigateur, et rien n'est conservé.
 */
import type { PayslipReading } from "./payslip";
import { readPayslipOcrText } from "./payslipOcrText";
import { photoRows, type PhotoLayout, type PhotoRow } from "./payslipPhotoLayout";
import {
  blendPayslipRows,
  canonicalPayslipLine,
  isSureDeduction,
  provePayslip,
  readPayslipRows,
  repairEarningLines,
  type PayslipProof,
  type PayslipRowsReading,
} from "./payslipRows";

type Box = { x0: number; x1: number; y0: number; y1: number; height: number };
type AmountWord = Box & { value: number };

const plain = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Un montant seul dans son fragment : « 2050.89 », « 553,34 ». */
function amountOf(text: string): number | undefined {
  const match = /^[^\d]{0,2}(\d{1,7})[.,](\d{2})[^\d]{0,2}$/.exec(text.trim());
  return match ? Number(`${match[1]}.${match[2]}`) : undefined;
}

/** Tous les montants de la page, chacun avec sa boîte. Un fragment peut en
 *  porter plusieurs : on revient alors à ses mots. */
function amountWords(layout: PhotoLayout): AmountWord[] {
  return layout.fragments.flatMap((fragment) =>
    fragment.words.flatMap((word) => {
      const value = amountOf(word.text);
      return value === undefined ? [] : [{ value, x0: word.x0, x1: word.x1, y0: word.y0, y1: word.y1, height: word.y1 - word.y0 }];
    }));
}

const boxOf = (words: Array<{ x0: number; x1: number; y0: number; y1: number }>): Box => ({
  x0: Math.min(...words.map((word) => word.x0)),
  x1: Math.max(...words.map((word) => word.x1)),
  y0: Math.min(...words.map((word) => word.y0)),
  y1: Math.max(...words.map((word) => word.y1)),
  height: Math.max(...words.map((word) => word.y1 - word.y0)),
});

/** Le libellé cherché, où qu'il soit sur la page : la plus courte suite de
 *  mots voisins d'une même ligne dont le texte le contient. Sa boîte est
 *  celle de ces mots seuls, même quand le fragment en porte d'autres (deux
 *  cases voisines lues d'un trait). `notBefore` écarte « NET A PAYER »
 *  quand « AVANT IMPOT » le suit. */
function findLabel(rows: PhotoRow[], pattern: RegExp, notBefore?: RegExp): Box | null {
  let best: { box: Box; count: number } | null = null;
  for (const row of rows) {
    const words = row.pieces.flatMap((piece) => piece.words);
    for (let from = 0; from < words.length; from++) {
      for (let to = from; to < Math.min(words.length, from + 6); to++) {
        const span = words.slice(from, to + 1);
        if (!pattern.test(plain(span.map((word) => word.text).join(" ")))) continue;
        const count = to - from + 1;
        const followed = notBefore && notBefore.test(plain(words[to + 1]?.text || ""));
        if (!followed && (!best || count < best.count)) best = { box: boxOf(span), count };
        break;
      }
    }
  }
  return best?.box ?? null;
}

/** Le montant écrit dans la case d'un libellé : le premier sous lui. Dans
 *  une case étroite (« Net imposable »), il reste sous son libellé ; dans la
 *  case du net, cadré à droite, il le dépasse (`reach`, en largeurs). */
function amountBelow(label: Box, amounts: AmountWord[], lines = 4.5, reach = 1): number | undefined {
  const width = label.x1 - label.x0;
  const candidates = amounts
    .filter((amount) => {
      const centreX = (amount.x0 + amount.x1) / 2;
      const centreY = (amount.y0 + amount.y1) / 2;
      return centreY > label.y1 - label.height * 0.2 && centreY < label.y1 + label.height * lines
        && centreX > label.x0 - width * 0.25 && centreX < label.x1 + width * reach;
    })
    .sort((a, b) => a.y0 - b.y0);
  return candidates[0]?.value;
}

/** Le pied de page : net avant impôt, net à payer, net imposable et les
 *  totaux « A payer » / « A déduire », dont la différence est le net. */
function readFooter(rows: PhotoRow[], amounts: AmountWord[]) {
  const beforeTaxLabel = findLabel(rows, /NET [AÀ] PAYER AVANT IMP|NET AVANT IMP/);
  const paidLabel = findLabel(rows, /^NET [AÀ] PAYER$/, /^AVANT/);
  const taxableLabel = findLabel(rows, /NET IMPOSABLE/, /CUMUL/);
  const netBeforeTax = beforeTaxLabel ? amountBelow(beforeTaxLabel, amounts) : undefined;
  const netPaid = paidLabel ? amountBelow(paidLabel, amounts) : undefined;
  const taxableNet = taxableLabel ? amountBelow(taxableLabel, amounts, 3.5, 0.3) : undefined;
  // Les totaux, au-dessus de la case du net : « à payer » moins « à
  // déduire » donne le net avant impôt, au centime.
  let totals: { earnings: number; deductions: number } | undefined;
  const net = netBeforeTax ?? netPaid;
  if (net !== undefined) {
    const anchorTop = beforeTaxLabel?.y0 ?? paidLabel?.y0 ?? Infinity;
    const reach = (beforeTaxLabel ?? paidLabel)!.height * 9;
    const above = amounts.filter((amount) => amount.y1 < anchorTop + 4 && amount.y0 > anchorTop - reach);
    for (const earnings of above) {
      const deductions = above.find((amount) => amount !== earnings && Math.abs(earnings.value - amount.value - net) <= 0.011);
      if (deductions) {
        totals = { earnings: earnings.value, deductions: deductions.value };
        break;
      }
    }
  }
  return { netBeforeTax, netPaid, taxableNet, totals };
}

/** Le temps de travail qu'un taux payé désigne : un 80 % est payé 6/7, un
 *  90 % 32/35 ; les autres quotités sont payées à leur proportion. */
export function workTimeFromPaidRate(rate: number): number | undefined {
  if (Math.abs(rate - 6 / 7) < 0.0006) return 80;
  if (Math.abs(rate - 32 / 35) < 0.0006) return 90;
  const percent = Math.round(rate * 100);
  return Math.abs(rate * 100 - percent) < 0.06 && percent >= 10 && percent <= 100 ? percent : undefined;
}

/** L'en-tête : le statut (« CDI », « Fonctionnaire Titulaire ») et, sur la
 *  même ligne, le temps de travail puis le nombre d'heures. */
function readHeader(lines: string[]) {
  for (const line of lines) {
    const text = plain(line);
    const contract = /(^|[^A-Z])(CDI|CDD|CONTRACTUEL)(?![A-Z])/.exec(text);
    const civil = /TITULAIRE|FONCTIONNAIRE|STAGIAIRE/.exec(text);
    if (!contract && !civil) continue;
    const after = text.slice((contract ?? civil)!.index);
    const numbers = [...after.matchAll(/(?<![\d.,])(\d{2,3})[.,](\d{2})(?![\d.,])/g)].map((match) => Number(`${match[1]}.${match[2]}`));
    const time = numbers.find((value) => value >= 10 && value <= 100);
    const hours = numbers.find((value) => value !== time && value > 15 && value <= 160);
    // 151,67 heures pour un temps plein : les heures confirment la quotité.
    const confirmed = time !== undefined && hours !== undefined && Math.abs(hours / 151.67 - time / 100) < 0.02;
    return {
      status: contract ? "contractuel" as const : "fonctionnaire" as const,
      // Un « 80.00 » lu « 60.00 » changerait la quotité : sans les heures
      // pour le confirmer, le taux payé du traitement le dira.
      workTime: confirmed ? time : undefined,
    };
  }
  return {};
}

/**
 * Ce qu'une lecture ne peut pas valoir : une indemnité de résidence au
 * niveau du traitement, des centaines de dimanches, un net plus gros que le
 * brut. Une valeur impossible est retirée plutôt que proposée.
 */
export function withoutImpossibleValues(reading: PayslipReading): PayslipReading {
  const next = { ...reading };
  const { baseSalary, gross } = next;
  if (baseSalary !== undefined && gross !== undefined && baseSalary > gross * 1.02) next.baseSalary = undefined;
  if (next.residenceAllowance !== undefined && next.baseSalary !== undefined && next.residenceAllowance > next.baseSalary * 0.12) {
    // Résidence et éléments fixes vont ensemble : la somme est fausse aussi.
    next.residenceAllowance = undefined;
    next.otherFixed = undefined;
  }
  if (next.otherFixed !== undefined && gross !== undefined && Math.abs(next.otherFixed) > gross * 0.6) next.otherFixed = undefined;
  if (next.sundaysBeyondTen > 31) next.sundaysBeyondTen = 0;
  if (next.navigo !== undefined && (next.navigo <= 0 || next.navigo > 400)) next.navigo = undefined;
  if (next.mealVoucherDeduction !== undefined && next.mealVoucherDeduction > 400) next.mealVoucherDeduction = undefined;
  if (next.netBeforeTax !== undefined && gross !== undefined && (next.netBeforeTax > gross * 1.15 || next.netBeforeTax < gross * 0.4)) next.netBeforeTax = undefined;
  if (next.netBeforeTax !== undefined && next.netBeforeTax < 50) next.netBeforeTax = undefined;
  return next;
}

/**
 * Met la dernière main à une lecture, page seule ou pages réunies : écarte
 * l'impossible, puis fait la preuve par le calcul. Prouvé, le total des
 * cotisations rend au bulletin un net que la photo n'aurait pas montré.
 */
export function finishPayslipReading(reading: PayslipReading): PayslipReading {
  const next = withoutImpossibleValues(reading);
  if (!next.rows) return next;
  // Le taux payé du traitement, prouvé par le calcul, dit la quotité mieux
  // que la case de l'en-tête.
  const paidTime = next.rows.paidRate !== undefined ? workTimeFromPaidRate(next.rows.paidRate) : undefined;
  if (paidTime !== undefined) next.workTime = paidTime;
  if (next.status === undefined && next.rows.status) next.status = next.rows.status;
  // Le net imposable se lit aussi sur la ligne de l'impôt.
  if (next.taxableNet === undefined && next.rows.taxableNet !== undefined) next.taxableNet = next.rows.taxableNet;
  // Le net, s'il n'a pas été lu dans sa case : total à payer moins total à
  // déduire, quand le pied de page les montre.
  if (next.netBeforeTax === undefined && next.totalEarnings !== undefined && next.totalDeductions !== undefined)
    next.netBeforeTax = round2(next.totalEarnings - next.totalDeductions);
  // Les rubriques de la page, puis celles d'une seconde lecture gardée en
  // réserve, puis le mélange des deux : la première série qui se prouve.
  const candidates = [next.rows, ...(next.otherRows ? [blendPayslipRows(next.rows, next.otherRows), next.otherRows] : [])]
    .filter((item): item is PayslipRowsReading => item !== null);
  let rows = candidates[0];
  let proof: PayslipProof = { repaired: [] };
  for (const [index, candidate] of candidates.entries()) {
    const copy = { ...candidate, deductions: candidate.deductions.map((item) => ({ ...item })) };
    const attempt = provePayslip({
      gross: next.gross,
      netBeforeTax: next.netBeforeTax,
      rows: copy,
      totalEarnings: next.totalEarnings,
      totalDeductions: next.totalDeductions,
    });
    if (index === 0 || attempt.net === true) {
      rows = copy;
      proof = attempt;
    }
    if (attempt.net === true) break;
  }
  next.rows = rows;
  next.proof = { ...proof, repaired: [...(rows.repairedEarnings || []), ...proof.repaired] };
  // Les cotisations prouvées par le total écrit au pied du bulletin : le
  // net avant impôt en découle, même si sa case n'a pas été lue.
  if (proof.net && next.netBeforeTax === undefined && next.gross !== undefined && proof.deductionsTotal !== undefined)
    next.netBeforeTax = round2(next.gross + rows.reimbursements - rows.mealVouchers - proof.deductionsTotal);
  return next;
}

/**
 * Le brut se lit de trois façons : sur la ligne « CUMUL BRUT », par la
 * somme des lignes de rémunération, et comme base des cotisations de
 * vieillesse. Quand la ligne du cumul est mal lue, deux des trois qui
 * s'accordent font foi ; sinon le brut lu reste tel quel.
 */
function settledGross(read: number | undefined, rubrics: PayslipRowsReading): number | undefined {
  const sum = rubrics.earnings.length && rubrics.earnings.every((row) => row.numbers.length)
    ? round2(rubrics.earnings.reduce((total, row) => total + row.numbers[row.numbers.length - 1], 0))
    : undefined;
  const bases = rubrics.deductions.filter((item) => /VIEILLESSE|IRCANTEC|PENSION CIVILE/.test(plain(item.label)) && item.base !== undefined).map((item) => item.base as number);
  const base = bases.length >= 2 && bases.every((value) => value === bases[0]) ? bases[0] : undefined;
  if (sum !== undefined && base !== undefined && Math.abs(sum - base) <= 0.011) return base;
  return read;
}

/** La lecture d'une page est-elle sûre ? Sinon, la photo mérite d'être
 *  préparée autrement et relue. Page des rubriques : le brut est la somme
 *  des lignes et chaque cotisation se recoupe. Page du net : ses totaux
 *  donnent le net. */
export function isSurePageReading(reading: PayslipReading) {
  if (reading.rows) return reading.proof?.gross === true && reading.rows.deductionsComplete && reading.rows.deductions.every(isSureDeduction);
  return reading.proof?.totals === true || (reading.netBeforeTax !== undefined && reading.totalEarnings !== undefined);
}

/** Ce que vaut une lecture, pour choisir entre deux lectures d'une page. */
function readingScore(reading: PayslipReading) {
  const fields = [reading.month, reading.gross, reading.netBeforeTax, reading.baseSalary, reading.netPaid, reading.taxableNet,
    reading.residenceAllowance, reading.navigo, reading.mealVoucherDeduction, reading.sundayFlat, reading.status, reading.workTime];
  return (reading.proof?.gross === true ? 20 : 0)
    + (reading.proof?.totals === true ? 20 : 0)
    + fields.filter((value) => value !== undefined).length * 2
    + (reading.rows?.deductionsComplete ? 3 : 0)
    + (reading.rows?.deductions.reduce((sum, item) => sum + (isSureDeduction(item) ? 1 : -1), 0) ?? 0);
}

/**
 * Deux lectures de la même page : la plus sûre est gardée, complétée par
 * ce que seule l'autre a vu (statut, temps de travail, net imposable…), et
 * les rubriques de l'autre restent en réserve pour la preuve.
 */
export function betterPageReading(first: PayslipReading, second: PayslipReading): PayslipReading {
  const [best, other] = readingScore(second) > readingScore(first) ? [second, first] : [first, second];
  const next = { ...best };
  for (const key of ["month", "year", "status", "workTime", "taxableNet", "netPaid"] as const)
    if (next[key] === undefined && other[key] !== undefined) Object.assign(next, { [key]: other[key] });
  if (next.totalEarnings === undefined && other.totalEarnings !== undefined && other.proof?.totals === true) {
    next.totalEarnings = other.totalEarnings;
    next.totalDeductions = other.totalDeductions;
  }
  if (best.rows && other.rows) next.otherRows = other.rows;
  return finishPayslipReading(next);
}

/** La lecture complète d'une page photographiée. */
export function readPayslipPhotoLayout(layout: PhotoLayout): PayslipReading {
  const rows = photoRows(layout);
  // Les lignes remises au propre, puis celles de rémunération corrigées par
  // le calcul quand leur somme ne donne pas le brut.
  const repair = repairEarningLines(rows.map((row) => canonicalPayslipLine(row.text)));
  const lines = repair.lines;
  const reading = readPayslipOcrText(lines.join("\n"));
  const rubrics = readPayslipRows(lines);
  if (repair.repaired.length) rubrics.repairedEarnings = repair.repaired;
  reading.gross = settledGross(reading.gross, rubrics);
  const footer = readFooter(rows, amountWords(layout));
  const header = readHeader(lines);
  const workTime = header.workTime ?? (rubrics.paidRate !== undefined ? workTimeFromPaidRate(rubrics.paidRate) : undefined);
  const status = rubrics.status ?? header.status;
  return finishPayslipReading({
    ...reading,
    // La case du net, trouvée à sa place, vaut mieux que le texte lu en ligne.
    netBeforeTax: footer.netBeforeTax ?? reading.netBeforeTax,
    ...(footer.netPaid !== undefined ? { netPaid: footer.netPaid } : {}),
    ...(footer.taxableNet !== undefined ? { taxableNet: footer.taxableNet } : {}),
    ...(footer.totals ? { totalEarnings: footer.totals.earnings, totalDeductions: footer.totals.deductions } : {}),
    ...(status ? { status } : {}),
    ...(workTime !== undefined ? { workTime } : {}),
    ...(rubrics.hasGross ? { rows: rubrics } : {}),
  });
}
