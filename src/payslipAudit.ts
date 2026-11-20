/**
 * Le contrôle d'un bulletin photographié : ce que la lecture a pu prouver,
 * et ce que le bulletin lui-même respecte ou non — taux légaux des
 * cotisations, indemnité de résidence, temps de travail. Chaque constat
 * tient en une phrase ; seul un écart est une alerte.
 *
 * Tout est calcul : aucun accès au navigateur, et rien n'est conservé.
 */
import type { PayslipReading } from "./payslip";
import { isProvenPayslipReading } from "./payslipOcr";
import { legalDeductionRate } from "./payslipRows";

export type PayslipAuditFinding = {
  key: string;
  /** « ok » : vérifié ; « info » : à savoir ; « warn » : écart à regarder. */
  tone: "ok" | "info" | "warn";
  title: string;
  detail?: string;
};

const euros = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const percent = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

/** Le taux de l'indemnité de résidence : 3 % en zone 1 (Paris), 1 % en
 *  zone 2, rien en zone 3. */
const RESIDENCE_RATES = [3, 1, 0];

/**
 * Les constats du contrôle, du plus important au plus anodin : la preuve de
 * la lecture, ce que le calcul a corrigé, les cotisations face aux taux
 * légaux, l'indemnité de résidence, le statut et le temps de travail.
 */
export function auditPayslip(reading: PayslipReading): PayslipAuditFinding[] {
  const findings: PayslipAuditFinding[] = [];
  const { proof, rows } = reading;
  if (!proof || !rows) return findings;

  if (isProvenPayslipReading(reading)) {
    findings.push({
      key: "proof",
      tone: "ok",
      title: "Lecture vérifiée par le calcul",
      detail: proof.net
        ? `Le brut est la somme des ${rows.earnings.length} lignes de rémunération. Le net se retrouve au centime : brut − ${euros(proof.deductionsTotal ?? 0)} de cotisations${rows.reimbursements ? ` + ${euros(rows.reimbursements)} remboursés` : ""}${rows.mealVouchers ? ` − ${euros(rows.mealVouchers)} de titres repas` : ""}.`
        : "Le brut est la somme des lignes de rémunération, et les totaux du pied de page donnent le net au centime.",
    });
  } else if (proof.gross === false || proof.net === false || proof.totals === false) {
    findings.push({
      key: "proof",
      tone: "warn",
      title: "Lecture à confirmer",
      detail: proof.gross === false
        ? "La somme des lignes de rémunération ne donne pas le brut lu : un montant a pu être mal lu sur la photo."
        : "Le net ne se retrouve pas au centime depuis le brut et les cotisations lues : un montant a pu être mal lu sur la photo.",
    });
  }
  if (proof.repaired.length) {
    const several = proof.repaired.length > 1;
    findings.push({
      key: "repaired",
      tone: "info",
      title: `${proof.repaired.length} montant${several ? "s" : ""} corrigé${several ? "s" : ""} par le calcul`,
      detail: `La photo ${several ? "les" : "le"} donnait mal ; la base multipliée par le taux ${several ? "les" : "l’"}a rétabli${several ? "s" : ""}, et le total le confirme : ${[...new Set(proof.repaired)].join(", ")}.`,
    });
  }

  // Les cotisations dont la loi fixe le taux.
  const legal = rows.deductions.flatMap((item) => {
    const rule = legalDeductionRate(item.label);
    return rule && item.rate !== undefined ? [{ item, rule }] : [];
  });
  const off = legal.filter(({ item, rule }) => Math.abs((item.rate as number) - rule.rate) > 0.005);
  if (off.length) {
    for (const { item, rule } of off)
      findings.push({
        key: `rate-${item.code}`,
        tone: "warn",
        title: `${item.label} : ${percent(item.rate as number)} au lieu de ${percent(rule.rate)}`,
        detail: `Le taux légal de la cotisation ${rule.name} est de ${percent(rule.rate)}. Vérifiez la ligne sur le bulletin : une photo peut tromper sur un chiffre.`,
      });
  } else if (legal.length >= 3) {
    findings.push({
      key: "rates",
      tone: "ok",
      title: "Cotisations aux taux légaux",
      // « vieillesse 6,90 % + 0,40 % · IRCANTEC 2,80 % · CSG 6,80 % + 2,40 % ».
      detail: [...new Set(legal.map(({ rule }) => rule.group))]
        .map((group) => `${group} ${legal.filter(({ rule }) => rule.group === group).map(({ item }) => percent(item.rate as number)).sort().reverse().join(" + ")}`)
        .join(" · "),
    });
  }

  // L'indemnité de résidence : un pourcentage du traitement.
  if (reading.baseSalary && reading.residenceAllowance !== undefined) {
    const rate = RESIDENCE_RATES.find((value) => Math.abs(Math.round(reading.baseSalary as number * value) / 100 - (reading.residenceAllowance as number)) <= 0.011);
    if (rate === undefined)
      findings.push({
        key: "residence",
        tone: "warn",
        title: `Indemnité de résidence : ${euros(reading.residenceAllowance)}`,
        detail: `Elle vaut d’ordinaire 3 % du traitement (${euros(Math.round(reading.baseSalary * 3) / 100)}), ou 1 % en zone 2.`,
      });
    else if (rate > 0)
      findings.push({ key: "residence", tone: "ok", title: `Indemnité de résidence : ${rate} % du traitement` });
  }

  if (reading.workTime !== undefined && reading.workTime < 100) {
    findings.push({
      key: "work-time",
      tone: "info",
      title: `Temps partiel à ${reading.workTime} %`,
      detail: rows.paidRate !== undefined
        ? `Le traitement lu en tient compte : il est payé à ${percent(rows.paidRate * 100)}${rows.fullBaseSalary ? ` de ${euros(rows.fullBaseSalary)}` : ""}.`
        : "Le traitement lu en tient déjà compte.",
    });
  }
  return findings;
}
