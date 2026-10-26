/**
 * Les décisions prises après la vérification d'un bulletin (« Tout est OK »
 * ou une anomalie signalée), une par mois. Partagé par l'application et par
 * la fonction Netlify qui les garde dans le compte : une vérification faite
 * sur le téléphone se retrouve ainsi sur l'ordinateur.
 */
import type { PayslipReviewCheck } from "./payslipReview";

export type PayslipVerificationStatus = "ok" | "attention";

/** Les montants d'une paie, prévus ou lus sur le bulletin. */
export type PayslipGapFigures = {
  gross?: number;
  netBeforeTax?: number;
  incomeTax?: number;
  net?: number;
};

/** Une étape de l'écart : une ligne qui diffère, ce qui en découle, ou un
 *  reste inexpliqué ; `found` et `expected` gardent ce que la ligne compare. */
export type PayslipGapRecordLine = {
  key: string;
  title: string;
  detail: string;
  amount: number;
  kind: "cause" | "follow" | "unknown";
  found?: number;
  expected?: number;
};

/** L'écart expliqué, gardé avec la décision : un mois accepté prend les
 *  montants du bulletin, et le courrier à la hiérarchie les reprend. */
export type PayslipGapRecord = {
  level: "net" | "gross";
  expected: PayslipGapFigures;
  actual: PayslipGapFigures;
  gap: number;
  lines: PayslipGapRecordLine[];
};

export type PayslipVerificationRecord = {
  status: PayslipVerificationStatus;
  year: number;
  month: number;
  sourceName: string;
  note: string;
  issues: PayslipReviewCheck[];
  unavailableCount: number;
  verifiedCount: number;
  updatedAt: string;
  gap?: PayslipGapRecord;
  /** À qui le courrier s'adresse, quand une anomalie est signalée. */
  recipient?: string;
};

/** Une décision par mois, rangée sous « AAAA-MM ». */
export type PayslipVerificationRecords = Record<string, PayslipVerificationRecord>;

/** Assez pour plusieurs années de bulletins, sans laisser grossir le profil. */
const MAX_RECORDS = 72;
const MAX_ISSUES = 40;
const MAX_GAP_LINES = 24;

export function payslipVerificationPeriodKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const count = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1000, Math.max(0, Math.round(number))) : 0;
};
const amount = (value: unknown) => {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : undefined;
};

function sanitizeIssue(value: unknown): PayslipReviewCheck | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const expected = amount(raw.expected);
  if (expected === undefined) return null;
  const tolerance = amount(raw.tolerance);
  return {
    key: text(raw.key, 60),
    label: text(raw.label, 120),
    found: amount(raw.found),
    expected,
    ...(tolerance === undefined ? {} : { tolerance }),
  };
}

function sanitizeFigures(value: unknown): PayslipGapFigures {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const figures: PayslipGapFigures = {};
  for (const key of ["gross", "netBeforeTax", "incomeTax", "net"] as const) {
    const number = amount(raw[key]);
    if (number !== undefined) figures[key] = number;
  }
  return figures;
}

function sanitizeGapLine(value: unknown): PayslipGapRecordLine | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const lineAmount = amount(raw.amount);
  if (lineAmount === undefined || (raw.kind !== "cause" && raw.kind !== "follow" && raw.kind !== "unknown")) return null;
  const found = amount(raw.found);
  const expected = amount(raw.expected);
  return {
    key: text(raw.key, 60),
    title: text(raw.title, 160),
    detail: text(raw.detail, 300),
    amount: lineAmount,
    kind: raw.kind,
    ...(found === undefined ? {} : { found }),
    ...(expected === undefined ? {} : { expected }),
  };
}

function sanitizeGap(value: unknown): PayslipGapRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const gap = amount(raw.gap);
  if (gap === undefined || !Array.isArray(raw.lines)) return undefined;
  return {
    level: raw.level === "gross" ? "gross" : "net",
    expected: sanitizeFigures(raw.expected),
    actual: sanitizeFigures(raw.actual),
    gap,
    lines: raw.lines.slice(0, MAX_GAP_LINES).map(sanitizeGapLine).filter((line): line is PayslipGapRecordLine => line !== null),
  };
}

/** Ne garde que des décisions bien formées, rangées sous leur propre mois. */
export function sanitizePayslipVerifications(value: unknown): PayslipVerificationRecords {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const records: PayslipVerificationRecords = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || !raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    if (record.status !== "ok" && record.status !== "attention") continue;
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7)) - 1;
    const gap = sanitizeGap(record.gap);
    const recipient = text(record.recipient, 200);
    records[key] = {
      status: record.status,
      year,
      month,
      sourceName: text(record.sourceName, 200),
      note: text(record.note, 1000),
      issues: Array.isArray(record.issues)
        ? record.issues.slice(0, MAX_ISSUES).map(sanitizeIssue).filter((issue): issue is PayslipReviewCheck => issue !== null)
        : [],
      unavailableCount: count(record.unavailableCount),
      verifiedCount: count(record.verifiedCount),
      updatedAt: text(record.updatedAt, 40),
      ...(gap ? { gap } : {}),
      ...(recipient ? { recipient } : {}),
    };
  }
  const keys = Object.keys(records).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_RECORDS))) delete records[key];
  return records;
}

export function payslipVerificationFor(records: PayslipVerificationRecords, year: number, month: number) {
  return records[payslipVerificationPeriodKey(year, month)] ?? null;
}

export function withPayslipVerification(records: PayslipVerificationRecords, record: PayslipVerificationRecord) {
  return { ...records, [payslipVerificationPeriodKey(record.year, record.month)]: record };
}

export function withoutPayslipVerification(records: PayslipVerificationRecords, year: number, month: number) {
  const next = { ...records };
  delete next[payslipVerificationPeriodKey(year, month)];
  return next;
}

/** Deux tables réunies : pour un même mois, la décision la plus récente. */
export function mergePayslipVerifications(first: PayslipVerificationRecords, second: PayslipVerificationRecords) {
  const merged = { ...first };
  for (const [key, record] of Object.entries(second)) {
    const current = merged[key];
    if (!current || record.updatedAt > current.updatedAt) merged[key] = record;
  }
  return merged;
}
