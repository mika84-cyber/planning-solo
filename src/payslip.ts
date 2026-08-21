/** Lecture d'un bulletin de paie PDF, entièrement dans le navigateur.
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
  /** Ligne « PAS - Taux » : le taux lui-même, pas une assiette — une seule
   *  valeur suit le libellé, contrairement aux lignes de cotisation. */
  pasRate?: number;
  /** Somme des lignes fixes présentes (Indemnité de Résidence, Indemnité comp. au
   *  SMIC, ICHCSG, Aide employeur options MGEN, moins Transfert
   *  primes/points) — la même formule que l'infobulle du champ « Autres
   *  éléments fixes » décrit déjà. Les lignes absentes valent zéro pour le
   *  mois du bulletin. */
  otherFixed?: number;
};

export type NetRatioCalibration = {
  rates?: { netRatioFixed: number; netRatioVariable: number };
  totalCount: number;
  usableCount: number;
  missing: Array<"gross" | "baseSalary" | "netBeforeTax">;
  reason: "ready" | "need-more-readable" | "not-enough-variation" | "inconsistent";
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

export function payCalibrationRegime(
  year: number | undefined,
  month: number | undefined,
): PayCalibrationRegime {
  if (year === undefined || month === undefined) return "culture-psc";
  return year > 2025 || (year === 2025 && month >= 9)
    ? "culture-psc"
    : "pre-culture-psc";
}

export function defaultNetRatiosForPeriod(year: number, month: number) {
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
  const index = tokens.findIndex((token) => token.trim() === label);
  if (index === -1) return undefined;
  return parseAmount(tokens[index + offset]);
}

/** Certaines régularisations portent plusieurs lignes « Jour de carence »
 * sur un même bulletin. Elles doivent toutes être prises en compte. */
function sumAmountsAfterPrefix(
  tokens: string[],
  prefix: string,
  offset: number,
): number | undefined {
  const values = tokens.flatMap((token, index) => {
    if (!token.trim().startsWith(prefix)) return [];
    const value = parseAmount(tokens[index + offset]);
    return value === undefined ? [] : [Math.abs(value)];
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
export function calculateNetRatios(readings: PayslipReading[]) {
  const rows = readings.flatMap((reading) => {
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
  if (
    !Number.isFinite(fixed) ||
    !Number.isFinite(variable) ||
    fixed < 40 ||
    fixed > 105 ||
    variable < 40 ||
    variable > 105
  )
    return undefined;
  return {
    netRatioFixed: Math.round(fixed * 100) / 100,
    netRatioVariable: Math.round(variable * 100) / 100,
  };
}

/** Donne à l'interface la raison exacte d'un calcul encore impossible. */
export function inspectNetRatioCalibration(
  readings: PayslipReading[],
): NetRatioCalibration {
  const usable = readings.filter(
    (reading) =>
      reading.gross !== undefined &&
      reading.baseSalary !== undefined &&
      reading.netBeforeTax !== undefined,
  );
  const missing = (["gross", "baseSalary", "netBeforeTax"] as const).filter(
    (field) => !readings.some((reading) => reading[field] !== undefined),
  );
  const rates = calculateNetRatios(readings);
  if (rates)
    return {
      rates,
      totalCount: readings.length,
      usableCount: usable.length,
      missing,
      reason: "ready",
    };
  if (usable.length < 2)
    return {
      totalCount: readings.length,
      usableCount: usable.length,
      missing,
      reason: "need-more-readable",
    };
  const exposureRatios = usable.map((reading) => {
    const fixed =
      reading.baseSalary! +
      (reading.ifse || 0) +
      (reading.otherFixed || 0) -
      (reading.carenceDay || 0);
    return (reading.gross! - fixed) / fixed;
  });
  return {
    totalCount: readings.length,
    usableCount: usable.length,
    missing,
    reason:
      Math.max(...exposureRatios) - Math.min(...exposureRatios) < 0.01
        ? "not-enough-variation"
        : "inconsistent",
  };
}

/** Le taux qui suit la ligne « Indemnité trav. dom > 10 dim » : fixe depuis
 *  au moins 2024, sur tous les bulletins vus. Il sert d'ancre pour repérer la
 *  ligne sans dépendre de sa position — contrairement au traitement ou à
 *  l'IFSE, cette ligne porte deux nombres (taux puis montant), et confondre
 *  les deux donnerait un compte de dimanches faux. */
const SUNDAY_RATE = 54.93;

/** Le nombre de dimanches de la ligne « Indemnité trav. dom > 10 dim ».
 *
 *  Le premier nombre après le libellé est le taux, toujours 54,93 € ; le
 *  second est le montant, dont le compte se déduit. Si le taux ne vaut pas
 *  54,93 €, la ligne n'est pas celle attendue et le compte reste à 0 plutôt
 *  que de risquer un chiffre faux.
 */
function readSundaysBeyondTen(tokens: string[]): number {
  const index = tokens.findIndex(
    (token) => token.trim() === "Indemnité trav. dom > 10 dim",
  );
  if (index === -1) return 0;
  const rate = Number(tokens[index + 1]?.trim().replace(",", "."));
  const amount = Number(tokens[index + 2]?.trim().replace(",", "."));
  if (!Number.isFinite(rate) || Math.abs(rate - SUNDAY_RATE) > 0.02) return 0;
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount / SUNDAY_RATE);
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
    navigo: amountAfter(tokens, "Forfait  Navigo TZ mensuel", 2),
    mealVoucherDeduction: magnitude(
      amountAfter(tokens, "Titres repas carte", 2),
    ),
    carenceDay: sumAmountsAfterPrefix(tokens, "Jour de carence", 2),
    pasRate: amountAfter(tokens, "PAS - Taux"),
    otherFixed: readOtherFixed(tokens),
    ...readPeriod(tokens),
  };
}
