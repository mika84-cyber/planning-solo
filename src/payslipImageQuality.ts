export type PayslipImageMetrics = {
  width: number;
  height: number;
  meanLuma: number;
  contrast: number;
  sharpness: number;
  edgeDetailRatio: number;
  skewDegrees: number;
};

export type PayslipImageIssue = {
  kind: "resolution" | "dark" | "bright" | "blur" | "crop" | "skew";
  label: string;
  advice: string;
};

export function evaluatePayslipImageQuality(metrics: PayslipImageMetrics): PayslipImageIssue[] {
  const issues: PayslipImageIssue[] = [];
  // Les chiffres d'un bulletin A4 sont petits : sous 2 000 px de large (une
  // photo réduite par une messagerie), un 8 se lit 6 et des montants se
  // perdent, alors qu'une photo de l'appareil (3 000 px et plus) se lit
  // entière, même un peu de travers.
  if (Math.min(metrics.width, metrics.height) < 2000 || metrics.width * metrics.height < 4_000_000)
    issues.push({ kind: "resolution", label: "photo trop petite", advice: "rapprochez-vous et utilisez la résolution normale de l’appareil" });
  if (metrics.meanLuma < 72)
    issues.push({ kind: "dark", label: "photo trop sombre", advice: "ajoutez une lumière diffuse sans ombre sur la feuille" });
  if (metrics.meanLuma > 238 || metrics.contrast < 22)
    issues.push({ kind: "bright", label: "texte trop pâle ou surexposé", advice: "évitez le flash direct et placez la feuille sous une lumière régulière" });
  if (metrics.sharpness < 7.5)
    issues.push({ kind: "blur", label: "photo probablement floue", advice: "stabilisez le téléphone et touchez le texte pour faire la mise au point" });
  if (metrics.edgeDetailRatio > 0.23)
    issues.push({ kind: "crop", label: "bulletin possiblement coupé", advice: "laissez apparaître les quatre bords de chaque feuille" });
  if (Math.abs(metrics.skewDegrees) >= 4)
    issues.push({ kind: "skew", label: `feuille inclinée d’environ ${Math.round(Math.abs(metrics.skewDegrees))}°`, advice: "photographiez-la bien à plat, téléphone parallèle à la feuille" });
  return issues;
}

function estimateSkew(gray: Uint8Array, width: number, height: number) {
  // Le centre de la photo, c'est-à-dire la feuille : la table autour, plus
  // sombre que le papier, compterait sinon comme de l'encre et masquerait
  // l'inclinaison des lignes.
  const left = Math.round(width * 0.15);
  const right = Math.round(width * 0.85);
  const top = Math.round(height * 0.1);
  const bottom = Math.round(height * 0.9);
  let paper = 0;
  let samples = 0;
  for (let y = top; y < bottom; y += 2)
    for (let x = left; x < right; x += 2) {
      paper += gray[y * width + x];
      samples += 1;
    }
  // L'encre se détache du papier, même pâle ou mal éclairé.
  const ink = Math.min(165, (paper / Math.max(1, samples)) * 0.75);
  let bestAngle = 0;
  let bestScore = -1;
  for (let angle = -8; angle <= 8; angle += 1) {
    const slope = Math.tan((angle * Math.PI) / 180);
    const bins = new Uint16Array(height + Math.ceil(width * Math.abs(slope)) + 4);
    const offset = slope < 0 ? Math.ceil(width * -slope) : 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 2) {
        const value = gray[y * width + x];
        if (value > ink) continue;
        const bin = Math.round(y - x * slope + offset);
        if (bin >= 0 && bin < bins.length) bins[bin] += 1;
      }
    }
    let score = 0;
    for (const count of bins) score += count * count;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  return bestAngle;
}

/** La photo en niveaux de gris, réduite : 480 px de côté au plus suffisent
 *  à la juger, sans analyser ses millions de pixels. */
function grayThumbnail(bitmap: ImageBitmap, maxSide = 480) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index += 1) {
    const pixel = index * 4;
    gray[index] = Math.round(pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722);
  }
  return { gray, width, height };
}

/** L'inclinaison des lignes de la photo, en degrés entiers : positive quand
 *  elles descendent vers la droite. Sert à redresser la feuille avant la
 *  lecture. */
export function payslipSkewDegrees(bitmap: ImageBitmap) {
  // À 480 px, les lignes d'un bulletin ne sont plus qu'à 6 px l'une de
  // l'autre et se confondent : l'inclinaison se mesure plus grand.
  const thumbnail = grayThumbnail(bitmap, 1200);
  return thumbnail ? estimateSkew(thumbnail.gray, thumbnail.width, thumbnail.height) : 0;
}

export async function inspectPayslipImage(file: File): Promise<PayslipImageMetrics | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const thumbnail = grayThumbnail(bitmap);
    if (!thumbnail) return null;
    const { gray, width, height } = thumbnail;
    const meanLuma = gray.reduce((sum, luma) => sum + luma, 0) / gray.length;
    let variance = 0;
    let sharpness = 0;
    let sharpnessSamples = 0;
    let edgeDetails = 0;
    let edgeSamples = 0;
    const borderX = Math.max(2, Math.round(width * 0.04));
    const borderY = Math.max(2, Math.round(height * 0.04));
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const value = gray[index];
        variance += (value - meanLuma) ** 2;
        const laplacian = Math.abs(gray[index - 1] + gray[index + 1] + gray[index - width] + gray[index + width] - value * 4);
        sharpness += laplacian;
        sharpnessSamples += 1;
        if (x <= borderX || x >= width - borderX || y <= borderY || y >= height - borderY) {
          edgeSamples += 1;
          if (laplacian > 28) edgeDetails += 1;
        }
      }
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      meanLuma,
      contrast: Math.sqrt(variance / Math.max(1, sharpnessSamples)),
      sharpness: sharpness / Math.max(1, sharpnessSamples),
      edgeDetailRatio: edgeDetails / Math.max(1, edgeSamples),
      skewDegrees: payslipSkewDegrees(bitmap),
    };
  } finally {
    bitmap.close();
  }
}

export async function inspectPayslipPhotos(files: File[]) {
  const reports: Array<{ file: File; issues: PayslipImageIssue[] }> = [];
  for (const file of files) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) continue;
    try {
      const metrics = await inspectPayslipImage(file);
      const issues = metrics ? evaluatePayslipImageQuality(metrics) : [];
      if (issues.length) reports.push({ file, issues });
    } catch {
      // L’OCR conserve sa propre gestion d’erreur si le pré-contrôle est indisponible.
    }
  }
  return reports;
}
