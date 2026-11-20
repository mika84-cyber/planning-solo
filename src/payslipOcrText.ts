/**
 * Le texte d'une photo de bulletin, lu ligne à ligne : les montants utiles
 * en sont tirés prudemment. Un libellé incertain est ignoré plutôt que
 * transformé en valeur trompeuse.
 *
 * Tout est calcul : aucun accès au navigateur, et rien n'est conservé.
 */
import type { PayslipExtraLine, PayslipReading } from "./payslip";
import { carenceDatesFromLabels, isKnownEarningLabel, isPlausibleSundayRate, withExtraLines } from "./payslip";
import { parsePayslipRow } from "./payslipRows";

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseOcrAmount(value: string) {
  const amount = Number(
    value
      .replace(/[−–—]/g, "-")
      .replace(/[\s\u00a0\u202f]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(amount) ? amount : undefined;
}

function amountsIn(line: string) {
  return [...line.matchAll(/[-−–—]?\d+(?:[\s\u00a0\u202f]\d{3})*[,.]\d{2}/g)]
    .map((match) => parseOcrAmount(match[0]))
    .filter((amount): amount is number => amount !== undefined);
}

/** Le code de rubrique (« 641.28 ») ouvre la ligne, devant le libellé, avec
 *  pour un rappel ou une carence son mois et « R » ou « C » : ce n'est jamais
 *  un montant. Pris pour tel quand l'OCR a manqué la colonne « A payer », il
 *  donnait une IFSE de 641,28 €. */
const RUBRIC_CODE = /^\s*(?:(?:\d{1,2}\/\d{4}\s+)?[RC]\s+)?\d{3}[.,]\d{2}(?=\s*[|[(]?\s*[A-Za-zÀ-ÿ])/;

/** Les montants d'une ligne de rubrique, sans son code. */
function rowAmounts(line: string) {
  return amountsIn(line.replace(RUBRIC_CODE, " "));
}

function linesFor(text: string) {
  return text
    .split(/[\r\n]+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function matchingLineIndexes(lines: string[], labels: string[]) {
  const expected = labels.map(normalized);
  return lines.flatMap((line, index) => {
    const candidate = ` ${normalized(line)} `;
    return expected.some((label) => candidate.includes(` ${label} `)) ? [index] : [];
  });
}

function lastAmountNear(lines: string[], labels: string[], maxOffset = 1) {
  const index = matchingLineIndexes(lines, labels)[0];
  if (index === undefined) return undefined;
  for (let offset = 0; offset <= maxOffset; offset++) {
    const line = lines[index + offset] || "";
    // Des montants passés à la ligne, oui ; ceux de la rubrique suivante, non.
    if (offset > 0 && RUBRIC_CODE.test(line)) break;
    const amounts = rowAmounts(line);
    if (amounts.length) return amounts[amounts.length - 1];
  }
  return undefined;
}

function residenceAmount(lines: string[]) {
  const index = matchingLineIndexes(lines, ["Indemnité de Résidence"])[0];
  if (index === undefined) return undefined;
  let amounts = amountsIn(lines[index] || "");
  // Les bulletins papier placent souvent le code de rubrique (ex. 308.00)
  // avant le libellé : ce nombre n’est pas un montant.
  if (amounts.length >= 3 && amounts[0] < 1000 && amounts[1] >= 100) {
    amounts = amounts.slice(1);
  }
  if (amounts.length >= 3) {
    const [base, rate] = amounts;
    const paid = amounts.at(-1);
    if (base >= 100 && Math.abs(rate) <= 10 && paid !== undefined) {
      const derived = Math.round(base * rate) / 100;
      if (Math.abs(paid) < Math.abs(derived) * 0.5) return derived;
    }
    return paid;
  }
  if (amounts.length === 2 && amounts[0] >= 100 && Math.abs(amounts[1]) <= 10) {
    return Math.round(amounts[0] * amounts[1]) / 100;
  }
  return amounts.at(-1) ?? lastAmountNear(lines, ["Indemnité de Résidence"]);
}

/** Un nombre de dimanches : entier ou demi, à deux centièmes près. */
const halfCount = (value: number) => {
  const count = Math.round(value * 2) / 2;
  return count >= 0.5 && Math.abs(value - count) <= 0.02 ? count : undefined;
};

/**
 * Le nombre de dimanches de la ligne « > 10 dim ». Taux, nombre et montant
 * qui se recoupent le donnent sans doute possible. Sinon le montant, divisé
 * par le taux habituel (54,93 €) puis par le taux lu, doit tomber sur un
 * nombre entier ou demi : un chiffre mal lu ne donne plus « 1,5 dimanche ».
 */
function sundayCount(amounts: number[], amount: number | undefined) {
  if (amount === undefined) return 0;
  const paid = Math.abs(amount);
  if (amounts.length >= 3) {
    const [rate, count] = amounts.slice(-3).map(Math.abs);
    if (isPlausibleSundayRate(rate) && Math.abs(Math.round(rate * count * 100) / 100 - paid) <= 0.011) return halfCount(count) ?? 0;
  }
  const readRate = amounts.length >= 2 && isPlausibleSundayRate(Math.abs(amounts[0])) ? Math.abs(amounts[0]) : undefined;
  return halfCount(paid / 54.93) ?? (readRate !== undefined ? halfCount(paid / readRate) : undefined) ?? 0;
}

/**
 * Le net avant impôt : le montant écrit après son libellé, sur la même
 * ligne, ou dans les trois lignes suivantes après « EN EUROS ». Un montant
 * écrit avant le libellé, ou seul sur une ligne voisine, est celui d'une
 * autre case (le net imposable, un cumul) : il n'est jamais pris. Sur une
 * photo, la case se retrouve par sa place (voir payslipPhotoReading).
 */
function netBeforeTaxIn(lines: string[]) {
  const index = matchingLineIndexes(lines, ["NET A PAYER AVANT IMPOT SUR LE REVENU", "NET A PAYER AVANT IMPOT", "NET AVANT IMPOT"])[0];
  if (index === undefined) return undefined;
  const after = /AVANT\s+IMP\S*(?:\s+SUR\s+LE\s+REVENU)?(.*)$/i.exec(lines[index].normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const same = amountsIn(after?.[1] || "");
  if (same.length) return same[same.length - 1];
  for (let offset = 1; offset <= 3; offset++) {
    const line = lines[index + offset] || "";
    if (RUBRIC_CODE.test(line)) break;
    const euros = /EN\s+EUROS(.*)$/i.exec(line);
    if (euros) {
      const amounts = amountsIn(euros[1]);
      return amounts.length ? amounts[amounts.length - 1] : undefined;
    }
  }
  return undefined;
}

const OCR_MONTHS = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
];

/** Le mois du bulletin : le premier « Mois Année » du texte, celui de
 *  l'en-tête. Un rappel plus bas (« FERIES DES 08 ET 24 MAI 2026 » sur le
 *  bulletin de juin) ne doit pas le remplacer. */
function readOcrPeriod(text: string) {
  const plain = normalized(text);
  const match = new RegExp(`\\b(${OCR_MONTHS.join("|")})\\s+(20\\d{2})\\b`).exec(plain);
  return match ? { month: OCR_MONTHS.indexOf(match[1]), year: Number(match[2]) } : {};
}

/** Les lignes de rémunération d'une photo, avant « CUMUL BRUT », que
 *  l'application ne connaît pas : « 454.04 Indemnité X 57,00 1,00 57,00 ».
 *  Un rappel commence par son mois et « R » (« 5/2026 R 453.09 … ») ; une
 *  carence ou un arrêt maladie, par son mois et « C ». */
function ocrExtraLines(lines: string[]): PayslipExtraLine[] | undefined {
  const cumul = matchingLineIndexes(lines, ["CUMUL BRUT", "ICUMUL BRUT"])[0];
  if (cumul === undefined) return undefined;
  const found = lines.slice(0, cumul).flatMap((line) => {
    const match = /^(?:\d{1,2}\/\d{4}\s+([RC])\s+)?\d{3}[.,]\d{2}\s+([^\d−–—-][^\d]*?)\s+[-−–—]?\d/.exec(line);
    // Le libellé entier, chiffres compris (« dom > 10 dim »), dit si la
    // rubrique est connue ; le libellé affiché s'arrête au premier chiffre.
    const whole = parsePayslipRow(line)?.label;
    if (!match || isKnownEarningLabel(match[2]) || (whole !== undefined && isKnownEarningLabel(whole))) return [];
    const amount = rowAmounts(line.replace(/\b(?:\d{1,2}\/)?(?:19|20)\d{2}\b(?![,.]\d)/g, " ")).at(-1);
    return amount === undefined ? [] : [{
      label: match[2].trim(),
      amount,
      recall: match[1] === "R",
      ...(match[1] === "C" ? { sick: true } : {}),
    }];
  });
  return found.length ? found : undefined;
}

/** Une lecture ratée plutôt qu'une valeur à proposer : un traitement de
 *  quelques euros (le taux « 1,00 » de la ligne), un taux d'impôt au-delà du
 *  barème, qui s'arrête à 43 % (le code « 884,71 » de la ligne). */
const plausibleBaseSalary = (value: number | undefined) => value !== undefined && value >= 100 ? value : undefined;
const plausiblePasRate = (value: number | undefined) => value !== undefined && value >= 0 && value <= 50 ? value : undefined;

/** Lecture prudente des lignes produites par l’OCR d’une photo de bulletin.
 * Les montants sont pris dans la dernière colonne de chaque ligne reconnue ;
 * un libellé incertain est ignoré plutôt que transformé en valeur trompeuse. */
export function readPayslipOcrText(text: string): PayslipReading {
  const lines = linesFor(text);
  const residenceAllowance = residenceAmount(lines);
  const fixedParts = [
    residenceAllowance,
    lastAmountNear(lines, ["Indemnité comp. au SMIC"]),
    lastAmountNear(lines, ["ICHCSG"]),
    lastAmountNear(lines, ["Aide employeur options MGEN"]),
    lastAmountNear(lines, ["Indemnité de caisse"]),
    lastAmountNear(lines, ["Transfert primes/points"]),
  ].filter((amount): amount is number => amount !== undefined);
  const carence = matchingLineIndexes(lines, ["Jour de carence"])
    .map((index) => rowAmounts(lines[index]).at(-1))
    .filter((amount): amount is number => amount !== undefined)
    .reduce((sum, amount) => sum + Math.abs(amount), 0);
  // Taux puis montant sur la même ligne : le compte suit le taux lu, pour
  // rester juste après une revalorisation (54,93 € à défaut).
  const sundayIndex = matchingLineIndexes(lines, ["Indemnité trav. dom > 10 dim"])[0];
  const sundayAmounts = sundayIndex === undefined ? [] : rowAmounts(lines[sundayIndex]);
  const sundayAmount = sundayAmounts.at(-1) ?? lastAmountNear(lines, ["Indemnité trav. dom > 10 dim"]);
  // Fériés travaillés (rappels compris) et forfait des dimanches : chaque
  // ligne présente compte, comme sur un PDF.
  const holidayLines = lines.flatMap((line, index) =>
    /(?:^| )(?:INDEM TRAV J FERIE|FERIES? D(?:ES|U) )/.test(normalized(line)) ? [index] : [],
  );
  // Une année (« MAI 2026 », « 5/2026 R ») se collerait au montant qui la
  // suit, lu alors comme « 2 026 131,02 » : on l'écarte avant la lecture.
  const sumLast = (indexes: number[]) => {
    const amounts = indexes
      .map((index) => rowAmounts(lines[index].replace(/\b(?:\d{1,2}\/)?(?:19|20)\d{2}\b(?![,.]\d)/g, " ")).at(-1))
      .filter((amount): amount is number => amount !== undefined);
    return amounts.length
      ? Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100
      : undefined;
  };

  // « PAS prélèvement à la source » : assiette, taux, montant.
  const pasLine = (() => {
    const index = matchingLineIndexes(lines, ["PAS prélèvement à la source"])[0];
    const amounts = index === undefined ? [] : rowAmounts(lines[index]);
    const [base, rate, paid] = amounts.slice(-3);
    if (amounts.length >= 3 && base >= 100 && Math.abs((base * rate) / 100 - paid) < 0.1) return { rate, amount: Math.abs(paid) };
    const [lineBase, linePaid] = amounts.slice(-2);
    return amounts.length >= 2 && lineBase >= 100
      ? { rate: Math.round((Math.abs(linePaid) / lineBase) * 10000) / 100, amount: Math.abs(linePaid) }
      : undefined;
  })();
  return {
    gross: lastAmountNear(lines, ["CUMUL BRUT", "ICUMUL BRUT"]),
    netBeforeTax: netBeforeTaxIn(lines),
    baseSalary: plausibleBaseSalary(lastAmountNear(lines, ["Traitement de Base"])),
    residenceAllowance,
    ifse: lastAmountNear(lines, ["IFSE"]),
    sundaysBeyondTen: sundayCount(sundayAmounts, sundayAmount),
    cia: lastAmountNear(lines, ["CIA"]),
    // Absente la plupart des mois : aucun férié payé, ce n'est pas un échec de lecture.
    holidayPay: sumLast(holidayLines) ?? 0,
    sundayFlat: sumLast(matchingLineIndexes(lines, ["Indem trav dominical regulier"])),
    // « mensuel » ou « annuel » selon le bulletin.
    navigo: lastAmountNear(lines, ["Forfait Navigo"]),
    mealVoucherDeduction: (() => {
      // La première ligne « Titres repas » est la retenue, pas la part patronale.
      const index = matchingLineIndexes(lines, ["Titres repas"])[0];
      const value = lastAmountNear(lines, ["Titres repas"]);
      if (value === undefined || index === undefined) return value === undefined ? undefined : Math.abs(value);
      // Part d'un titre, nombre de titres, retenue : le produit des deux
      // premiers corrige une retenue mal lue (« -59.00 » pour « -99.00 »).
      const numbers = rowAmounts(lines[index]).map(Math.abs);
      if (numbers.length >= 3) {
        const [share, count, paid] = numbers.slice(-3);
        const computed = Math.round(share * count * 100) / 100;
        if (share <= 15 && count <= 31 && Number.isInteger(count) && Math.abs(computed - paid) > 0.011) return computed;
      }
      // Sans le nombre de titres : la retenue reste un multiple de la part
      // d'un titre, sinon c'est qu'un chiffre a été mal lu.
      if (numbers.length === 2 && numbers[0] <= 15 && numbers[0] > 0) {
        const titles = numbers[1] / numbers[0];
        if (Math.abs(titles - Math.round(titles)) > 0.011) return undefined;
      }
      return Math.abs(value);
    })(),
    carenceDay: carence > 0 ? Math.round(carence * 100) / 100 : undefined,
    carenceDates: carenceDatesFromLabels(
      matchingLineIndexes(lines, ["Jour de carence"]).map((index) => lines[index]),
    ),
    pasRate: plausiblePasRate(lastAmountNear(lines, ["PAS - Taux", "PAS Taux"]) ?? pasLine?.rate),
    incomeTax: pasLine?.amount,
    ...withExtraLines(
      fixedParts.length
        ? Math.round(fixedParts.reduce((sum, amount) => sum + amount, 0) * 100) / 100
        : undefined,
      ocrExtraLines(lines),
    ),
    ...readOcrPeriod(text),
  };
}
