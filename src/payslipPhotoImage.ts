/**
 * La préparation d'une photo de bulletin avant la reconnaissance : remise
 * dans le bon sens, redressée, ramenée à une taille où les chiffres se
 * lisent, puis débarrassée de son fond. Le filigrane du papier, l'ombre de
 * la main et l'éclairage inégal disparaissent : il ne reste que l'encre,
 * noire sur blanc.
 *
 * Tout se passe sur l'appareil ; la photo n'est ni envoyée ni conservée.
 */

/** La largeur de la feuille préparée : les chiffres d'un bulletin A4 y font
 *  une vingtaine de pixels de haut, ce que le moteur lit le mieux. */
export const PAYSLIP_PHOTO_WIDTH = 2200;
/** Une photo de téléphone (12 à 50 Mpx) n'est jamais analysée entière. */
const MAX_SOURCE_SIDE = 4000;
/** La vignette qui sert à mesurer le sens et l'inclinaison de la feuille. */
const MEASURE_SIDE = 1100;

type Gray = { data: Uint8Array; width: number; height: number };

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function grayOf(canvas: HTMLCanvasElement): Gray | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8Array(canvas.width * canvas.height);
  // Le canal le plus clair de chaque pixel : un filigrane de couleur pâle
  // (le bleu du papier à en-tête) se confond avec le papier, l'encre noire
  // reste noire.
  for (let index = 0, pixel = 0; index < gray.length; index += 1, pixel += 4)
    gray[index] = Math.max(data[pixel], data[pixel + 1], data[pixel + 2]);
  return { data: gray, width: canvas.width, height: canvas.height };
}

/**
 * Retire le fond : chaque pixel est rapporté à la clarté du papier autour
 * de lui (le 90e centile de son voisinage, lissé). Le papier devient blanc
 * partout, à l'ombre comme sous le filigrane ; l'encre reste sombre.
 */
export function flattenBackground({ data, width, height }: Gray, block = 32): Uint8Array {
  const columns = Math.ceil(width / block);
  const rows = Math.ceil(height / block);
  let paper = new Float32Array(columns * rows);
  const histogram = new Uint16Array(256);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      histogram.fill(0);
      let count = 0;
      const bottom = Math.min(height, (row + 1) * block);
      const right = Math.min(width, (column + 1) * block);
      for (let y = row * block; y < bottom; y += 2)
        for (let x = column * block; x < right; x += 2) {
          histogram[data[y * width + x]] += 1;
          count += 1;
        }
      let level = 255;
      for (let seen = 0; level > 0; level -= 1) {
        seen += histogram[level];
        if (seen >= count * 0.1) break;
      }
      paper[row * columns + column] = level;
    }
  }
  // Deux lissages : le fond varie doucement, sans suivre les lettres.
  for (let pass = 0; pass < 2; pass += 1) {
    const smooth = new Float32Array(paper.length);
    for (let row = 0; row < rows; row += 1)
      for (let column = 0; column < columns; column += 1) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            const y = row + dy;
            const x = column + dx;
            if (y < 0 || x < 0 || y >= rows || x >= columns) continue;
            sum += paper[y * columns + x];
            count += 1;
          }
        smooth[row * columns + column] = sum / count;
      }
    paper = smooth;
  }
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y += 1) {
    const fy = Math.min(rows - 1.001, Math.max(0, y / block - 0.5));
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const upper = y0 * columns;
    const lower = Math.min(rows - 1, y0 + 1) * columns;
    for (let x = 0; x < width; x += 1) {
      const fx = Math.min(columns - 1.001, Math.max(0, x / block - 0.5));
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const x1 = Math.min(columns - 1, x0 + 1);
      const local = (paper[upper + x0] * (1 - tx) + paper[upper + x1] * tx) * (1 - ty)
        + (paper[lower + x0] * (1 - tx) + paper[lower + x1] * tx) * ty;
      // Papier → 255 ; puis l'encre est étirée entre le noir et le blanc.
      const flat = (data[y * width + x] / Math.max(40, local)) * 255;
      const stretched = ((flat - 110) / 115) * 255;
      out[y * width + x] = stretched <= 0 ? 0 : stretched >= 255 ? 255 : stretched;
    }
  }
  return out;
}

/** Renforce les contours : chaque pixel s'écarte de la moyenne de ses
 *  voisins (masque flou), ce qui rend du trait aux chiffres un peu flous. */
function sharpened({ data, width, height }: Gray, amount: number): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y += 1) {
    const up = y > 0 ? y - 1 : y;
    const down = y < height - 1 ? y + 1 : y;
    for (let x = 0; x < width; x += 1) {
      const left = x > 0 ? x - 1 : x;
      const right = x < width - 1 ? x + 1 : x;
      const mean = (data[up * width + left] + data[up * width + x] + data[up * width + right]
        + data[y * width + left] + data[y * width + x] + data[y * width + right]
        + data[down * width + left] + data[down * width + x] + data[down * width + right]) / 9;
      const value = data[y * width + x] + amount * (data[y * width + x] - mean);
      out[y * width + x] = value <= 0 ? 0 : value >= 255 ? 255 : value;
    }
  }
  return out;
}

/** À quel point l'encre se range en lignes pour une pente donnée : la somme
 *  des carrés du nombre de pixels d'encre par ligne. */
function lineScore({ data, width, height }: Gray, slope: number) {
  const left = Math.round(width * 0.1);
  const right = Math.round(width * 0.9);
  const top = Math.round(height * 0.08);
  const bottom = Math.round(height * 0.92);
  const offset = slope < 0 ? Math.ceil(width * -slope) : 0;
  const bins = new Uint32Array(height + Math.ceil(width * Math.abs(slope)) + 4);
  for (let y = top; y < bottom; y += 1)
    for (let x = left; x < right; x += 2) {
      if (data[y * width + x] > 128) continue;
      const bin = Math.round(y - x * slope + offset);
      if (bin >= 0 && bin < bins.length) bins[bin] += 1;
    }
  let score = 0;
  let total = 0;
  for (const count of bins) {
    score += count * count;
    total += count;
  }
  // Rapporté au cas où l'encre serait étalée partout : comparable d'un sens
  // de lecture à l'autre.
  return total ? (score / (total * total)) * (bottom - top) : 0;
}

/** La meilleure pente, en degrés, et son score : au degré près, puis au
 *  quart de degré. */
function bestSkew(gray: Gray) {
  let angle = 0;
  let score = -1;
  const scan = (from: number, to: number, step: number) => {
    for (let candidate = from; candidate <= to + 1e-9; candidate += step) {
      const value = lineScore(gray, Math.tan((candidate * Math.PI) / 180));
      if (value > score) {
        score = value;
        angle = candidate;
      }
    }
  };
  scan(-10, 10, 1);
  const coarse = angle;
  scan(coarse - 0.75, coarse + 0.75, 0.25);
  return { angle, score };
}

function transposed({ data, width, height }: Gray): Gray {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) out[x * height + y] = data[y * width + x];
  return { data: out, width: height, height: width };
}

export type PayslipPhotoPose = {
  /** Quarts de tour à appliquer, dans le sens des aiguilles : 0 ou 1. La
   *  tête en bas ne se voit pas ici : la lecture le dira. */
  quarterTurns: 0 | 1;
  /** Inclinaison des lignes, en degrés : positive quand elles descendent
   *  vers la droite. */
  skew: number;
};

/** Le sens des lignes de la photo et leur inclinaison, mesurés sur une
 *  vignette débarrassée de son fond. */
export function measurePayslipPose(gray: Gray): PayslipPhotoPose {
  const flat: Gray = { ...gray, data: flattenBackground(gray, 16) };
  const upright = bestSkew(flat);
  const sideways = bestSkew(transposed(flat));
  // Des lignes nettement mieux rangées de côté : la feuille est couchée.
  if (sideways.score > upright.score * 1.25) return { quarterTurns: 1, skew: -sideways.angle };
  return { quarterTurns: 0, skew: upright.angle };
}

/**
 * La photo prête à lire : dans le bon sens, redressée, à la bonne taille,
 * sans fond. `halfTurn` la retourne tête en bas, pour une seconde lecture
 * quand la première n'a rien reconnu ; `sharpen` renforce les contours
 * d'une photo un peu floue.
 */
export async function preparePayslipPhoto(file: Blob, { halfTurn = false, sharpen = 0 }: { halfTurn?: boolean; sharpen?: number } = {}): Promise<HTMLCanvasElement | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const sourceScale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bitmap.width, bitmap.height));
    const measureScale = Math.min(1, MEASURE_SIDE / Math.max(bitmap.width, bitmap.height));
    const thumbnail = canvasOf(bitmap.width * measureScale, bitmap.height * measureScale);
    thumbnail.getContext("2d")?.drawImage(bitmap, 0, 0, thumbnail.width, thumbnail.height);
    const thumbnailGray = grayOf(thumbnail);
    const pose = thumbnailGray ? measurePayslipPose(thumbnailGray) : { quarterTurns: 0 as const, skew: 0 };
    const turned = pose.quarterTurns === 1;
    const uprightWidth = (turned ? bitmap.height : bitmap.width) * sourceScale;
    const uprightHeight = (turned ? bitmap.width : bitmap.height) * sourceScale;
    const scale = PAYSLIP_PHOTO_WIDTH / uprightWidth;
    const canvas = canvasOf(uprightWidth * scale, uprightHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(((pose.quarterTurns * 90 + (halfTurn ? 180 : 0) - pose.skew) * Math.PI) / 180);
    const drawWidth = bitmap.width * sourceScale * scale;
    const drawHeight = bitmap.height * sourceScale * scale;
    context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.setTransform(1, 0, 0, 1, 0, 0);
    const gray = grayOf(canvas);
    if (!gray) return null;
    if (sharpen) gray.data = sharpened(gray, sharpen);
    const flat = flattenBackground(gray);
    const image = context.createImageData(canvas.width, canvas.height);
    for (let index = 0, pixel = 0; index < flat.length; index += 1, pixel += 4) {
      image.data[pixel] = image.data[pixel + 1] = image.data[pixel + 2] = flat[index];
      image.data[pixel + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}
