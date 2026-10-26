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
