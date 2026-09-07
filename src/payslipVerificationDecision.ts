import type { PayslipReviewCheck } from "./payslipReview";

export type PayslipVerificationStatus = "ok" | "attention";

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
};

type StoredRecords = Record<string, PayslipVerificationRecord>;

export function payslipVerificationPeriodKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function storageKey(accountId: string) {
  return `planning:payslip-verifications-v1:${accountId.trim().toLowerCase() || "local"}`;
}

function readRecords(accountId: string): StoredRecords {
  if (typeof localStorage === "undefined") return {};
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(accountId)) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function loadPayslipVerification(accountId: string, year: number, month: number) {
  const record = readRecords(accountId)[payslipVerificationPeriodKey(year, month)];
  if (!record || (record.status !== "ok" && record.status !== "attention")) return null;
  return record;
}

export function savePayslipVerification(accountId: string, record: PayslipVerificationRecord) {
  if (typeof localStorage === "undefined") return;
  const records = readRecords(accountId);
  records[payslipVerificationPeriodKey(record.year, record.month)] = record;
  localStorage.setItem(storageKey(accountId), JSON.stringify(records));
}

export function payslipAnomalyReportLines(record: PayslipVerificationRecord) {
  const lines = [
    `Bulletin : ${record.sourceName || "fichier non précisé"}`,
    `Lignes vérifiées : ${record.verifiedCount}`,
    `Lignes non vérifiables : ${record.unavailableCount}`,
  ];
  for (const issue of record.issues) {
    const found = issue.found === undefined ? "non lu" : String(issue.found).replace(".", ",");
    const expected = String(issue.expected).replace(".", ",");
    lines.push(`${issue.label} — bulletin : ${found} ; attendu : ${expected}`);
  }
  if (record.note.trim()) lines.push(`Observation : ${record.note.trim()}`);
  return lines;
}

export async function createPayslipAnomalyPdf(record: PayslipVerificationRecord, monthLabel: string) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const title = `Anomalies du bulletin — ${monthLabel} ${record.year}`;
  document.setFont("helvetica", "bold");
  document.setFontSize(17);
  document.text(title, 18, 22);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.setTextColor(80, 91, 107);
  document.text(`Compte rendu enregistré le ${new Date(record.updatedAt).toLocaleDateString("fr-FR")}`, 18, 30);
  document.setTextColor(22, 37, 56);
  let y = 42;
  for (const line of payslipAnomalyReportLines(record)) {
    const wrapped = document.splitTextToSize(line, 174) as string[];
    if (y + wrapped.length * 6 > 280) {
      document.addPage();
      y = 20;
    }
    document.text(wrapped, 18, y);
    y += wrapped.length * 6 + 3;
  }
  document.setFontSize(8.5);
  document.setTextColor(100, 110, 124);
  document.text("Document préparé dans Planning Solo. À vérifier avant transmission.", 18, 290);
  return document.output("blob");
}

export function payslipAnomalyPdfName(record: PayslipVerificationRecord) {
  return `anomalies-bulletin-${payslipVerificationPeriodKey(record.year, record.month)}.pdf`;
}
