/**
 * La lecture d'une photo de bulletin, d'un bout à l'autre : la photo est
 * préparée, le moteur en rend les fragments de texte à leur place, et la
 * lecture ligne à ligne en tire les montants et leur preuve par le calcul.
 *
 * Chargé à la demande, avec le moteur de reconnaissance, quand une photo
 * est choisie : le reste de l'application n'en porte pas le poids.
 */
import type { PayslipReading } from "./payslip";
import { OCR_RECOGNITION_TIMEOUT_MS, withTimeout, type OcrWorker } from "./payslipOcr";
import { readPayslipOcrText } from "./payslipOcrText";
import { preparePayslipPhoto } from "./payslipPhotoImage";
import type { PhotoLayout } from "./payslipPhotoLayout";
import { betterPageReading, finishPayslipReading, isSurePageReading, readPayslipPhotoLayout } from "./payslipPhotoReading";

export { finishPayslipReading };

/** Le renforcement des contours de la seconde lecture (voir payslipPhotoImage). */
const PAYSLIP_SHARPEN = 1.5;

/** Ce que la lecture a reconnu d'un bulletin : rien du tout, c'est sans
 *  doute une feuille photographiée tête en bas. */
function recognizedNothing(reading: PayslipReading) {
  return reading.month === undefined && reading.gross === undefined && reading.netBeforeTax === undefined && reading.baseSalary === undefined;
}

/** Les fragments de texte d'une photo préparée, chacun à sa place. */
async function recognizeLayout(worker: OcrWorker, canvas: HTMLCanvasElement): Promise<PhotoLayout> {
  const result = await withTimeout(
    worker.recognize(canvas, { rotateAuto: false }, { text: false, blocks: true }),
    OCR_RECOGNITION_TIMEOUT_MS,
    "La photo a pris trop de temps à analyser. Recadrez-la autour du bulletin et réessayez.",
  );
  const fragments = (result.data.blocks || []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        baseline: [line.baseline.x0, line.baseline.y0, line.baseline.x1, line.baseline.y1] as [number, number, number, number],
        words: line.words.map((word) => ({ text: word.text, x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 })),
      }))));
  return { width: canvas.width, height: canvas.height, fragments };
}

/** Une lecture de la photo : préparée d'une certaine façon, puis lue. */
export async function readPayslipPhotoPass(
  file: File,
  worker: OcrWorker,
  options: { halfTurn?: boolean; sharpen?: number } = {},
): Promise<{ reading: PayslipReading; layout: PhotoLayout } | null> {
  const canvas = await withTimeout(preparePayslipPhoto(file, options), 20_000, "Cette photo n’a pas pu être préparée.").catch(() => null);
  if (!canvas) return null;
  const layout = await recognizeLayout(worker, canvas);
  return { reading: readPayslipPhotoLayout(layout), layout };
}

/** La photo d'une page, préparée puis lue. Une feuille tête en bas ne donne
 *  rien : elle est retournée et relue une fois. */
export async function readPayslipPhoto(file: File, worker: OcrWorker): Promise<{ reading: PayslipReading; layout?: PhotoLayout }> {
  const first = await readPayslipPhotoPass(file, worker);
  if (!first) {
    // Le navigateur ne sait pas préparer l'image : le moteur la lit telle quelle.
    const result = await withTimeout(
      worker.recognize(file, { rotateAuto: true }),
      OCR_RECOGNITION_TIMEOUT_MS,
      "La photo a pris trop de temps à analyser. Recadrez-la autour du bulletin et réessayez.",
    );
    return { reading: readPayslipOcrText(result.data.text) };
  }
  let best = first;
  let halfTurn = false;
  if (recognizedNothing(first.reading)) {
    const turned = await readPayslipPhotoPass(file, worker, { halfTurn: true });
    if (!turned || recognizedNothing(turned.reading)) return first;
    best = turned;
    halfTurn = true;
  }
  if (isSurePageReading(best.reading)) return best;
  // Pas sûre : la photo est sans doute un peu floue. Contours renforcés,
  // elle se relit ; la preuve par le calcul départage les deux lectures.
  const sharper = await readPayslipPhotoPass(file, worker, { halfTurn, sharpen: PAYSLIP_SHARPEN });
  return sharper ? { reading: betterPageReading(best.reading, sharper.reading), layout: best.layout } : best;
}
