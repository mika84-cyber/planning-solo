/** Lecture d'un bulletin de paie, entièrement dans le navigateur.
 *
 *  Le fichier n'est jamais envoyé nulle part : il est lu sur l'appareil, les
 *  quelques montants utiles en sont tirés, et rien n'est conservé. C'est une
 *  pièce sensible, elle n'a rien à faire sur un serveur.
 *
 *  La lecture s'appuie sur la mise en page actuelle des bulletins de paie,
 *  vérifiée sur huit d'entre eux entre 2024 et 2026 : même libellés, mêmes
 *  codes. Si elle change, l'extraction échoue — et il vaut mieux le dire que
 *  d'annoncer « tout est bon » à tort.
 */

/** Un montant relevé sur le bulletin. */
export type PayslipReading = {
  /** Ligne « CUMUL BRUT » : le total sur lequel tout se recoupe. */
  gross?: number;
  /** Somme versée avant prélèvement à la source, lue au pied du bulletin. */
  netBeforeTax?: number;
  /** Ligne « Traitement de Base ». */
  baseSalary?: number;
  /** Ligne « Indemnité de Résidence », utilisée séparément pour les IHTS. */
  residenceAllowance?: number;
  /** Ligne « IFSE ». */
  ifse?: number;
  /** Mois du bulletin, lu sur l'en-tête « Juin 2026 ». */
  month?: number;
  year?: number;
  /** Nombre de dimanches indemnisés au-delà du dixième, ligne « Indemnité
   *  trav. dom > 10 dim ». Vaut 0 quand la ligne est absente — la plupart des
   *  mois n'en portent pas, ce n'est pas un échec de lecture. */
  sundaysBeyondTen: number;
  /** Ligne « CIA » : versée une seule fois l'an, absente le reste du temps —
   *  la présence de ce champ dit sur quel bulletin elle est tombée. */
  cia?: number;
  /** Ligne « Forfait  Navigo TZ mensuel » (deux espaces après « Forfait »
   *  dans le PDF). */
  navigo?: number;
  /** Ligne « Titres repas carte » : une retenue, négative sur le bulletin,
   *  ramenée ici à sa valeur absolue comme le champ du profil l'attend.
   *  Absente en décembre la plupart des années. */
  mealVoucherDeduction?: number;
  /** Ligne « Jour de carence AAAA/MM/JJ » : le libellé porte la date du jour
   *  posé, donc jamais deux fois le même texte — on ne peut le repérer que
   *  par préfixe. Absente la plupart des mois : normal, ce n'est pas un
   *  échec de lecture. Ramenée à sa valeur absolue. */
  carenceDay?: number;
  /** Les dates portées par les lignes « Jour de carence » : chacune nomme le
   *  premier jour d'un arrêt, et dit donc sur quelle paie cet arrêt a été
   *  retenu. Au format « AAAA-MM-JJ », sans doublon. */
  carenceDates?: string[];
  /** Lignes « Indem trav j férié ac public » : les jours fériés travaillés
   *  payés sur ce bulletin, rappels compris (« 8/2026 R »), additionnés. */
  holidayPay?: number;
  /** Ligne « Indem trav dominical régulier » : le forfait mensuel des
   *  dimanches, versé chaque mois. */
  sundayFlat?: number;
  /** Ligne « PAS - Taux » : le taux lui-même, pas une assiette — une seule
   *  valeur suit le libellé, contrairement aux lignes de cotisation. */
  pasRate?: number;
  /** Somme des lignes fixes présentes (Indemnité de Résidence, Indemnité comp. au
   *  SMIC, ICHCSG, Aide employeur options MGEN, moins Transfert
   *  primes/points) — la même formule que l'infobulle du champ « Autres
   *  éléments fixes » décrit déjà. Les lignes absentes valent zéro pour le
   *  mois du bulletin. */
  otherFixed?: number;
  /** Lignes de rémunération que l'application ne connaît pas encore. Elles
   *  sont prises en compte plutôt qu'ignorées : l'utilisateur dit si chacune
   *  est un élément fixe ou ponctuelle ; un rappel (« R ») ne vaut que pour ce
   *  mois ; une ligne d'arrêt maladie (« C ») est déjà calculée. */
  extraLines?: PayslipExtraLine[];
};

export type PayslipExtraLine = {
  label: string;
  amount: number;
  /** Rappel d'un mois précédent (« R »). */
  recall: boolean;
  /** Carence ou arrêt maladie (« C ») : la retenue est déjà calculée. */
  sick?: boolean;
  /** Réponse de l'utilisateur : élément fixe (true) ou ponctuel (false). */
  fixed?: boolean;
};

/** Les lignes de rémunération que l'application sait déjà lire. */
const KNOWN_EARNING_LABELS = [
  "Traitement de Base", "Indemnité de Résidence", "IFSE", "CIA",
  "Indemnité trav. dom > 10 dim", "Indem trav j férié", "Feries des", "Ferie du",
  "Indem trav dominical régulier", "Indemnité comp. au SMIC", "ICHCSG",
  "Aide employeur options MGEN", "Indemnité de caisse", "Transfert primes/points",
  "Jour de carence", "CUMUL BRUT",
];

/** Libellé réduit à ses lettres et chiffres, pour comparer un PDF et une photo. */
export function plainPayslipLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

const KNOWN_PLAIN_LABELS = KNOWN_EARNING_LABELS.map(plainPayslipLabel);

export function isKnownEarningLabel(label: string) {
  const plain = plainPayslipLabel(label);
  return KNOWN_PLAIN_LABELS.some((known) => plain.startsWith(known));
}

/** Une ligne de mécénat (ou de vacation) sur le bulletin. */
export function isMecenatLabel(label: string) {
  return /MECENAT|VACATION/.test(plainPayslipLabel(label));
}

/** Une ligne d'heures supplémentaires (IHTS) sur le bulletin. */
export function isOvertimeLabel(label: string) {
  return isComputedVariableLabel(label) && !isMecenatLabel(label);
}

/** Heures supplémentaires et mécénats : l'application les calcule déjà, ils
 *  ne deviennent jamais des éléments fixes. */
export function isComputedVariableLabel(label: string) {
  return /HEURE|H SUP|IHTS|MECENAT|VACATION/.test(plainPayslipLabel(label));
}

/** Rappel, arrêt maladie, heures supplémentaires ou mécénat : la ligne se
 *  range d'elle-même, sans rien demander. */
export function isAutomaticExtraLine(line: PayslipExtraLine) {
  return line.recall || Boolean(line.sick) || isComputedVariableLabel(line.label);
}

/** Les lignes inconnues que l'utilisateur a rangées dans les éléments fixes. */
export function fixedExtraTotal(lines: PayslipExtraLine[] | undefined) {
  const total = (lines || [])
    .filter((line) => line.fixed === true && !isAutomaticExtraLine(line))
    .reduce((sum, line) => sum + line.amount, 0);
  return Math.round(total * 100) / 100;
}

/** Les lignes inconnues qui ne valent que pour le mois du bulletin : les
 *  rappels et celles que l'utilisateur a dites ponctuelles. */
export function oneOffExtraTotal(lines: PayslipExtraLine[] | undefined) {
  const total = (lines || [])
    .filter((line) => line.recall || (line.fixed === false && !isAutomaticExtraLine(line)))
    .reduce((sum, line) => sum + line.amount, 0);
  return Math.round(total * 100) / 100;
}

export type NetRatios = { netRatioFixed: number; netRatioVariable: number };

export type NetRatioCalibration = {
  rates?: NetRatios;
  totalCount: number;
  usableCount: number;
  missing: Array<"gross" | "baseSalary" | "netBeforeTax">;
  /** « ready » : les deux taux, séparés grâce à des bulletins aux primes
   *  différentes ; « approximate » : calés sur un seul bulletin, ou sur des
   *  bulletins trop semblables, en gardant le rapport des taux de départ. */
  reason: "ready" | "approximate" | "need-more-readable" | "not-enough-variation" | "inconsistent";
  /** Bulletins écartés du calcul car incohérents (voir incoherentNetRatioReadings). */
  rejectedCount?: number;
  /** Les bulletins gardés qui calent les taux, du plus récent au plus ancien,
   *  pour les montrer dans le profil et retirer un bulletin mal lu. */
  samples?: NetRatioSample[];
};

/** Un bulletin qui cale les taux, sous son mois « AAAA-MM ». */
export type NetRatioSample = {
  period: string;
  year: number;
  month: number;
  gross: number;
  netBeforeTax: number;
  /** Écarté du calcul : il ne concorde pas avec les autres. */
  rejected: boolean;
};

/** Les cotisations ont changé avec l'entrée en vigueur du contrat collectif
 * Culture/MGEN en octobre 2025. Des bulletins placés de part et d'autre de
 * cette date ne doivent jamais servir à une même calibration. */
export type PayCalibrationRegime = "pre-culture-psc" | "culture-psc";

/** Estimation de départ confirmée sur les bulletins qui ont servi à calibrer
 * l'application personnelle. Elle permet de calculer immédiatement le net,
 * puis une calibration PDF fiable la remplace automatiquement si disponible. */
export const DEFAULT_NET_RATIO_FIXED = 79.41;
export const DEFAULT_NET_RATIO_VARIABLE = 89.92;
export const PRE_PSC_NET_RATIO_FIXED = 81.39;
export const PRE_PSC_NET_RATIO_VARIABLE = 90.49;

/** Contractuel : les cotisations salariales portent sur tout le brut, primes
 * comprises — assurance vieillesse (6,90 % + 0,40 %), IRCANTEC tranche A
 * (2,80 %), CSG et CRDS (9,7 % de 98,25 % du brut) —, soit 19,63 % avant la
 * protection sociale complémentaire : 80,37 % du brut restent, traitement
 * comme primes, faute de pension civile et de RAFP.
 *
 * Depuis le contrat Culture/MGEN, un bulletin réel de contractuelle (juin
 * 2026, CDI) ajoute 0,70 % du brut (part solidaire) et ses fonds (2,65 % et
 * 0,44 % de ces parts), plus un forfait d'environ 17 € (part forfaitaire et
 * CSG sur la part employeur) : 20,35 % du brut et 17 € fixes, soit 585,57 €
 * pour 2 793,54 € de brut. Le forfait, porté par la part fixe, la ramène à
 * 78,87 % ; les primes gardent 79,65 %. Recalculé sur ce bulletin, le net
 * tombe à 0,60 € près. Une calibration sur ses propres bulletins remplace
 * ces valeurs dès qu'elle est possible. */
export const CONTRACTUEL_NET_RATIO_FIXED = 78.87;
export const CONTRACTUEL_NET_RATIO_VARIABLE = 79.65;
export const CONTRACTUEL_PRE_PSC_NET_RATIO = 80.37;

export function payCalibrationRegime(
  year: number | undefined,
  month: number | undefined,
): PayCalibrationRegime {
  if (year === undefined || month === undefined) return "culture-psc";
  return year > 2025 || (year === 2025 && month >= 9)
    ? "culture-psc"
    : "pre-culture-psc";
}

export function defaultNetRatiosForPeriod(year: number, month: number, contractuel = false) {
  if (contractuel)
    return payCalibrationRegime(year, month) === "culture-psc"
      ? {
          netRatioFixed: CONTRACTUEL_NET_RATIO_FIXED,
          netRatioVariable: CONTRACTUEL_NET_RATIO_VARIABLE,
        }
      : {
          netRatioFixed: CONTRACTUEL_PRE_PSC_NET_RATIO,
          netRatioVariable: CONTRACTUEL_PRE_PSC_NET_RATIO,
        };
  return payCalibrationRegime(year, month) === "culture-psc"
    ? {
        netRatioFixed: DEFAULT_NET_RATIO_FIXED,
        netRatioVariable: DEFAULT_NET_RATIO_VARIABLE,
      }
    : {
        netRatioFixed: PRE_PSC_NET_RATIO_FIXED,
        netRatioVariable: PRE_PSC_NET_RATIO_VARIABLE,
      };
}

/** Les taux brut → net sont-ils encore des valeurs moyennes (taux par
 *  défaut), et pas ceux calculés sur les bulletins de la personne ? */
export function usesAverageNetRatios(netRatioFixed: number, netRatioVariable: number) {
  return [
    [DEFAULT_NET_RATIO_FIXED, DEFAULT_NET_RATIO_VARIABLE],
    [PRE_PSC_NET_RATIO_FIXED, PRE_PSC_NET_RATIO_VARIABLE],
    [CONTRACTUEL_NET_RATIO_FIXED, CONTRACTUEL_NET_RATIO_VARIABLE],
    [CONTRACTUEL_PRE_PSC_NET_RATIO, CONTRACTUEL_PRE_PSC_NET_RATIO],
  ].some(([fixed, variable]) => fixed === netRatioFixed && variable === netRatioVariable);
}

export function readingsForCalibrationRegime(
  readings: PayslipReading[],
  regime: PayCalibrationRegime,
) {
  return readings.filter(
    (reading) =>
      reading.year !== undefined &&
      reading.month !== undefined &&
      payCalibrationRegime(reading.year, reading.month) === regime,
  );
}

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** La période du bulletin, écrite en toutes lettres dans son en-tête. Sans
 *  elle, impossible de savoir à quel mois comparer. */
function readPeriod(tokens: string[]) {
  for (const token of tokens) {
    const match = /^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/.exec(token.trim());
    if (!match) continue;
    const month = MONTH_NAMES.indexOf(match[1].toLowerCase());
    if (month !== -1) return { month, year: Number(match[2]) };
  }
  return {};
}

/** Décompresse un flux, quand le PDF en contient. Les bulletins actuels n'en
 *  ont pas, mais rien ne garantit que ça dure. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function latin1(bytes: Uint8Array) {
  let out = "";
  // Par tranches : passer 800 ko d'un coup à String.fromCharCode dépasse la
  // taille d'appel autorisée.
  for (let index = 0; index < bytes.length; index += 8192)
    out += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return out;
}

function decodePdfString(value: string) {
  return value
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\(\d{1,3})/g, (_, octal) =>
      String.fromCharCode(parseInt(octal, 8)),
    );
}

/** Les fragments de texte du PDF, dans l'ordre où ils sont écrits. */
export async function extractPayslipTokens(
  buffer: ArrayBuffer,
): Promise<string[]> {
  const bytes = new Uint8Array(buffer);
  const raw = latin1(bytes);
  let content = "";
  let cursor = 0;
  while (true) {
    const start = raw.indexOf("stream", cursor);
    if (start === -1) break;
    let begin = start + 6;
    if (raw.charCodeAt(begin) === 13) begin++;
    if (raw.charCodeAt(begin) === 10) begin++;
    const end = raw.indexOf("endstream", begin);
    if (end === -1) break;
    const chunk = bytes.subarray(begin, end);
    const inflated = await inflate(chunk);
    content += (inflated ? latin1(inflated) : raw.slice(begin, end)) + "\n";
    cursor = end + 9;
  }

  const tokens: string[] = [];
  for (const line of content.split(/[\r\n]+/)) {
    for (const match of line.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g))
      tokens.push(decodePdfString(match[1]));
    for (const match of line.matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ/g)) {
      const pieces = [...match[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)].map(
        (piece) => decodePdfString(piece[1]),
      );
      if (pieces.length) tokens.push(pieces.join(""));
    }
  }
  return tokens;
}

const NUMBER = /^-?\d+([.,]\d+)?$/;

/** Les PDF de paie n'écrivent pas tous les milliers de la même façon :
 * certains produisent `2403.10`, d'autres `2 403,10`, avec parfois une espace
 * insécable. On ramène ces variantes au même nombre avant de le valider. */
function parseAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  if (!NUMBER.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : undefined;
}

/** Le n-ième nombre écrit après un libellé donné (`offset` = 1 par défaut :
 *  le tout premier).
 *
 *  Les lignes du bulletin n'ont pas toutes le même nombre de colonnes.
 *  Beaucoup suivent le format [taux, code, libellé, assiette, montant] : le
 *  montant réellement payé est le second nombre (`offset: 2`), pas le
 *  premier — l'assiette et le montant ne coïncident que quand le taux vaut
 *  100 %, ce qui a longtemps trompé la lecture du traitement et de l'IFSE
 *  (où les deux se valent) mais aurait donné un chiffre faux sur une ligne
 *  comme les titres repas ou le jour de carence, où ils diffèrent. Les
 *  lignes de simple total (CUMUL BRUT, PAS - Taux) n'ont qu'un seul nombre :
 *  `offset: 1` continue de s'appliquer telles quelles.
 */
function amountAfter(
  tokens: string[],
  label: string,
  offset = 1,
): number | undefined {
  // Un accent, une majuscule ou une espace de plus d'un logiciel de paie à
  // l'autre ne doit pas rendre une ligne introuvable.
  const expected = normalizedLabel(label);
  const index = tokens.findIndex((token) => normalizedLabel(token) === expected);
  if (index === -1) return undefined;
  return parseAmount(tokens[index + offset]);
}

/** Comme `amountAfter`, pour le premier libellé qui commence ainsi : le
 *  forfait Navigo est « mensuel » ou « annuel », les titres repas « carte »
 *  ou non, selon le bulletin. */
function amountAfterPrefix(tokens: string[], prefix: string, offset: number) {
  const expected = normalizedLabel(prefix);
  const index = tokens.findIndex((token) => normalizedLabel(token).startsWith(expected));
  return index === -1 ? undefined : parseAmount(tokens[index + offset]);
}

/** Le taux de prélèvement à la source. Certains bulletins l'écrivent seul
 *  (« PAS - Taux 1.90 »), d'autres sur la ligne du prélèvement avec son
 *  assiette et son montant (« PAS prélèvement à la source 2322.05 74.31 ») :
 *  le taux s'en déduit, ou se lit s'il est écrit entre les deux. */
function readPasRate(tokens: string[]) {
  const written = amountAfter(tokens, "PAS - Taux");
  if (written !== undefined) return written;
  const expected = normalizedLabel("PAS prélèvement à la source");
  const index = tokens.findIndex((token) => normalizedLabel(token).startsWith(expected));
  if (index === -1) return undefined;
  const [base, second, third] = [1, 2, 3].map((offset) => parseAmount(tokens[index + offset]));
  if (base === undefined || second === undefined || base < 100) return undefined;
  if (third !== undefined && Math.abs((base * second) / 100 - third) < 0.05) return second;
  const rate = Math.round((Math.abs(second) / base) * 10000) / 100;
  return rate > 0 && rate < 50 ? rate : undefined;
}

/** La date d'un « Jour de carence », telle que son libellé la porte :
 *  « 20/3/2024 » dans les PDF, « 2026/03/02 » après lecture d'une photo. */
export function carenceDateFromLabel(label: string): string | undefined {
  const text = label.replace(/^.*?Jour de carence/i, "");
  const yearFirst = /(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(text);
  const dayFirst = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  const parts = yearFirst
    ? [yearFirst[1], yearFirst[2], yearFirst[3]]
    : dayFirst
      ? [dayFirst[3], dayFirst[2], dayFirst[1]]
      : null;
  if (!parts) return undefined;
  const key = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  const date = new Date(`${key}T12:00:00Z`);
  // Un 31 février lu de travers ne devient pas un 3 mars.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : undefined;
}

export function carenceDatesFromLabels(labels: string[]): string[] | undefined {
  const dates = [...new Set(labels.map(carenceDateFromLabel).filter((date): date is string => Boolean(date)))].sort();
  return dates.length ? dates : undefined;
}

/** Certaines régularisations portent plusieurs lignes « Jour de carence »
 * sur un même bulletin. Elles doivent toutes être prises en compte. */
function sumAmountsAfterPrefix(
  tokens: string[],
  prefix: string,
  offset: number,
): number | undefined {
  const expected = normalizedLabel(prefix);
  const values = tokens.flatMap((token, index) => {
    if (!normalizedLabel(token).startsWith(expected)) return [];
    const value = parseAmount(tokens[index + offset]);
    return value === undefined ? [] : [Math.abs(value)];
  });
  if (!values.length) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

/** Le montant payé d'une ligne : le dernier nombre qui suit son libellé.
 *  Selon la ligne, le bulletin écrit le montant seul (« 262.05 8/2026 R »)
 *  ou l'assiette puis le montant (« 89.59 89.59 »). Toutes les lignes qui
 *  commencent par le même libellé sont additionnées : un rappel en ajoute. */
function sumLineAmounts(tokens: string[], matches: (label: string) => boolean): number | undefined {
  const values = tokens.flatMap((token, index) => {
    if (!matches(token)) return [];
    const numbers: number[] = [];
    for (let next = index + 1; next < tokens.length && numbers.length < 2; next++) {
      const value = parseAmount(tokens[next]);
      if (value === undefined) break;
      numbers.push(value);
    }
    return numbers.length ? [numbers[numbers.length - 1]] : [];
  });
  if (!values.length) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

function normalizedLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Les éditeurs de paie changent parfois les accents ou la casse de cette
 * ligne, mais pas son sens. */
function readNetBeforeTax(tokens: string[]): number | undefined {
  const labels = [
    "NET A PAYER AVANT IMPOT SUR LE REVENU",
    "NET A PAYER AVANT IMPOT",
    "NET AVANT IMPOT",
  ];
  const index = tokens.findIndex((token) => {
    const normalized = normalizedLabel(token);
    return labels.some((label) => normalized.startsWith(label));
  });
  if (index === -1) return undefined;
  // Selon le générateur du PDF, le montant est le fragment suivant ou se
  // trouve après un petit libellé / taux. Le net mensuel est le premier
  // montant significatif dans cette courte zone ; un taux de PAS (1,7 par
  // exemple) est volontairement ignoré.
  for (let offset = 1; offset <= 50; offset++) {
    const token = tokens[index + offset]?.trim();
    if (!token || !/[.,]\d{2}(?:\s|$)/.test(token)) continue;
    const value = parseAmount(token);
    if (
      value !== undefined &&
      Math.abs(value) >= 100 &&
      Math.abs(value) <= 20000
    )
      return Math.abs(value);
  }
  return undefined;
}

/** Une retenue est écrite en négatif sur le bulletin ; les champs du profil
 *  attendent un montant positif. */
function magnitude(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.abs(value);
}

const PAYSLIP_CODE = /^\d{3}\.\d{2}$/;
/* Une ligne peut porter son origine avant le code : « R » pour un rappel,
   « C » pour une carence ou un arrêt maladie. */
const hasWords = (token: string) => /[A-Za-zÀ-ÿ]{3,}/.test(token);

/** Les lignes de rémunération, avant « CUMUL BRUT », que l'application ne
 *  connaît pas. Chaque ligne s'écrit [taux, code, libellé, base, montant] ;
 *  les deux nombres qui suivent le montant sont le taux et le code de la
 *  ligne suivante. Un rappel porte « R » et son mois avant le code.
 *
 *  Devant le code vient donc un nombre (le taux, ou le montant de la ligne
 *  précédente) ou l'origine « R » ou « C ». L'en-tête du bulletin ne s'y
 *  conforme pas : son temps de travail, « 100.00 », a l'allure d'un code,
 *  mais l'emploi le précède, et le statut qui le suit (« Fonctionnaire
 *  Titulaire ») n'est pas une ligne de paie. Aucune ligne, enfin, ne dépasse
 *  le brut du mois. */
function readExtraLines(tokens: string[]): PayslipExtraLine[] | undefined {
  const cumul = tokens.findIndex((token) => normalizedLabel(token) === "CUMUL BRUT");
  if (cumul === -1) return undefined;
  const gross = parseAmount(tokens[cumul + 1]);
  const lines: PayslipExtraLine[] = [];
  for (let index = 1; index < cumul; index++) {
    const label = tokens[index].trim();
    if (!hasWords(label) || !PAYSLIP_CODE.test(tokens[index - 1]?.trim() || "")) continue;
    const beforeCode = tokens[index - 2]?.trim();
    if (beforeCode !== undefined && parseAmount(beforeCode) === undefined && beforeCode !== "R" && beforeCode !== "C") continue;
    const run: number[] = [];
    let next = index + 1;
    for (; next < cumul + 1 && run.length < 6; next++) {
      const value = parseAmount(tokens[next]);
      if (value === undefined) break;
      run.push(value);
    }
    const followedByLine = next <= cumul && hasWords(tokens[next] || "");
    const own = followedByLine && run.length >= 3 && PAYSLIP_CODE.test(tokens[next - 1].trim()) ? run.slice(0, -2) : run;
    const amount = own.at(-1);
    if (amount === undefined || isKnownEarningLabel(label)) continue;
    if (gross !== undefined && Math.abs(amount) > Math.abs(gross)) continue;
    const origin = [tokens[index - 2], tokens[index - 3]].map((token) => token?.trim());
    const recall = origin.includes("R");
    const sick = origin.includes("C");
    lines.push({ label, amount, recall, ...(sick ? { sick } : {}) });
  }
  return lines.length ? lines : undefined;
}

/** Les lignes qui composent « Autres éléments fixes », dans le même
 *  ordre que l'infobulle du champ (résidence + SMIC comp. + ICHCSG + MGEN −
 *  transfert). Deux d'entre elles (indemnité comp. au SMIC, aide employeur
 *  options MGEN) ne sont apparues qu'à partir de 2025-2026 : sur un bulletin
 *  plus ancien qui ne les porte pas encore valent simplement zéro pour le
 *  mois concerné. On additionne donc toutes les lignes effectivement
 *  présentes, au lieu d'obliger l'utilisateur à refaire le calcul. */
function readOtherFixed(tokens: string[]): number | undefined {
  const parts = [
    amountAfter(tokens, "Indemnité de Résidence", 2),
    amountAfter(tokens, "Indemnité comp. au SMIC", 1),
    amountAfter(tokens, "ICHCSG", 2),
    amountAfter(tokens, "Aide employeur options MGEN", 2),
    amountAfter(tokens, "Indemnité de caisse", 2),
    amountAfter(tokens, "Transfert primes/points", 2),
  ];
  const present = parts.filter((part): part is number => part !== undefined);
  if (!present.length) return undefined;
  const sum = present.reduce((total, part) => total + part, 0);
  return Math.round(sum * 100) / 100;
}

/** Calibre les deux taux net/brut avec plusieurs bulletins dont les primes
 * varient. Le calcul résout y = fixe × tauxFixe + variable × tauxPrime par
 * moindres carrés. Deux bulletins identiques ne suffisent pas : il faut une
 * variation réelle des primes pour séparer les deux effets. */
type NetRatioRow = { fixed: number; variable: number; netFromGross: number };

/** Ce qu'un bulletin apporte au calcul : la part fixe du brut (traitement,
 *  IFSE, éléments fixes, moins la carence), la part variable (le reste) et
 *  le net ramené au brut (sans le Navigo, retenue des titres repas rajoutée). */
function netRatioRows(readings: PayslipReading[]): NetRatioRow[] {
  return readings.flatMap((reading) => {
    if (
      reading.gross === undefined ||
      reading.baseSalary === undefined ||
      reading.netBeforeTax === undefined
    )
      return [];
    const fixed =
      reading.baseSalary +
      (reading.ifse || 0) +
      (reading.otherFixed || 0) -
      (reading.carenceDay || 0);
    const variable = reading.gross - fixed;
    const netFromGross =
      reading.netBeforeTax -
      (reading.navigo || 0) +
      (reading.mealVoucherDeduction || 0);
    return Number.isFinite(fixed) && Number.isFinite(variable)
      ? [{ fixed, variable, netFromGross }]
      : [];
  });
}

const plausibleRate = (rate: number) => Number.isFinite(rate) && rate >= 40 && rate <= 105;
const roundRate = (rate: number) => Math.round(rate * 100) / 100;

/** Un seul bulletin, ou des bulletins trop semblables, ne séparent pas les
 *  deux taux : on garde alors le rapport des taux de départ (ceux du statut
 *  et du régime), et on les ajuste ensemble pour retrouver le net réel —
 *  exactement sur un bulletin, au plus près sur plusieurs. Le net de la
 *  personne est ainsi suivi dès son premier bulletin, et chaque bulletin
 *  suivant resserre l'ajustement. */
function proportionalNetRatios(rows: NetRatioRow[], fallback: NetRatios) {
  if (!rows.length) return undefined;
  const predicted = rows.map((row) =>
    (row.fixed * fallback.netRatioFixed + row.variable * fallback.netRatioVariable) / 100);
  const numerator = rows.reduce((sum, row, index) => sum + row.netFromGross * predicted[index], 0);
  const denominator = predicted.reduce((sum, value) => sum + value * value, 0);
  if (denominator < 1) return undefined;
  const scale = numerator / denominator;
  const fixed = fallback.netRatioFixed * scale;
  const variable = fallback.netRatioVariable * scale;
  if (!plausibleRate(fixed) || !plausibleRate(variable)) return undefined;
  return { netRatioFixed: roundRate(fixed), netRatioVariable: roundRate(variable) };
}

/** Les deux taux séparés par moindres carrés, quand les bulletins le
 *  permettent (voir calculateNetRatios). */
function separateNetRatios(rows: NetRatioRow[]) {
  if (rows.length < 2) return undefined;
  // Deux mois presque identiques rendent les deux taux mathématiquement
  // séparables en théorie, mais le moindre centime d'arrondi peut alors les
  // fausser fortement. Exiger un écart réel évite d'enregistrer un résultat
  // trompeur ; un mois avec environ une prime de dimanche d'écart suffit.
  const exposureRatios = rows.map((row) => row.variable / row.fixed);
  if (Math.max(...exposureRatios) - Math.min(...exposureRatios) < 0.01)
    return undefined;
  const ff = rows.reduce((sum, row) => sum + row.fixed * row.fixed, 0);
  const fv = rows.reduce((sum, row) => sum + row.fixed * row.variable, 0);
  const vv = rows.reduce((sum, row) => sum + row.variable * row.variable, 0);
  const fy = rows.reduce((sum, row) => sum + row.fixed * row.netFromGross, 0);
  const vy = rows.reduce(
    (sum, row) => sum + row.variable * row.netFromGross,
    0,
  );
  const determinant = ff * vv - fv * fv;
  if (Math.abs(determinant) < 1) return undefined;
  const fixed = ((fy * vv - vy * fv) / determinant) * 100;
  const variable = ((vy * ff - fy * fv) / determinant) * 100;
  if (!plausibleRate(fixed) || !plausibleRate(variable)) return undefined;
  return { netRatioFixed: roundRate(fixed), netRatioVariable: roundRate(variable) };
}

/** Un bulletin mal lu (un montant pris pour un autre, un mauvais mois)
 *  fausserait les deux taux : séparés, ils collent exactement à chaque
 *  bulletin, au faux comme au vrai, et l'erreur retombe sur les mois aux
 *  primes différentes. On écarte donc un bulletin dont le net s'éloigne de
 *  plus de 12 % de ce que donnent les taux de départ du statut, ou, dès
 *  trois bulletins, de plus de 6 % de ce que disent les autres. Un vrai
 *  bulletin reste à quelques points de l'un comme des autres. */
const MAX_GAP_FROM_STATUS = 0.12;
const MAX_GAP_FROM_OTHERS = 0.06;

/** Les positions, dans `readings`, des bulletins écartés du calcul. */
export function incoherentNetRatioReadings(readings: PayslipReading[], fallback?: NetRatios) {
  const rejected = new Set<number>();
  if (!fallback) return rejected;
  const ratios = readings.map((reading) => {
    const row = netRatioRows([reading])[0];
    if (!row) return undefined;
    const predicted = (row.fixed * fallback.netRatioFixed + row.variable * fallback.netRatioVariable) / 100;
    return predicted > 0 ? row.netFromGross / predicted : undefined;
  });
  ratios.forEach((ratio, index) => {
    if (ratio !== undefined && Math.abs(ratio - 1) > MAX_GAP_FROM_STATUS) rejected.add(index);
  });
  const kept = ratios.filter((ratio, index): ratio is number => ratio !== undefined && !rejected.has(index)).sort((a, b) => a - b);
  if (kept.length >= 3) {
    const middle = kept.length / 2;
    const median = kept.length % 2 ? kept[Math.floor(middle)] : (kept[middle - 1] + kept[middle]) / 2;
    ratios.forEach((ratio, index) => {
      if (ratio !== undefined && !rejected.has(index) && Math.abs(ratio / median - 1) > MAX_GAP_FROM_OTHERS) rejected.add(index);
    });
  }
  return rejected;
}

const coherentReadings = (readings: PayslipReading[], fallback?: NetRatios) => {
  const rejected = incoherentNetRatioReadings(readings, fallback);
  return { kept: readings.filter((_, index) => !rejected.has(index)), rejectedCount: rejected.size };
};

/** Les deux taux net avant impôt de la personne, d'après ses bulletins :
 *  séparés dès que deux mois aux primes différentes le permettent, sinon
 *  calés ensemble sur son net à partir des taux de départ (`fallback`,
 *  ceux de son statut), dès le premier bulletin. */
export function calculateNetRatios(readings: PayslipReading[], fallback?: NetRatios) {
  const rows = netRatioRows(coherentReadings(readings, fallback).kept);
  return separateNetRatios(rows) ?? (fallback ? proportionalNetRatios(rows, fallback) : undefined);
}

/** Donne à l'interface les taux obtenus et la raison exacte d'un calcul
 *  encore approché, ou impossible. */
export function inspectNetRatioCalibration(
  allReadings: PayslipReading[],
  fallback?: NetRatios,
): NetRatioCalibration {
  const screened = coherentReadings(allReadings, fallback);
  const readings = screened.kept;
  const usable = readings.filter(
    (reading) =>
      reading.gross !== undefined &&
      reading.baseSalary !== undefined &&
      reading.netBeforeTax !== undefined,
  );
  const missing = (["gross", "baseSalary", "netBeforeTax"] as const).filter(
    (field) => !allReadings.some((reading) => reading[field] !== undefined),
  );
  const rows = netRatioRows(readings);
  const summary = {
    totalCount: allReadings.length,
    usableCount: usable.length,
    missing,
    ...(screened.rejectedCount ? { rejectedCount: screened.rejectedCount } : {}),
  };
  const separate = separateNetRatios(rows);
  if (separate) return { ...summary, rates: separate, reason: "ready" };
  const proportional = fallback ? proportionalNetRatios(rows, fallback) : undefined;
  if (proportional) return { ...summary, rates: proportional, reason: "approximate" };
  if (usable.length < 2) return { ...summary, reason: "need-more-readable" };
  const exposureRatios = rows.map((row) => row.variable / row.fixed);
  return {
    ...summary,
    reason:
      Math.max(...exposureRatios) - Math.min(...exposureRatios) < 0.01
        ? "not-enough-variation"
        : "inconsistent",
  };
}

/** Un taux de dimanche plausible : 54,93 € depuis au moins 2024. Une
 *  revalorisation reste lue telle quelle ; un nombre hors de cette plage
 *  n'est pas un taux, et le compte reste à 0 plutôt que d'être inventé. */
export function isPlausibleSundayRate(rate: number) {
  return Number.isFinite(rate) && rate >= 20 && rate <= 200;
}

/** Le nombre de dimanches de la ligne « Indemnité trav. dom > 10 dim ».
 *
 *  Le premier nombre après le libellé est le taux, le second le montant :
 *  confondre les deux donnerait un compte faux. Le compte se déduit du taux
 *  lu sur la ligne même, pour suivre une revalorisation.
 */
function readSundaysBeyondTen(tokens: string[]): number {
  const expected = normalizedLabel("Indemnité trav. dom > 10 dim");
  const index = tokens.findIndex((token) => normalizedLabel(token) === expected);
  if (index === -1) return 0;
  const rate = parseAmount(tokens[index + 1]);
  const amount = parseAmount(tokens[index + 2]);
  if (rate === undefined || !isPlausibleSundayRate(rate)) return 0;
  if (amount === undefined) return 0;
  return Math.round(Math.abs(amount) / rate);
}

/** Le férié travaillé s'écrit « Indem trav j férié ac public » ou, pour un
 *  rappel groupé, « FERIES DES 08 ET 24 MAI 2026 ». */
function isHolidayLine(label: string) {
  return /^(INDEM TRAV J FERIE|FERIES? D)/.test(normalizedLabel(label));
}

export function readPayslip(tokens: string[]): PayslipReading {
  return {
    gross: amountAfter(tokens, "CUMUL BRUT"),
    netBeforeTax: readNetBeforeTax(tokens),
    baseSalary: amountAfter(tokens, "Traitement de Base"),
    residenceAllowance: amountAfter(tokens, "Indemnité de Résidence", 2),
    ifse: amountAfter(tokens, "IFSE"),
    sundaysBeyondTen: readSundaysBeyondTen(tokens),
    cia: amountAfter(tokens, "CIA", 2),
    navigo: amountAfterPrefix(tokens, "Forfait Navigo", 2),
    // La première ligne « Titres repas » est la retenue ; celle de la part
    // patronale, plus bas, ne compte pas.
    mealVoucherDeduction: magnitude(amountAfterPrefix(tokens, "Titres repas", 2)),
    carenceDay: sumAmountsAfterPrefix(tokens, "Jour de carence", 2),
    carenceDates: carenceDatesFromLabels(
      tokens.filter((token) => normalizedLabel(token).startsWith("JOUR DE CARENCE")),
    ),
    pasRate: readPasRate(tokens),
    // Absente la plupart des mois : aucun férié payé, ce n'est pas un échec de lecture.
    holidayPay: sumLineAmounts(tokens, isHolidayLine) ?? 0,
    sundayFlat: sumLineAmounts(tokens, (label) => normalizedLabel(label).startsWith("INDEM TRAV DOMINICAL REGULIER")),
    ...withExtraLines(readOtherFixed(tokens), readExtraLines(tokens)),
    ...readPeriod(tokens),
  };
}

/** Ajoute aux éléments fixes lus les lignes inconnues régulières. */
export function withExtraLines(otherFixed: number | undefined, extraLines: PayslipExtraLine[] | undefined) {
  const extra = fixedExtraTotal(extraLines);
  return {
    otherFixed: otherFixed === undefined && !extra ? otherFixed : Math.round(((otherFixed || 0) + extra) * 100) / 100,
    ...(extraLines?.length ? { extraLines } : {}),
  };
}
