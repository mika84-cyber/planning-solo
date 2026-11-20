/**
 * La mise en page d'une photo de bulletin : les fragments de texte que la
 * reconnaissance a trouvés, chacun à sa place, remis en lignes.
 *
 * Une feuille photographiée n'est jamais plane : pliée en deux, tenue à la
 * main, elle penche d'un côté en haut et de l'autre en bas. Lue comme un
 * bloc de texte, ses lignes se mélangent (le montant d'une rubrique passe
 * sur la suivante) et les cases du pied de page se perdent. On lit donc
 * chaque fragment séparément, puis on reconstitue les lignes en suivant la
 * pente de chacune, de gauche à droite.
 *
 * Tout est calcul : aucun accès au navigateur, et rien n'est conservé.
 */

/** Un mot reconnu, avec sa boîte en pixels. */
export type PhotoWord = { text: string; x0: number; y0: number; x1: number; y1: number };

/** Un fragment d'un seul tenant (un libellé, un montant) et sa ligne de
 *  base : [x0, y0, x1, y1]. */
export type PhotoFragment = { baseline: [number, number, number, number]; words: PhotoWord[] };

export type PhotoLayout = { width: number; height: number; fragments: PhotoFragment[] };

/** Un fragment prêt à être rangé : sa boîte, sa ligne de base à gauche et à
 *  droite, et sa pente quand il est assez long pour en donner une. */
export type PhotoPiece = {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Hauteur d'un mot (médiane), repère de toutes les tolérances. */
  height: number;
  baseLeft: number;
  baseRight: number;
  slope?: number;
  /** Ses mots, un à un : une case du pied de page se repère par les siens. */
  words: PhotoWord[];
};

export type PhotoRow = { text: string; pieces: PhotoPiece[] };

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

/** Une pente au-delà de 12° n'est pas celle d'une ligne de bulletin. */
const MAX_SLOPE = 0.21;

/** Un mot qui porte au moins une lettre ou un chiffre : le reste (tirets du
 *  tableau, taches du papier) ne dit rien de la ligne. */
const hasContent = (text: string) => /[A-Za-zÀ-ÿ0-9]/.test(text);

function pieceOf(fragment: PhotoFragment): PhotoPiece | null {
  let words = fragment.words.filter((word) => word.text.trim() && word.x1 > word.x0 && word.y1 > word.y0);
  // Les débris en tête et en queue du fragment en faussent la boîte.
  while (words.length && !hasContent(words[0].text)) words = words.slice(1);
  while (words.length && !hasContent(words[words.length - 1].text)) words = words.slice(0, -1);
  if (!words.length) return null;
  const solid = words.filter((word) => hasContent(word.text));
  const x0 = Math.min(...words.map((word) => word.x0));
  const x1 = Math.max(...words.map((word) => word.x1));
  const y0 = Math.min(...solid.map((word) => word.y0));
  const y1 = Math.max(...solid.map((word) => word.y1));
  const height = median(solid.map((word) => word.y1 - word.y0));
  const [bx0, by0, bx1, by1] = fragment.baseline;
  const run = bx1 - bx0;
  const rawSlope = run > 0 ? (by1 - by0) / run : 0;
  // Un fragment court (un montant) ne donne pas de pente fiable.
  const slope = x1 - x0 >= height * 6 && Math.abs(rawSlope) <= MAX_SLOPE ? rawSlope : undefined;
  const at = (x: number) => by0 + rawSlope * (x - bx0);
  // Le bas des mots : la ligne de base, à une jambe de lettre près.
  const bottom = median(solid.map((word) => word.y1));
  // Une ligne de base loin du bas des mots est une erreur du moteur (un
  // débris l'a tirée) : on prend alors le bas des mots.
  const trusted = run > 0 && Math.abs(rawSlope) <= MAX_SLOPE && Math.abs(at((x0 + x1) / 2) - bottom) <= height * 0.4;
  const centre = trusted ? at((x0 + x1) / 2) : bottom;
  const lean = slope ?? 0;
  return {
    text: words.map((word) => word.text.trim()).join(" "),
    x0,
    x1,
    y0,
    y1,
    height,
    baseLeft: centre - lean * ((x1 - x0) / 2),
    baseRight: centre + lean * ((x1 - x0) / 2),
    slope,
    words,
  };
}

type OpenRow = { pieces: PhotoPiece[]; x1: number; base: number; slope: number; height: number; ownSlope: boolean };

/** La pente de la ligne : celle de son plus long fragment, puis celle qui
 *  relie ses fragments dès qu'ils s'étalent assez. */
function refreshSlope(row: OpenRow, pageSlope: number) {
  const first = row.pieces[0];
  const last = row.pieces[row.pieces.length - 1];
  const span = last.x1 - first.x0;
  if (row.pieces.length >= 2 && span >= first.height * 12) {
    row.slope = (last.baseRight - first.baseLeft) / span;
    row.ownSlope = true;
    return;
  }
  const longest = row.pieces.reduce<PhotoPiece | null>((best, piece) =>
    piece.slope !== undefined && (!best || piece.x1 - piece.x0 > best.x1 - best.x0) ? piece : best, null);
  row.slope = longest?.slope ?? pageSlope;
  row.ownSlope = Boolean(longest);
}

/**
 * Les lignes de la photo, de haut en bas, chacune lue de gauche à droite.
 * Un fragment rejoint la ligne dont le prolongement passe par lui ; sinon il
 * en ouvre une nouvelle.
 */
export function photoRows(layout: PhotoLayout): PhotoRow[] {
  const found = layout.fragments.map(pieceOf).filter((piece): piece is PhotoPiece => piece !== null);
  // Une tache du papier lue comme deux ou trois lettres géantes : elle
  // dépasse de loin la hauteur du texte, et romprait la ligne qu'elle touche.
  const textHeight = median(found.map((piece) => piece.height));
  const pieces = found
    .filter((piece) => !(piece.height > textHeight * 2.2 && piece.text.length <= 4))
    .sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  const pageSlope = median(pieces.flatMap((piece) => piece.slope === undefined ? [] : [piece.slope]));
  const rows: OpenRow[] = [];
  for (const piece of pieces) {
    let best: OpenRow | undefined;
    let bestGap = Infinity;
    for (const row of rows) {
      const distance = piece.x0 - row.x1;
      // Deux fragments d'une même ligne ne se chevauchent pas.
      if (distance < -Math.min(piece.height, row.height) * 0.5) continue;
      const predicted = row.base + row.slope * distance;
      const gap = Math.abs(piece.baseLeft - predicted);
      // La tolérance grandit avec la distance : la pente n'est connue qu'à
      // un demi-degré près, davantage quand la ligne n'a pas la sienne.
      const tolerance = Math.min(piece.height, row.height) * 0.55 + Math.max(0, distance) * (row.ownSlope ? 0.008 : 0.016);
      if (gap <= tolerance && gap < bestGap) {
        best = row;
        bestGap = gap;
      }
    }
    if (best) {
      best.pieces.push(piece);
      best.x1 = piece.x1;
      best.base = piece.baseRight;
      best.height = median(best.pieces.map((item) => item.height));
      refreshSlope(best, pageSlope);
    } else {
      const row: OpenRow = { pieces: [piece], x1: piece.x1, base: piece.baseRight, slope: pageSlope, height: piece.height, ownSlope: false };
      refreshSlope(row, pageSlope);
      rows.push(row);
    }
  }
  // Des montants restés seuls, à la hauteur d'une rubrique qui n'en a pas :
  // un pli ou une tache a rompu la ligne, on la recolle.
  const numbersOnly = (row: OpenRow) => row.pieces.every((piece) => !/[A-Za-zÀ-ÿ]{2,}/.test(piece.text)) && row.pieces.some((piece) => /\d[.,]\d{2}/.test(piece.text));
  const lacksNumbers = (row: OpenRow) => /^\W*(?:\d{1,2}\/\d{4}\W+)?(?:[RC]\W+)?\d{3}[.,]\d{2}\b/.test(row.pieces.map((piece) => piece.text).join(" "))
    && !row.pieces.slice(1).some((piece) => /\d[.,]\d{2}(?!\d)/.test(piece.text)) && !/\d[.,]\d{2}\s*$/.test(row.pieces[0].text);
  for (const orphan of rows.filter(numbersOnly)) {
    const first = orphan.pieces[0];
    const host = rows
      // Après le libellé de la rubrique (une tache a pu s'y glisser entre eux).
      .filter((row) => row !== orphan && lacksNumbers(row) && row.pieces[0].x1 <= first.x0 + first.height)
      .map((row) => ({ row, gap: Math.abs(first.baseLeft - (row.base + row.slope * (first.x0 - row.x1))) }))
      .filter(({ row, gap }) => gap <= Math.max(first.height, row.height) * 1.1)
      .sort((a, b) => a.gap - b.gap)[0]?.row;
    if (!host) continue;
    host.pieces.push(...orphan.pieces);
    host.x1 = orphan.x1;
    orphan.pieces = [];
  }
  // De haut en bas : la hauteur de chaque ligne ramenée au milieu de la page.
  const middle = layout.width / 2;
  const heightAtMiddle = (row: OpenRow) => row.pieces[0].baseLeft + row.slope * (middle - row.pieces[0].x0);
  return rows
    .filter((row) => row.pieces.length)
    .sort((a, b) => heightAtMiddle(a) - heightAtMiddle(b))
    .map((row) => ({ text: row.pieces.map((piece) => piece.text).join(" "), pieces: row.pieces }));
}

/** Le texte de la photo, ligne à ligne, comme le lirait un œil. */
export function photoText(layout: PhotoLayout) {
  return photoRows(layout).map((row) => row.text).join("\n");
}
