import type { PayslipExtraLine, PayslipReading } from "./payslip";
import { extractPayslipTokens, readPayslip } from "./payslip";

export const PAYSLIP_FILE_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const OCR_START_TIMEOUT_MS = 45_000;
export const OCR_RECOGNITION_TIMEOUT_MS = 60_000;

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function isPayslipImage(file: File) {
  return file.type.startsWith("image/") || /\.(?:jpe?g|png|webp)$/i.test(file.name);
}

/** Les photos seules : l'appareil photo du téléphone s'ouvre directement. */
export const PAYSLIP_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

/** Un bulletin tient sur deux pages : les rubriques et le cumul brut sur la
 *  première, le net à payer sur la seconde. Une lecture à qui l'une des deux
 *  manque attend l'autre photo. */
export function isIncompletePayslipReading(reading: PayslipReading | undefined) {
  return !reading || reading.gross === undefined || reading.netBeforeTax === undefined || reading.baseSalary === undefined;
}

/** La page qui manque à une lecture incomplète : « 2 » quand le net n'a
 *  pas été lu, « 1 » quand c'est le brut ou le traitement. */
export function missingPayslipPage(reading: PayslipReading | undefined): 1 | 2 {
  return reading && reading.gross !== undefined && reading.baseSalary !== undefined ? 2 : 1;
}

export type OcrWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;

/** Le moteur reste prêt une minute après la dernière photo : la seconde
 *  page d'un bulletin, photographiée juste après la première, se lit sans
 *  attendre qu'il redémarre. Passé ce délai, ou quand l'application passe
 *  en arrière-plan, il libère sa mémoire. */
const OCR_WORKER_IDLE_MS = 60_000;
let idleWorker: { worker: OcrWorker; timer: ReturnType<typeof setTimeout> } | null = null;

async function releaseIdleWorker() {
  const kept = idleWorker;
  idleWorker = null;
  if (!kept) return;
  clearTimeout(kept.timer);
  await kept.worker.terminate().catch(() => undefined);
}

if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void releaseIdleWorker();
  });

async function acquirePayslipOcrWorker() {
  const kept = idleWorker;
  idleWorker = null;
  if (kept) {
    clearTimeout(kept.timer);
    return kept.worker;
  }
  return createPayslipOcrWorker();
}

function keepPayslipOcrWorker(worker: OcrWorker) {
  void releaseIdleWorker();
  idleWorker = {
    worker,
    timer: setTimeout(() => {
      if (idleWorker?.worker === worker) void releaseIdleWorker();
    }, OCR_WORKER_IDLE_MS),
  };
}

/** Qui veut suivre l'avancement de la reconnaissance en cours. */
let progressListener: ((ratio: number) => void) | null = null;

async function createPayslipOcrWorker() {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const workerPromise = createWorker("fra", OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    langPath: "/ocr/lang",
    corePath: "/ocr/core",
    logger: ({ progress, status }) => {
      if (status === "recognizing text") progressListener?.(progress);
    },
  });
  try {
    const worker = await withTimeout(
      workerPromise,
      OCR_START_TIMEOUT_MS,
      "La reconnaissance n’a pas démarré. Rechargez l’application et réessayez.",
    );
    await withTimeout(
      worker.setParameters({
        // Chaque fragment de texte est lu là où il se trouve : les lignes
        // sont reconstituées ensuite, d'après leur place (payslipPhotoLayout).
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        user_defined_dpi: "200",
      }),
      10_000,
      "La reconnaissance n’a pas pu être préparée.",
    );
    return worker;
  } catch (error) {
    void workerPromise.then((worker) => worker.terminate()).catch(() => undefined);
    throw error;
  }
}

async function readPayslipWithWorker(file: File, worker?: OcrWorker) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf)
    return readPayslip(await extractPayslipTokens(await file.arrayBuffer()));
  if (!isPayslipImage(file))
    throw new Error("Choisissez un PDF ou une photo JPG, PNG ou WebP.");
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("Cette photo est trop volumineuse. Choisissez une image de moins de 20 Mo.");
  if (!worker) throw new Error("Le moteur de reconnaissance de la photo n’a pas pu démarrer.");
  // La préparation de la photo et sa lecture ligne à ligne ne se chargent
  // qu'ici, avec le moteur : le reste de l'application n'en porte pas le poids.
  const { readPayslipPhoto } = await import("./payslipPhoto");
  return (await readPayslipPhoto(file, worker)).reading;
}

/** La lecture est-elle prouvée par le calcul ? Le brut est la somme des
 *  lignes de rémunération, et le net se retrouve — par les cotisations, ou
 *  par les totaux du pied de page. Prouvée, elle s'enregistre sans rien
 *  demander. */
export function isProvenPayslipReading(reading: PayslipReading | undefined) {
  const proof = reading?.proof;
  return Boolean(proof && proof.gross === true && (proof.net === true || proof.totals === true));
}

/** Met la dernière main aux pages réunies d'un bulletin photographié :
 *  l'impossible est écarté et la preuve par le calcul se refait sur
 *  l'ensemble (voir payslipPhotoReading). Un PDF n'en a pas besoin. */
export async function finishPayslipPages(reading: PayslipReading): Promise<PayslipReading> {
  if (!reading.rows && reading.totalEarnings === undefined) return reading;
  const { finishPayslipReading } = await import("./payslipPhoto");
  return finishPayslipReading(reading);
}

export type PayslipFileResult = {
  file: File;
  reading?: PayslipReading;
  error?: string;
};

/** Réunit les photos des différentes pages d'un même bulletin. Une valeur
 * reconnue sur l'une des pages complète les autres sans transformer chaque
 * photo en bulletin indépendant. */
export function mergePayslipPageReadings(
  readings: PayslipReading[],
): PayslipReading {
  const periods = new Set(
    readings.flatMap(({ year, month }) =>
      year !== undefined && month !== undefined
        ? [year * 12 + month]
        : [],
    ),
  );
  if (periods.size > 1) {
    throw new Error(
      "Photos de mois différents. Sélectionnez un seul bulletin.",
    );
  }

  const merged: PayslipReading = { sundaysBeyondTen: 0 };
  for (const reading of readings) {
    merged.sundaysBeyondTen = Math.max(
      merged.sundaysBeyondTen,
      reading.sundaysBeyondTen,
    );
    for (const [key, value] of Object.entries(reading)) {
      if (value === undefined || key === "sundaysBeyondTen") continue;
      if (key === "carenceDay" || key === "holidayPay") {
        merged[key] = Math.round(((merged[key] || 0) + (value as number)) * 100) / 100;
      } else if (key === "extraLines") {
        merged.extraLines = [...(merged.extraLines || []), ...(value as PayslipExtraLine[])];
      } else if (key === "carenceDates") {
        // Chaque photo peut porter des arrêts différents : on les réunit.
        merged.carenceDates = [...new Set([...(merged.carenceDates || []), ...(value as string[])])].sort();
      } else if (key === "rows") {
        // Les rubriques viennent de la page qui porte le cumul brut.
        if (!merged.rows || reading.rows!.deductions.length > merged.rows.deductions.length) merged.rows = reading.rows;
      } else if (key === "otherRows") {
        if (!merged.otherRows) merged.otherRows = reading.otherRows;
      } else if (key === "proof") {
        // Refaite sur les pages réunies (finishPayslipPages).
      } else if (merged[key as keyof PayslipReading] === undefined) {
        Object.assign(merged, { [key]: value });
      }
    }
  }
  return merged;
}

/** Lit tout un lot avec un seul worker OCR, gardé prêt une minute pour la
 * page suivante. Les photos et leur texte ne sont ni téléversés ni
 * conservés. */
export async function readPayslipFiles(
  files: File[],
  /** L'avancement : la page en cours (dès 1), leur nombre, sa part faite. */
  onProgress?: (page: number, pages: number, ratio: number) => void,
): Promise<PayslipFileResult[]> {
  let worker: OcrWorker | undefined;
  const results: PayslipFileResult[] = [];
  try {
    if (files.some(isPayslipImage)) {
      onProgress?.(1, files.length, 0);
      worker = await acquirePayslipOcrWorker();
    }
    for (const [index, file] of files.entries()) {
      progressListener = onProgress ? (ratio) => onProgress(index + 1, files.length, ratio) : null;
      progressListener?.(0);
      try {
        results.push({ file, reading: await readPayslipWithWorker(file, worker) });
      } catch (error) {
        results.push({
          file,
          error: error instanceof Error ? error.message : "Fichier illisible.",
        });
      }
    }
    return results;
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Le moteur de reconnaissance de la photo n’a pas pu démarrer.";
    return files.map((file) => ({ file, error: message }));
  } finally {
    progressListener = null;
    // Une photo qui a échoué (délai dépassé, moteur en défaut) ne laisse pas
    // un moteur peut-être encore occupé à la page suivante.
    if (worker && results.some((result) => result.error && isPayslipImage(result.file)))
      await worker.terminate().catch(() => undefined);
    else if (worker) keepPayslipOcrWorker(worker);
  }
}
