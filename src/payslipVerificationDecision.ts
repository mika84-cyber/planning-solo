import {
  payslipVerificationPeriodKey,
  sanitizePayslipVerifications,
  type PayslipVerificationRecord,
  type PayslipVerificationRecords,
} from "./payslipVerificationRecords";

export {
  payslipVerificationPeriodKey,
  type PayslipVerificationRecord,
  type PayslipVerificationRecords,
  type PayslipVerificationStatus,
} from "./payslipVerificationRecords";

/* Sur cet appareil : la démo, et les décisions prises avant qu'elles ne
   soient gardées dans le compte (elles le rejoignent à la connexion). */
function storageKey(accountId: string) {
  return `planning:payslip-verifications-v1:${accountId.trim().toLowerCase() || "local"}`;
}

export function readLocalPayslipVerifications(accountId: string): PayslipVerificationRecords {
  if (typeof localStorage === "undefined") return {};
  try {
    return sanitizePayslipVerifications(JSON.parse(localStorage.getItem(storageKey(accountId)) || "{}"));
  } catch {
    return {};
  }
}

export function writeLocalPayslipVerifications(accountId: string, records: PayslipVerificationRecords) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(records));
  } catch {
    // Stockage indisponible (navigation privée) : la décision reste en mémoire.
  }
}

export function loadPayslipVerification(accountId: string, year: number, month: number) {
  return readLocalPayslipVerifications(accountId)[payslipVerificationPeriodKey(year, month)] ?? null;
}

export function savePayslipVerification(accountId: string, record: PayslipVerificationRecord) {
  const records = readLocalPayslipVerifications(accountId);
  records[payslipVerificationPeriodKey(record.year, record.month)] = record;
  writeLocalPayslipVerifications(accountId, records);
}

export function removePayslipVerification(accountId: string, year: number, month: number) {
  const records = readLocalPayslipVerifications(accountId);
  delete records[payslipVerificationPeriodKey(year, month)];
  writeLocalPayslipVerifications(accountId, records);
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
  if (!record.issues.length && !record.note.trim()) lines.push("Anomalie signalée manuellement — aucun écart n’a été identifié automatiquement.");
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
