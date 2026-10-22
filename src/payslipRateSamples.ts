/**
 * Les montants d'un bulletin vérifié qui servent à affiner les deux taux
 * net avant impôt (traitement et primes, voir calculateNetRatios), un
 * bulletin par mois. Gardés dans le compte : un bulletin vérifié aujourd'hui
 * et un autre vérifié lors d'une prochaine visite se complètent, au lieu
 * d'exiger les deux dans la même visite.
 *
 * Jamais le fichier ni son texte : seulement les quelques montants du calcul.
 * Partagé par l'application et par la fonction Netlify qui les garde. Écrit
 * sobrement : il fait partie du chargement initial.
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
/** Les trois premiers sont indispensables au calcul, et jamais nuls. */
const FIELDS = ["gross", "netBeforeTax", "baseSalary", "ifse", "otherFixed", "carenceDay", "navigo", "mealVoucherDeduction"] as const;

const periodKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`;

/** Les montants utiles d'un bulletin lu, au centime ; `null` s'il n'en porte
 *  pas assez (mois, cumul brut, net avant impôt, traitement) pour le calcul. */
export function payslipRateSampleFromReading({ year, month, ...reading }: PayslipReading): PayslipRateSample | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || year! < 2000 || year! > 2100 || month! < 0 || month! > 11) return null;
  const sample: Record<string, number> = { year: year!, month: month! };
  for (const [index, field] of FIELDS.entries()) {
    const value = reading[field];
    if (typeof value === "number" && Math.abs(value) <= 1e6 && (index > 2 || value > 0))
      sample[field] = Math.round(value * 100) / 100;
    else if (index < 3) return null;
  }
  return sample as PayslipRateSample;
}

/** Ne garde que des bulletins bien formés, rangés sous leur propre mois,
 *  les plus récents quand il faut en laisser. */
export function sanitizePayslipRateSamples(value: unknown): PayslipRateSamples {
  const samples: PayslipRateSamples = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return samples;
  for (const [period, raw] of Object.entries(value)) {
    const sample = /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && raw && typeof raw === "object"
      ? payslipRateSampleFromReading({ ...raw, year: +period.slice(0, 4), month: +period.slice(5) - 1, sundaysBeyondTen: 0 })
      : null;
    if (sample) samples[period] = sample;
  }
  for (const period of Object.keys(samples).sort().slice(0, -MAX_SAMPLES)) delete samples[period];
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
export const mergePayslipRateSamples = (stored: unknown, added: unknown) =>
  sanitizePayslipRateSamples({ ...sanitizePayslipRateSamples(stored), ...sanitizePayslipRateSamples(added) });

type NamedReading = { name: string; reading: PayslipReading };

/** Les bulletins gardés dans le compte, puis ceux lus pendant cette visite :
 *  un même mois ne compte qu'une fois, la lecture la plus récente
 *  l'emporte. Un bulletin sans mois reconnu reste à part, sous son nom. */
export function combinePayslipRateReadings<T extends NamedReading>(
  stored: PayslipRateSamples | undefined,
  session: T[],
): Array<T | NamedReading> {
  const byPeriod = new Map<string, T | NamedReading>();
  const kept = sanitizePayslipRateSamples(stored);
  for (const period of Object.keys(kept).sort())
    byPeriod.set(period, { name: `Bulletin ${period}`, reading: { ...kept[period], sundaysBeyondTen: 0 } });
  for (const item of session) {
    const { year, month } = item.reading;
    byPeriod.set(year !== undefined && month !== undefined ? periodKey(year, month) : `file-${item.name}`, item);
  }
  return Array.from(byPeriod.values());
}
