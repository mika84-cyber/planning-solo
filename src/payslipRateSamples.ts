/**
 * Les montants d'un bulletin vérifié qui servent à affiner les deux taux
 * net avant impôt (traitement et primes, voir calculateNetRatios), un
 * bulletin par mois. Gardés dans le compte : un bulletin vérifié aujourd'hui
 * et un autre vérifié lors d'une prochaine visite se complètent, au lieu
 * d'exiger les deux dans la même visite.
 *
 * Jamais le fichier ni son texte : seulement les quelques montants du calcul.
 * Partagé par l'application et par la fonction Netlify qui les garde.
 */
import type { PayslipReading } from "./payslip";

export type PayslipRateSample = {
  year: number;
  month: number;
  gross: number;
  netBeforeTax: number;
  baseSalary: number;
  ifse?: number;
  otherFixed?: number;
  carenceDay?: number;
  navigo?: number;
  mealVoucherDeduction?: number;
};

/** Un bulletin par mois, rangé sous « AAAA-MM ». */
export type PayslipRateSamples = Record<string, PayslipRateSample>;

/** Deux ans de bulletins : bien assez pour le calcul, sans laisser grossir
 *  le profil. Les plus anciens laissent la place aux nouveaux. */
const MAX_SAMPLES = 24;
const MAX_AMOUNT = 1_000_000;

const OPTIONAL_FIELDS = ["ifse", "otherFixed", "carenceDay", "navigo", "mealVoucherDeduction"] as const;

function periodKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Un montant au centime près ; `undefined` s'il n'en est pas un. */
function amount(value: unknown, positive = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_AMOUNT) return undefined;
  if (positive && value <= 0) return undefined;
  return Math.round(value * 100) / 100;
}

/** Les montants utiles d'un bulletin lu ; `null` s'il n'en porte pas assez
 *  (mois, cumul brut, traitement et net avant impôt) pour le calcul. */
export function payslipRateSampleFromReading(reading: PayslipReading): PayslipRateSample | null {
  const { year, month } = reading;
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if ((year as number) < 2000 || (year as number) > 2100 || (month as number) < 0 || (month as number) > 11) return null;
  const gross = amount(reading.gross, true);
  const netBeforeTax = amount(reading.netBeforeTax, true);
  const baseSalary = amount(reading.baseSalary, true);
  if (gross === undefined || netBeforeTax === undefined || baseSalary === undefined) return null;
  const sample: PayslipRateSample = { year: year as number, month: month as number, gross, netBeforeTax, baseSalary };
  for (const field of OPTIONAL_FIELDS) {
    const value = amount(reading[field]);
    if (value !== undefined) sample[field] = value;
  }
  return sample;
}

/** Ne garde que des bulletins bien formés, rangés sous leur propre mois,
 *  les plus récents d'abord quand il faut en laisser. */
export function sanitizePayslipRateSamples(value: unknown): PayslipRateSamples {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const samples: PayslipRateSamples = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || !raw || typeof raw !== "object") continue;
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7)) - 1;
    const sample = payslipRateSampleFromReading({
      ...(raw as Partial<PayslipReading>),
      year,
      month,
      sundaysBeyondTen: 0,
    });
    if (sample) samples[key] = sample;
  }
  const keys = Object.keys(samples).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SAMPLES))) delete samples[key];
  return samples;
}

/** Les bulletins lus, rangés sous leur mois ; ceux qui ne servent pas au
 *  calcul sont laissés de côté. */
export function payslipRateSamplesFromReadings(readings: PayslipReading[]): PayslipRateSamples {
  const samples: PayslipRateSamples = {};
  for (const reading of readings) {
    const sample = payslipRateSampleFromReading(reading);
    if (sample) samples[periodKey(sample.year, sample.month)] = sample;
  }
  return samples;
}

/** Les bulletins déjà gardés, puis les nouveaux : pour un même mois, le
 *  dernier bulletin vérifié remplace l'ancien. */
export function mergePayslipRateSamples(stored: unknown, added: unknown): PayslipRateSamples {
  return sanitizePayslipRateSamples({
    ...sanitizePayslipRateSamples(stored),
    ...sanitizePayslipRateSamples(added),
  });
}

/** Un bulletin gardé, sous la forme d'une lecture prête pour le calcul. */
export function readingFromPayslipRateSample(sample: PayslipRateSample): PayslipReading {
  return { ...sample, sundaysBeyondTen: 0 };
}

type NamedReading = { name: string; reading: PayslipReading };

/** Les bulletins gardés dans le compte, puis ceux lus pendant cette visite :
 *  un même mois ne compte qu'une fois, la lecture la plus récente
 *  l'emporte. Un bulletin sans mois reconnu reste à part, sous son nom. */
export function combinePayslipRateReadings<T extends NamedReading>(
  stored: PayslipRateSamples | undefined,
  session: T[],
): Array<T | NamedReading> {
  const byPeriod = new Map<string, T | NamedReading>();
  for (const [key, sample] of Object.entries(sanitizePayslipRateSamples(stored)).sort(([a], [b]) => a.localeCompare(b))) {
    byPeriod.set(key, { name: `Bulletin ${key}`, reading: readingFromPayslipRateSample(sample) });
  }
  for (const item of session) {
    const { year, month } = item.reading;
    byPeriod.set(year !== undefined && month !== undefined ? periodKey(year, month) : `file-${item.name}`, item);
  }
  return Array.from(byPeriod.values());
}
