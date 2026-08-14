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
  /** Ligne « Traitement de Base ». */
  baseSalary?: number;
  /** Ligne « IFSE ». */
  ifse?: number;
  /** Mois du bulletin, lu sur l'en-tête « Juin 2026 ». */
  month?: number;
  year?: number;
  /** Nombre de dimanches indemnisés au-delà du dixième, ligne « Indemnité
   *  trav. dom > 10 dim ». Vaut 0 quand la ligne est absente — la plupart des
   *  mois n'en portent pas, ce n'est pas un échec de lecture. */
  sundaysBeyondTen: number;
};

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

/** Le premier nombre écrit après un libellé donné.
 *
 *  Les lignes du bulletin n'ont pas toutes le même nombre de colonnes : celles
 *  qui portent une assiette en ont deux, les autres une seule. Seuls les trois
 *  libellés lus ici ont leur montant en première position dans les deux cas,
 *  ce qui rend la lecture sûre sans modéliser la mise en page.
 */
function amountAfter(tokens: string[], label: string): number | undefined {
  const index = tokens.findIndex((token) => token.trim() === label);
  if (index === -1) return undefined;
  const next = tokens[index + 1]?.trim().replace(",", ".");
  if (!next || !NUMBER.test(next)) return undefined;
  return Number(next);
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
    baseSalary: amountAfter(tokens, "Traitement de Base"),
    ifse: amountAfter(tokens, "IFSE"),
    sundaysBeyondTen: readSundaysBeyondTen(tokens),
    ...readPeriod(tokens),
  };
}
