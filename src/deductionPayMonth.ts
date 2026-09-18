/**
 * Mois de paie d'une retenue pour maladie ou pour grève.
 *
 * La paie d'un mois est arrêtée vers le 10 : une absence connue plus tard ne
 * peut plus y être traitée et se retrouve, en général, sur le bulletin du mois
 * suivant. La règle retenue ici suit cette pratique en restant prudente :
 *
 * - une absence est découpée en tranches de jours consécutifs, une par mois ;
 * - une tranche qui s'arrête au plus tard le 10 est retenue le mois même ;
 * - une tranche qui déborde après le 10 est retenue le mois suivant, en
 *   entier : un arrêt du 8 au 14 part donc tout entier sur la paie suivante.
 *
 * « En général » seulement : le bulletin de mars 2024 porte une carence du
 * 20 mars. Chaque tranche peut donc être rattachée à un autre mois, soit à la
 * main, soit automatiquement quand un bulletin importé nomme l'arrêt. La
 * correction est rangée sous la clé de la tranche, « type:premier-jour ».
 */

export type DeductionType = "sick" | "strike";

/** Clé de tranche (« sick:2026-09-15 ») → mois de paie (« 2026-10 »). */
export type DeductionPayMonths = Record<string, string>;

export type DeductionSlice = {
  type: DeductionType;
  key: string;
  from: string;
  to: string;
  dates: string[];
  /** Mois de paie donné par la règle du 10, au format « AAAA-MM ». */
  ruleMonth: string;
  /** Mois de paie retenu : la correction enregistrée, sinon la règle. */
  payMonth: string;
  overridden: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const KEY_PATTERN = /^(?:sick|strike):\d{4}-\d{2}-\d{2}$/;

/** Jour de paie arrêté : une tranche qui le dépasse change de mois. */
export const PAY_CUTOFF_DAY = 10;

export function isDeductionKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value);
}

export function isPayMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

export function deductionKey(type: DeductionType, from: string) {
  return `${type}:${from}`;
}

/** « 2026-09 » pour l'année 2026 et le mois 8 (septembre, compté depuis 0). */
export function payMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Le mois qui suit « AAAA-MM », décembre passant à janvier suivant. */
export function nextPayMonth(month: string) {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, "0")}`;
}

/** Le mois qui précède « AAAA-MM », janvier passant à décembre précédent. */
export function previousPayMonth(month: string) {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  return index === 1 ? `${year - 1}-12` : `${year}-${String(index - 1).padStart(2, "0")}`;
}

/** Mois de paie d'une tranche selon la règle du 10, d'après son dernier jour. */
export function rulePayMonth(lastDate: string) {
  const month = lastDate.slice(0, 7);
  return Number(lastDate.slice(8, 10)) > PAY_CUTOFF_DAY ? nextPayMonth(month) : month;
}

function followingDate(date: string) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Tranches d'une absence : jours consécutifs, jamais à cheval sur deux mois. */
export function deductionSlices(
  type: DeductionType,
  dates: Iterable<string>,
  payMonths: DeductionPayMonths = {},
): DeductionSlice[] {
  const sorted = [...new Set(dates)].filter((date) => DATE_PATTERN.test(date)).sort();
  const runs: string[][] = [];
  for (const date of sorted) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (run && last && followingDate(last) === date && last.slice(0, 7) === date.slice(0, 7))
      run.push(date);
    else runs.push([date]);
  }
  return runs.map((run) => {
    const from = run[0];
    const to = run[run.length - 1];
    const key = deductionKey(type, from);
    const ruleMonth = rulePayMonth(to);
    const saved = payMonths[key];
    const overridden = isPayMonth(saved) && saved !== ruleMonth;
    return {
      type,
      key,
      from,
      to,
      dates: run,
      ruleMonth,
      payMonth: overridden ? saved : ruleMonth,
      overridden,
    };
  });
}

/** Les corrections encore utiles : une clé revenue à la règle est oubliée. */
export function withDeductionPayMonth(
  payMonths: DeductionPayMonths | undefined,
  slice: Pick<DeductionSlice, "key" | "ruleMonth">,
  payMonth: string | null,
): DeductionPayMonths {
  const next = { ...(payMonths || {}) };
  if (!payMonth || payMonth === slice.ruleMonth) delete next[slice.key];
  else next[slice.key] = payMonth;
  return next;
}

/** Rattache à la paie de chaque bulletin les arrêts que ses lignes « Jour de
 *  carence » nomment. Une carence porte la date du premier jour de l'arrêt :
 *  l'arrêt enregistré qui commence ce jour-là est donc celui que ce bulletin
 *  a retenu, quoi qu'en dise la règle du 10. Une carence sans arrêt
 *  enregistré n'est rattachée à rien (le contrôle du bulletin la signale). */
export function attachCarencesToPayslips(
  sickDates: Iterable<string>,
  readings: Array<{ year?: number; month?: number; carenceDates?: string[] }>,
  payMonths: DeductionPayMonths | undefined,
) {
  let next = payMonths;
  const attached: Array<{ slice: DeductionSlice; payMonth: string }> = [];
  const slices = deductionSlices("sick", sickDates, payMonths);
  for (const reading of readings) {
    if (reading.year === undefined || reading.month === undefined) continue;
    const payMonth = payMonthKey(reading.year, reading.month);
    for (const date of reading.carenceDates ?? []) {
      const slice = slices.find((candidate) => candidate.from === date);
      if (!slice || slice.payMonth === payMonth) continue;
      next = withDeductionPayMonth(next, slice, payMonth);
      attached.push({ slice, payMonth });
    }
  }
  return { payMonths: next, attached };
}

/** Nettoie une table reçue du serveur ou d'une sauvegarde. */
export function sanitizeDeductionPayMonths(value: unknown): DeductionPayMonths {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: DeductionPayMonths = {};
  for (const [key, month] of Object.entries(value as Record<string, unknown>).slice(0, 500))
    if (isDeductionKey(key) && isPayMonth(month)) clean[key] = month;
  return clean;
}

/** « octobre 2026 » pour « 2026-10 ». */
export function payMonthLabel(month: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-15T12:00:00Z`));
}

/** « de septembre 2026 », « d’octobre 2026 ». */
export function ofPayMonth(month: string) {
  const label = payMonthLabel(month);
  return /^[aeiouâéè]/i.test(label) ? `d’${label}` : `de ${label}`;
}

const dayAndMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

/** « Grève du 15 septembre », « Arrêt maladie du 8 au 14 septembre » : une
 *  tranche ne chevauche jamais deux mois, le mois n'est donc écrit qu'une fois. */
export function deductionSliceLabel(slice: Pick<DeductionSlice, "type" | "from" | "to">) {
  const noun = slice.type === "sick" ? "Arrêt maladie" : "Grève";
  const from = new Date(`${slice.from}T12:00:00Z`);
  if (slice.from === slice.to) return `${noun} du ${dayAndMonth.format(from)}`;
  return `${noun} du ${from.getUTCDate()} au ${dayAndMonth.format(new Date(`${slice.to}T12:00:00Z`))}`;
}
