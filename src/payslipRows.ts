/**
 * Les rubriques d'un bulletin photographié, lues une à une : code, libellé,
 * base, taux, montant. Et la preuve par le calcul : sur un bulletin, le brut
 * est la somme des lignes de rémunération, chaque cotisation vaut sa base
 * multipliée par son taux, et le net est le brut moins les cotisations, plus
 * les remboursements, moins les titres repas. Quand tout se recoupe au
 * centime, la lecture est sûre ; un chiffre mal lu se voit, et se corrige
 * souvent tout seul.
 *
 * Tout est calcul : aucun accès au navigateur, et rien n'est conservé.
 */

/** Une ligne de rubrique. */
export type PayslipRow = {
  /** « 674.00 ». */
  code: string;
  label: string;
  /** Rappel d'un mois précédent (« R ») ou carence (« C »). */
  origin?: "R" | "C";
  /** Les nombres de la ligne, dans l'ordre : base, taux, montant. */
  numbers: number[];
};

/** Une cotisation salariale lue sur le bulletin. */
export type PayslipDeduction = {
  /** « 674.00 », et « R » pour le rappel d'un mois précédent. */
  code: string;
  origin?: "R" | "C";
  label: string;
  base?: number;
  /** En pourcentage : 6,90. */
  rate?: number;
  amount: number;
  /** Ce que donne le calcul (base × taux) quand il diffère du montant lu :
   *  la preuve par le total dira lequel est le bon. */
  computed?: number;
  /** Le montant a été corrigé par le calcul : la photo le donnait mal. */
  repaired?: boolean;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const cents = (value: number) => Math.round(value * 100);

/** Le trait du tableau, entre le code et le libellé, que la reconnaissance
 *  lit comme une lettre collée au mot : « ÎTitres repas », « jTitres ». */
const RULE_LETTER = /^[ÎÏIlj1!|]+(?=[A-ZÀ-Ý])/;
const LABEL_START = /^(TRAITEMENT|INDEM|IFSE|CIA\b|ICHCSG|AIDE|TRANSFERT|JOUR|FERIE|CUMUL|COTIS|MGEN|C\.?\s?S\.?\s?G|REMBOURSEMENT|CONT|FORFAIT|TITRES|PAS\b|MONTANT|COMPLEMENT|TAXE|RAFP|PENSION|RETENUE|PRIME|RAPPEL|HEURE|IHTS|MECENAT|VACATION|SUPPLEMENT|NBI)/;

const plain = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

function cleanLabel(raw: string) {
  const label = raw
    .replace(/^[^A-Za-zÀ-ÿ0-9]+/, "")
    // Une tache en fin de libellé, lue comme un chiffre ou une lettre seule
    // (« forfaitaire 4 », « solidaire x % ») ; « Tranche A » garde sa lettre.
    .replace(/(?:\s+(?:[a-z0-9]|[^A-Za-zÀ-ÿ0-9\s]{1,3}))+$/, "")
    .replace(/[^A-Za-zÀ-ÿ0-9.)%>]+$/, "")
    .replace(/\s+/g, " ");
  if (LABEL_START.test(plain(label))) return label;
  const stripped = label.replace(RULE_LETTER, "");
  return stripped !== label && LABEL_START.test(plain(stripped)) ? stripped : label;
}

/** Un nombre de fin de ligne : « 2635,13 », « -99.00 », « <67.02 ». Seul un
 *  vrai signe moins, collé au chiffre, rend le montant négatif : un tiret de
 *  tableau n'en est pas un. */
function numberToken(token: string): number | undefined {
  // « .04 » : le zéro des centimes seuls se perd parfois.
  const match = /^[^\d.,]*?([-−]?)(\d{0,7})[.,](\d{2,5})[^\d]*$/.exec(token);
  if (!match) return undefined;
  const value = Number(`${match[2] || "0"}.${match[3]}`);
  return Number.isFinite(value) ? (match[1] ? -value : value) : undefined;
}

/** Devant le code, parfois, un débris de deux ou trois signes (l'ombre d'un
 *  pli, un trait du tableau lu comme une lettre) : il ne compte pas. */
const ROW_HEAD = /^(?:[^\d\s]{1,3}\s+){0,2}[^A-Za-z0-9]*(?:\d{1,2}\s*\/\s*(?:19|20)\d{2}\W*)?(?:([RC])(?![A-Za-zÀ-ÿ])\W*)?[1lI|]?(\d{3})[.,](\d{2})(?!\d)/;

/** Une ligne de rubrique, si c'en est une : elle commence par son code. */
export function parsePayslipRow(line: string): PayslipRow | null {
  const head = ROW_HEAD.exec(line);
  if (!head) return null;
  const tokens = line.slice(head[0].length).trim().split(/\s+/).filter(Boolean);
  const numbers: number[] = [];
  // Les nombres ferment la ligne. Un débris après eux (« dE », l'ombre d'un
  // trait) ou entre eux (« * », « % », « — ») n'est pas un mot du libellé.
  const isDebris = (token: string) => token.length <= 3 && numberToken(token) === undefined && !/[A-Za-zÀ-ÿ]{3}/.test(token);
  let end = tokens.length;
  while (end > 1 && tokens.length - end < 2 && isDebris(tokens[end - 1]) && tokens.slice(Math.max(0, end - 3), end - 1).some((token) => numberToken(token) !== undefined)) end -= 1;
  for (let index = end - 1; index >= 0; index--) {
    const value = numberToken(tokens[index]);
    if (value !== undefined) {
      numbers.unshift(value);
      end = index;
    } else if (numbers.length && isDebris(tokens[index]) && index > 0 && numberToken(tokens[index - 1]) !== undefined) {
      continue;
    } else if (!/[A-Za-zÀ-ÿ0-9]/.test(tokens[index])) {
      // Signe isolé entre le libellé et ses nombres.
      end = index;
    } else break;
  }
  const label = cleanLabel(tokens.slice(0, end).join(" "));
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(label)) return null;
  return {
    code: `${head[2]}.${head[3]}`,
    label,
    ...(head[1] ? { origin: head[1] as "R" | "C" } : {}),
    numbers,
  };
}

/** Les rubriques que leur code désigne sans erreur : quand la photo écorche
 *  le libellé (« Traitement de Rase »), le code le rétablit. */
const KNOWN_RUBRICS: Record<string, string> = {
  "300.00": "Traitement de Base",
  "308.00": "Indemnité de Résidence",
  "310.00": "Indemnité comp. au SMIC",
  "454.02": "Indem trav dominical régulier",
  "454.04": "Indemnité de caisse",
  "454.08": "Indemnité trav. dom > 10 dim",
  "636.83": "ICHCSG",
  "639.54": "Aide employeur options MGEN",
  "641.25": "CIA",
  "641.28": "IFSE",
  "641.29": "Transfert primes/points",
  "674.00": "Cotisation vieillesse",
  "675.00": "Cotis vieillesse déplafonnée",
  "724.00": "Cotisation Pension Civile",
  "751.00": "Cotisation IRCANTEC Tranche A",
  "797.00": "C.S.G. Déductible",
  "798.00": "Remboursement Dette Sociale",
  "799.00": "Cont. Sociale généralisée",
  "823.20": "Forfait Navigo TZ annuel",
  "823.22": "Forfait Navigo TZ mensuel",
  "870.01": "Titres repas",
  "870.02": "Titres repas carte",
  "884.70": "PAS prélèvement à la source",
  "884.71": "PAS - Taux",
  "886.15": "MONTANT NET SOCIAL",
};

/** Deux libellés se ressemblent-ils ? Part des paires de lettres communes. */
function alike(a: string, b: string) {
  const pairs = (text: string) => {
    const letters = plain(text).replace(/[^A-Z0-9]/g, "");
    const out: string[] = [];
    for (let index = 0; index + 1 < letters.length; index++) out.push(letters.slice(index, index + 2));
    return out;
  };
  const first = pairs(a);
  const second = pairs(b);
  if (!first.length || !second.length) return 0;
  const rest = [...second];
  let common = 0;
  for (const pair of first) {
    const at = rest.indexOf(pair);
    if (at !== -1) {
      common += 1;
      rest.splice(at, 1);
    }
  }
  return (2 * common) / (first.length + second.length);
}

/** Le libellé d'une rubrique, rétabli d'après son code quand la photo l'a
 *  écorché sans le rendre méconnaissable. */
function settledLabel(row: PayslipRow) {
  const known = KNOWN_RUBRICS[row.code];
  return known && known !== row.label && alike(known, row.label) >= 0.45 ? known : row.label;
}

const numberText = (value: number) => value.toFixed(5).replace(/0{1,3}$/, "");

/** La ligne remise au propre : « 9/2026 R 454.08 Indemnité … 54.93 4.00 219.72 ».
 *  Le mois d'origine est gardé tel qu'écrit. */
export function canonicalPayslipLine(line: string): string {
  const row = parsePayslipRow(line);
  if (!row) return line;
  const origin = /^[^A-Za-z0-9]*(\d{1,2})\s*\/\s*((?:19|20)\d{2})/.exec(line);
  return [
    origin ? `${origin[1]}/${origin[2]}` : "",
    row.origin || "",
    row.code,
    settledLabel(row),
    // Deux décimales, davantage pour un coefficient (« 0.85714 »).
    ...row.numbers.map(numberText),
  ].filter(Boolean).join(" ");
}

const isLabel = (row: PayslipRow, pattern: RegExp) => pattern.test(plain(row.label));

/** Le brut, ligne « CUMUL BRUT » : elle n'a pas de code. */
const CUMUL = /(^|[^A-Z])I?CUMUL\s+BRUT/;

export type PayslipRowsReading = {
  /** Les lignes de rémunération, avant le cumul brut. */
  earnings: PayslipRow[];
  /** Les lignes de rémunération que le calcul a corrigées. */
  repairedEarnings?: string[];
  /** Les cotisations salariales, après le cumul brut. */
  deductions: PayslipDeduction[];
  /** Tous les montants des cotisations ont été lus ou recalculés. */
  deductionsComplete: boolean;
  /** Remboursements versés hors brut (forfait Navigo…). */
  reimbursements: number;
  /** Retenue des titres repas, en valeur absolue. */
  mealVouchers: number;
  /** Assiette du prélèvement à la source : le net imposable. */
  taxableNet?: number;
  /** Ligne « MONTANT NET SOCIAL ». */
  netSocial?: number;
  /** Le taux payé du traitement : 0,85714 pour un temps partiel à 80 %. */
  paidRate?: number;
  /** Le traitement à temps plein, base de la ligne. */
  fullBaseSalary?: number;
  /** Ce que les cotisations disent du statut. */
  status?: "contractuel" | "fonctionnaire";
  /** La ligne « CUMUL BRUT » a été trouvée : les sections sont sûres. */
  hasGross: boolean;
};

/** Les taux légaux des cotisations salariales, stables depuis des années :
 *  ils départagent une ligne mal lue, et servent au contrôle du bulletin. */
export const LEGAL_DEDUCTION_RATES: ReadonlyArray<{ pattern: RegExp; rate: number; name: string; group: string }> = [
  { pattern: /VIEILLESSE DEPLAF/, rate: 0.4, name: "vieillesse déplafonnée", group: "vieillesse" },
  { pattern: /COTIS\w*\.? VIEILLESSE/, rate: 6.9, name: "vieillesse plafonnée", group: "vieillesse" },
  { pattern: /IRCANTEC.*\bA\b/, rate: 2.8, name: "IRCANTEC tranche A", group: "IRCANTEC" },
  { pattern: /C\.?\s?S\.?\s?G\.?\s+DEDUCTIBLE/, rate: 6.8, name: "CSG déductible", group: "CSG" },
  { pattern: /DETTE SOCIALE|C\.?R\.?D\.?S/, rate: 0.5, name: "CRDS", group: "CRDS" },
  { pattern: /SOCIALE GENERALISEE|C\.?\s?S\.?\s?G\.?\s+NON DEDUCTIBLE/, rate: 2.4, name: "CSG non déductible", group: "CSG" },
  { pattern: /PENSION CIVILE/, rate: 11.1, name: "pension civile", group: "pension civile" },
  { pattern: /\bRAFP\b|R\.A\.F\.P/, rate: 5, name: "RAFP", group: "RAFP" },
];

/** Le taux légal d'une cotisation, quand son libellé le désigne. */
export function legalDeductionRate(label: string) {
  const text = plain(label);
  return LEGAL_DEDUCTION_RATES.find((item) => item.pattern.test(text));
}

/** Une cotisation : base, taux en pourcentage, montant. Le montant vaut la
 *  base multipliée par le taux, au centime : c'est ce qui permet de le
 *  retrouver quand la photo le donne mal. Le montant lu reste proposé ; le
 *  calcul est gardé à côté quand il diffère. */
function deductionOf(row: PayslipRow): PayslipDeduction | null {
  const numbers = row.numbers.map(Math.abs);
  const legal = legalDeductionRate(row.label)?.rate;
  const head = { code: row.code, ...(row.origin ? { origin: row.origin } : {}), label: row.label };
  const withComputed = (base: number, rate: number, amount: number): PayslipDeduction => {
    const computed = round2((base * rate) / 100);
    return { ...head, base, rate, amount, ...(Math.abs(computed - amount) > 0.011 ? { computed } : {}) };
  };
  if (numbers.length >= 3) {
    const [base, rate, amount] = numbers.slice(-3);
    return withComputed(base, rate, amount);
  }
  if (numbers.length === 2) {
    const [first, second] = numbers;
    // « base taux » sans montant : le taux est celui de la loi, ou un petit
    // nombre devant une grosse base. Sinon « base montant », sans taux.
    if (legal !== undefined ? Math.abs(second - legal) < 0.005 : second <= 30 && first > second * 8)
      return { ...head, base: first, rate: second, amount: round2((first * second) / 100), repaired: true };
    return legal !== undefined ? withComputed(first, legal, second) : { ...head, base: first, amount: second };
  }
  return null;
}

/** Les rubriques d'une page, rangées par nature. */
export function readPayslipRows(lines: string[]): PayslipRowsReading {
  const cumul = lines.findIndex((line) => CUMUL.test(plain(line)));
  const rows = lines.map(parsePayslipRow);
  const result: PayslipRowsReading = {
    earnings: [],
    deductions: [],
    deductionsComplete: cumul !== -1,
    reimbursements: 0,
    mealVouchers: 0,
    hasGross: cumul !== -1,
  };
  let seenDeduction = false;
  rows.forEach((row, index) => {
    if (!row) return;
    const code = Number(row.code);
    if (isLabel(row, /^TRAITEMENT DE BASE/) && row.numbers.length >= 3) {
      const [base, rate, paid] = row.numbers.slice(-3);
      if (rate > 0 && rate <= 1.0001 && Math.abs(round2(base * rate) - paid) <= 0.011) {
        result.paidRate = rate;
        result.fullBaseSalary = base;
      }
    }
    if (isLabel(row, /IRCANTEC/)) result.status = "contractuel";
    else if (isLabel(row, /PENSION CIVILE|\bRAFP\b|R\.A\.F\.P/)) result.status = "fonctionnaire";
    if (cumul !== -1 && index < cumul) {
      result.earnings.push(row);
      return;
    }
    if (cumul === -1) return;
    // Après le brut : cotisations, puis remboursements, titres repas, impôt,
    // et enfin la part patronale (codes 900 et plus), qui ne compte pas.
    if (code >= 900) return;
    if (isLabel(row, /^FORFAIT|NAVIGO|REMBOURSEMENT (TRANSPORT|TRAJET|FRAIS)/) && code >= 800) {
      const amount = row.numbers.at(-1);
      if (amount !== undefined) result.reimbursements = round2(result.reimbursements + Math.abs(amount));
      return;
    }
    if (isLabel(row, /^TITRES? REPAS/)) {
      const amount = row.numbers.at(-1);
      if (amount !== undefined) result.mealVouchers = round2(result.mealVouchers + Math.abs(amount));
      return;
    }
    if (isLabel(row, /^PAS\b/)) {
      // Assiette, taux, montant : l'assiette est le net imposable.
      if (row.numbers.length >= 2 && row.numbers[0] >= 100) result.taxableNet = row.numbers[0];
      return;
    }
    if (isLabel(row, /NET SOCIAL/)) {
      const amount = row.numbers.at(-1);
      if (amount !== undefined && amount >= 100) result.netSocial = amount;
      return;
    }
    if (code >= 800) return;
    const deduction = deductionOf(row);
    if (deduction) {
      result.deductions.push(deduction);
      seenDeduction = true;
    } else result.deductionsComplete = false;
  });
  if (!seenDeduction) result.deductionsComplete = false;
  return result;
}

/** Ce que peut valoir le montant d'une ligne de rémunération : le dernier
 *  nombre lu, puis ce que donne le calcul (base × coefficient, ou base ×
 *  pourcentage) quand il en diffère. */
function earningCandidates(numbers: number[]): number[] {
  if (!numbers.length) return [];
  const read = numbers[numbers.length - 1];
  if (numbers.length === 1) return [read];
  const [base, rate] = numbers.length >= 3 ? numbers.slice(-3) : numbers;
  const computed = [round2(base * rate), round2((base * rate) / 100)];
  // Base, taux et montant qui se recoupent : rien d'autre à essayer.
  if (numbers.length >= 3 && computed.some((value) => Math.abs(value - Math.abs(read)) <= 0.011)) return [read];
  return [read, ...computed.filter((value) => value > 0 && Math.abs(value - read) > 0.011)];
}

/**
 * Le brut est la somme des lignes de rémunération. Quand elle ne tombe pas
 * juste, une ligne a été mal lue (son montant manque, ou un chiffre a
 * changé) : on essaie pour chacune ce que donne le calcul, jusqu'à retrouver
 * le brut. Les lignes rendues portent alors le bon montant en dernier.
 */
export function repairEarningLines(lines: string[]): { lines: string[]; repaired: string[] } {
  const cumul = lines.findIndex((line) => CUMUL.test(plain(line)));
  if (cumul === -1) return { lines, repaired: [] };
  const grossText = /(\d{3,6})[.,](\d{2})\s*\W*$/.exec(lines[cumul]);
  if (!grossText) return { lines, repaired: [] };
  const target = cents(Number(`${grossText[1]}.${grossText[2]}`));
  const rows = lines.slice(0, cumul).map((line, index) => ({ index, row: parsePayslipRow(line) })).filter((item): item is { index: number; row: PayslipRow } => item.row !== null);
  if (!rows.length) return { lines, repaired: [] };
  const options = rows.map(({ row }) => earningCandidates(row.numbers).map(cents));
  if (options.some((list) => !list.length)) return { lines, repaired: [] };
  const base = options.reduce((sum, list) => sum + list[0], 0);
  if (Math.abs(base - target) <= 1) return { lines, repaired: [] };
  // Une ligne changée, puis deux.
  const changes: Array<Array<[number, number]>> = [];
  options.forEach((list, row) => {
    for (let choice = 1; choice < list.length; choice++) changes.push([[row, choice]]);
  });
  const singles = changes.length;
  for (let first = 0; first < singles; first++)
    for (let second = first + 1; second < singles; second++)
      if (changes[first][0][0] !== changes[second][0][0]) changes.push([changes[first][0], changes[second][0]]);
  const solution = changes.find((change) =>
    Math.abs(base + change.reduce((sum, [row, choice]) => sum + options[row][choice] - options[row][0], 0) - target) <= 1);
  if (!solution) return { lines, repaired: [] };
  const next = [...lines];
  const repaired: string[] = [];
  for (const [position, choice] of solution) {
    const { index, row } = rows[position];
    const origin = /^[^A-Za-z0-9]*(\d{1,2})\s*\/\s*((?:19|20)\d{2})/.exec(lines[index]);
    const amount = options[position][choice] / 100;
    // Trois nombres : le montant lu était faux ; deux : il manquait.
    const numbers = row.numbers.length >= 3 ? [...row.numbers.slice(0, -1), amount] : [...row.numbers, amount];
    next[index] = [origin ? `${origin[1]}/${origin[2]}` : "", row.origin || "", row.code, settledLabel(row), ...numbers.map(numberText)].filter(Boolean).join(" ");
    repaired.push(settledLabel(row));
  }
  return { lines: next, repaired };
}

/** Une cotisation dont la base, le taux et le montant se recoupent : la
 *  photo l'a donnée sans faute. */
export const isSureDeduction = (item: PayslipDeduction) =>
  item.rate !== undefined && item.computed === undefined && !item.repaired;

/**
 * Deux lectures de la même page (la photo préparée de deux façons) : pour
 * chaque cotisation, celle des deux qui se recoupe. Rien n'est rendu si les
 * deux lectures ne portent pas les mêmes rubriques.
 */
export function blendPayslipRows(first: PayslipRowsReading, second: PayslipRowsReading): PayslipRowsReading | null {
  const key = (item: PayslipDeduction) => `${item.origin || ""}${item.code}`;
  if (first.deductions.length !== second.deductions.length || first.deductions.some((item, index) => key(item) !== key(second.deductions[index]))) return null;
  return {
    ...first,
    deductions: first.deductions.map((item, index) => !isSureDeduction(item) && isSureDeduction(second.deductions[index]) ? second.deductions[index] : item),
    deductionsComplete: first.deductionsComplete || second.deductionsComplete,
  };
}

/** Le montant payé d'une ligne de rémunération : son dernier nombre. Quand
 *  la ligne porte base, taux et montant, le calcul le confirme ou le donne. */
function earningAmount(row: PayslipRow): { amount: number; sure: boolean } | null {
  const numbers = row.numbers;
  if (!numbers.length) return null;
  const amount = numbers[numbers.length - 1];
  if (numbers.length >= 3) {
    const [base, rate] = numbers.slice(-3);
    // Le taux est un coefficient (0,85714 ; 4 dimanches) ou un pourcentage (3 %).
    const sure = [round2(base * rate), round2((base * rate) / 100)].some((value) => Math.abs(value - Math.abs(amount)) <= 0.011);
    return { amount, sure };
  }
  return { amount, sure: false };
}

export type PayslipProof = {
  /** Le brut est bien la somme des lignes de rémunération. */
  gross?: boolean;
  /** Au pied du bulletin, « à payer » moins « à déduire » donne bien le net. */
  totals?: boolean;
  /** Le net se retrouve au centime depuis le brut et les retenues. */
  net?: boolean;
  /** Le total des cotisations lues. */
  deductionsTotal?: number;
  /** Les montants que le calcul a corrigés. */
  repaired: string[];
};

export type PayslipProofInput = {
  gross?: number;
  netBeforeTax?: number;
  rows?: PayslipRowsReading;
  /** Totaux du pied de page, quand la photo les montre : à payer, à déduire. */
  totalEarnings?: number;
  totalDeductions?: number;
};

/**
 * La preuve par le calcul. Le total des cotisations est connu de deux
 * façons : écrit au pied du bulletin, ou déduit du net (brut + remboursements
 * − titres repas − net). Les cotisations lues doivent y tomber au centime ;
 * sinon, on cherche laquelle la photo a mal donnée, en essayant pour chaque
 * ligne douteuse son montant recalculé.
 */
export function provePayslip(input: PayslipProofInput): PayslipProof {
  const proof: PayslipProof = { repaired: [] };
  const { rows, gross, netBeforeTax } = input;
  if (input.totalEarnings !== undefined && input.totalDeductions !== undefined && netBeforeTax !== undefined)
    proof.totals = Math.abs(cents(input.totalEarnings) - cents(input.totalDeductions) - cents(netBeforeTax)) <= 1;
  if (!rows) return proof;
  if (gross !== undefined && rows.earnings.length) {
    const amounts = rows.earnings.map(earningAmount);
    if (amounts.every((item) => item !== null)) {
      const sum = amounts.reduce((total, item) => total + cents(item!.amount), 0);
      proof.gross = Math.abs(sum - cents(gross)) <= 1;
    }
  }
  if (!rows.deductions.length) return proof;
  const target = input.totalDeductions !== undefined
    ? cents(input.totalDeductions)
    : gross !== undefined && netBeforeTax !== undefined && rows.deductionsComplete
      ? cents(gross) + cents(rows.reimbursements) - cents(rows.mealVouchers) - cents(netBeforeTax)
      : undefined;
  const read = rows.deductions.map((item) => cents(item.amount));
  const total = read.reduce((sum, value) => sum + value, 0);
  proof.deductionsTotal = total / 100;
  if (target === undefined) return proof;
  if (Math.abs(total - target) <= 1 && rows.deductionsComplete) {
    proof.net = true;
    proof.repaired = rows.deductions.filter((item) => item.repaired).map((item) => item.label);
    return proof;
  }
  // Une ligne mal lue : son montant recalculé (base × taux), s'il diffère,
  // fait-il tomber le total juste ? On essaie chaque ligne, puis deux.
  const alternatives = rows.deductions.map((item) => item.computed !== undefined ? cents(item.computed) : undefined);
  const candidates = alternatives.flatMap((value, index) => value !== undefined && value !== read[index] ? [index] : []);
  const fits = (changed: number[]) =>
    Math.abs(total + changed.reduce((sum, index) => sum + (alternatives[index] as number) - read[index], 0) - target) <= 1;
  const solution = candidates.map((index) => [index]).find(fits)
    ?? candidates.flatMap((first, position) => candidates.slice(position + 1).map((second) => [first, second])).find(fits);
  if (solution && rows.deductionsComplete) {
    for (const index of solution) {
      const { computed: _computed, ...rest } = rows.deductions[index];
      rows.deductions[index] = { ...rest, amount: (alternatives[index] as number) / 100, repaired: true };
    }
    proof.net = true;
    proof.deductionsTotal = target / 100;
    proof.repaired = rows.deductions.filter((item) => item.repaired).map((item) => item.label);
    return proof;
  }
  proof.net = false;
  return proof;
}
