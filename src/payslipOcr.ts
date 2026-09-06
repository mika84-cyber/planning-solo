import type { PayslipReading } from "./payslip";
import { extractPayslipTokens, readPayslip } from "./payslip";

export const PAYSLIP_FILE_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";
export const PAYSLIP_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
// Environ 170 dpi pour une page A4 : suffisamment précis pour les petites
// lignes d’un bulletin, tout en évitant d’analyser les 12 à 50 Mpx du téléphone.
const MAX_OCR_IMAGE_SIDE = 2000;
const OCR_START_TIMEOUT_MS = 45_000;
const OCR_RECOGNITION_TIMEOUT_MS = 60_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
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

type PreparedPayslipImage = {
  source: File | Blob;
  rotateAuto: boolean;
  fallbackSource?: Blob;
};

async function canvasToPayslipBlob(canvas: HTMLCanvasElement) {
  return withTimeout(
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Image illisible.")),
        "image/jpeg",
        0.92,
      );
    }),
    15_000,
    "Cette photo n’a pas pu être préparée.",
  );
}

async function preparePayslipImage(file: File): Promise<PreparedPayslipImage> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return { source: file, rotateAuto: true };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await withTimeout(
      createImageBitmap(file, { imageOrientation: "from-image" }),
      15_000,
      "Cette photo n’a pas pu être préparée.",
    );
  } catch {
    // Certains navigateurs ne savent pas préparer l’image mais Tesseract peut
    // encore la lire directement.
    return { source: file, rotateAuto: true };
  }

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const ratio = Math.min(1, MAX_OCR_IMAGE_SIDE / longestSide);
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    fullCanvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const fullContext = fullCanvas.getContext("2d");
    if (!fullContext) return { source: file, rotateAuto: true };
    fullContext.fillStyle = "#fff";
    fullContext.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    fullContext.filter = "grayscale(1) contrast(1.25) brightness(1.05)";
    fullContext.drawImage(bitmap, 0, 0, fullCanvas.width, fullCanvas.height);
    const fullSource = await canvasToPayslipBlob(fullCanvas);

    // Sur une photo verticale, une seule image compacte réunit les quatre
    // zones utiles des bulletins : période, rémunération, retenues et net.
    // Les lignes sont plus grandes et l’OCR ignore les zones sans intérêt.
    if (bitmap.height >= bitmap.width * 1.15) {
      const sourceX = bitmap.width * 0.07;
      const sourceWidth = bitmap.width * 0.89;
      const focusedWidth = Math.min(
        1800,
        Math.max(1200, Math.round(sourceWidth * 1.35)),
      );
      const gap = 24;
      const bands = [
        [0.05, 0.18],
        [0.24, 0.43],
        [0.43, 0.69],
        [0.7, 0.83],
      ] as const;
      const heights = bands.map(([from, to]) =>
        Math.round((to - from) * bitmap.height * focusedWidth / sourceWidth));
      const focusedCanvas = document.createElement("canvas");
      focusedCanvas.width = focusedWidth;
      focusedCanvas.height = heights.reduce((sum, height) => sum + height, 0) + gap * 3;
      const focusedContext = focusedCanvas.getContext("2d");
      if (focusedContext) {
        focusedContext.fillStyle = "#fff";
        focusedContext.fillRect(0, 0, focusedCanvas.width, focusedCanvas.height);
        focusedContext.filter = "grayscale(1) contrast(1.35) brightness(1.08)";
        let destinationY = 0;
        bands.forEach(([from, to], index) => {
          focusedContext.drawImage(
            bitmap,
            sourceX,
            bitmap.height * from,
            sourceWidth,
            bitmap.height * (to - from),
            0,
            destinationY,
            focusedWidth,
            heights[index],
          );
          destinationY += heights[index] + gap;
        });
        return {
          source: await canvasToPayslipBlob(focusedCanvas),
          rotateAuto: false,
          fallbackSource: fullSource,
        };
      }
    }

    // createImageBitmap applique l’orientation EXIF et le canvas la fige : le
    // moteur peut donc éviter sa seconde passe d’orientation automatique.
    return { source: fullSource, rotateAuto: false };
  } catch {
    return { source: file, rotateAuto: true };
  } finally {
    bitmap.close();
  }
}

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
    const amounts = amountsIn(lines[index + offset] || "");
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

const OCR_MONTHS = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
];

function readOcrPeriod(text: string) {
  const plain = normalized(text);
  for (let month = 0; month < OCR_MONTHS.length; month++) {
    const match = new RegExp(`\\b${OCR_MONTHS[month]}\\s+(20\\d{2})\\b`).exec(plain);
    if (match) return { month, year: Number(match[1]) };
  }
  return {};
}

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
    lastAmountNear(lines, ["Transfert primes/points"]),
  ].filter((amount): amount is number => amount !== undefined);
  const carence = matchingLineIndexes(lines, ["Jour de carence"])
    .map((index) => amountsIn(lines[index]).at(-1))
    .filter((amount): amount is number => amount !== undefined)
    .reduce((sum, amount) => sum + Math.abs(amount), 0);
  const sundayAmount = lastAmountNear(lines, ["Indemnité trav. dom > 10 dim"]);
  const sundayRate = 54.93;

  return {
    gross: lastAmountNear(lines, ["CUMUL BRUT", "ICUMUL BRUT"]),
    netBeforeTax: lastAmountNear(lines, [
      "NET A PAYER AVANT IMPOT SUR LE REVENU",
      "NET A PAYER AVANT IMPOT",
      "NET AVANT IMPOT",
    ], 3),
    baseSalary: lastAmountNear(lines, ["Traitement de Base"]),
    residenceAllowance,
    ifse: lastAmountNear(lines, ["IFSE"]),
    sundaysBeyondTen:
      sundayAmount !== undefined && Math.abs(sundayAmount) >= sundayRate
        ? Math.max(0, Math.round(Math.abs(sundayAmount) / sundayRate))
        : 0,
    cia: lastAmountNear(lines, ["CIA"]),
    navigo: lastAmountNear(lines, ["Forfait Navigo TZ mensuel"]),
    mealVoucherDeduction: (() => {
      const value = lastAmountNear(lines, ["Titres repas carte"]);
      return value === undefined ? undefined : Math.abs(value);
    })(),
    carenceDay: carence > 0 ? Math.round(carence * 100) / 100 : undefined,
    pasRate: lastAmountNear(lines, ["PAS - Taux", "PAS Taux"]),
    otherFixed: fixedParts.length
      ? Math.round(fixedParts.reduce((sum, amount) => sum + amount, 0) * 100) / 100
      : undefined,
    ...readOcrPeriod(text),
  };
}

export function isPayslipImage(file: File) {
  return file.type.startsWith("image/") || /\.(?:jpe?g|png|webp)$/i.test(file.name);
}

type OcrWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;

async function createPayslipOcrWorker(
  onOcrProgress?: (progress: number) => void,
) {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const workerPromise = createWorker("fra", OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    langPath: "/ocr/lang",
    corePath: "/ocr/core",
    logger: ({ progress, status }) => {
      if (status === "recognizing text") onOcrProgress?.(progress);
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
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
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

  const preparedImage = await preparePayslipImage(file);
  const recognize = async (source: File | Blob, rotateAuto: boolean) => {
    const result = await withTimeout(
      worker.recognize(source, { rotateAuto }),
      OCR_RECOGNITION_TIMEOUT_MS,
      "La photo a pris trop de temps à analyser. Recadrez-la autour du bulletin et réessayez.",
    );
    return readPayslipOcrText(result.data.text);
  };
  const primary = await recognize(preparedImage.source, preparedImage.rotateAuto);
  if (
    primary.gross !== undefined &&
    primary.netBeforeTax !== undefined &&
    primary.baseSalary !== undefined
  ) return primary;
  if (!preparedImage.fallbackSource) return primary;

  const fallback = await recognize(preparedImage.fallbackSource, false);
  const combined = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    if (value !== undefined) Object.assign(combined, { [key]: value });
  }
  return combined;
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
      if (key === "carenceDay") {
        merged.carenceDay = Math.round(((merged.carenceDay || 0) + value) * 100) / 100;
      } else if (merged[key as keyof PayslipReading] === undefined) {
        Object.assign(merged, { [key]: value });
      }
    }
  }
  return merged;
}

/** Lit tout un lot avec un seul worker OCR, puis libère immédiatement sa
 * mémoire. Les photos et leur texte ne sont ni téléversés ni conservés. */
export async function readPayslipFiles(files: File[]): Promise<PayslipFileResult[]> {
  let worker: OcrWorker | undefined;
  const results: PayslipFileResult[] = [];
  try {
    if (files.some(isPayslipImage)) worker = await createPayslipOcrWorker();
    for (const file of files) {
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
    await worker?.terminate();
  }
}
