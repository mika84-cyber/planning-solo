/** Le courrier à la hiérarchie quand l'écart du bulletin est une erreur :
 *  daté, avec l'objet, l'écart du net, chaque cause en une phrase, un
 *  tableau attendu / bulletin et la demande de régularisation. Le même texte
 *  sert à l'aperçu et au PDF. */
import { euros } from "./appModel";
import type { PayslipGapRecord, PayslipGapRecordLine } from "./payslipVerificationRecords";
import { MONTHS, SUNDAY_ALLOWANCE, sundayCountLabel } from "./planningLogic";

export const DEFAULT_LETTER_RECIPIENT = "Service des ressources humaines";

export type PayslipLetterInput = {
  gap: PayslipGapRecord;
  year: number;
  month: number;
  date: Date;
  recipient: string;
  message: string;
  fullName: string;
};

export type PayslipLetter = {
  place: string;
  recipient: string;
  subject: string;
  salutation: string;
  paragraphs: string[];
  table: Array<{ label: string; expected: string; found: string }>;
  request: string;
  closing: string;
  signature: string;
};

const LINE_LABELS: Record<string, string> = {
  base: "Traitement de base",
  residence: "Indemnité de résidence",
  ifse: "IFSE",
  "other-fixed": "Autres éléments fixes",
  cia: "CIA",
  holidays: "Jours fériés travaillés",
  "sunday-flat": "Forfait des dimanches",
  sundays: "Dimanches au-delà du 10e",
  navigo: "Remboursement Navigo",
  "meal-vouchers": "Titres repas",
  "pas-rate": "Taux d’imposition",
  carence: "Jour de carence",
};

/** « d’octobre 2026 », « de mars 2026 ». */
const ofMonth = (year: number, month: number) =>
  `${/^[aeiou]/.test(MONTHS[month]) ? "d’" : "de "}${MONTHS[month]} ${year}`;

const sundays = (count: number) => `${sundayCountLabel(count)} dimanche${count >= 2 ? "s" : ""}`;

function sentence(line: PayslipGapRecordLine, net: boolean) {
  const amount = euros(Math.abs(line.amount));
  const { found, expected } = line;
  if (line.key === "sundays" && found !== undefined && expected !== undefined) {
    const missing = expected - found;
    return missing > 0
      ? `L’indemnité de travail dominical porte ${sundays(found)}, alors que ${sundays(expected)} étaient dus : il manque ${missing === 0.5 ? "un demi-dimanche" : sundays(missing)}, soit ${amount} brut.`
      : `L’indemnité de travail dominical porte ${sundays(found)}, alors que ${sundays(expected)} étaient dus, soit ${amount} brut en plus.`;
  }
  if (line.key === "pas-rate" && found !== undefined && expected !== undefined) {
    return `Le taux de prélèvement à la source appliqué est de ${found.toLocaleString("fr-FR")} % au lieu de ${expected.toLocaleString("fr-FR")} %, soit ${amount} d’impôt ${line.amount < 0 ? "en plus" : "en moins"}.`;
  }
  if (line.key === "carence") return `Un jour de carence de ${amount} a été retenu alors qu’aucun arrêt maladie ne le justifie ce mois-ci.`;
  if (line.key === "gross-other") return `Une différence de ${amount} sur le brut ne correspond à aucune ligne que j’aie pu identifier.`;
  if (line.key === "contributions-other") return `Les cotisations prélevées sont ${line.amount < 0 ? "supérieures" : "inférieures"} de ${amount} à celles attendues.`;
  if (line.key === "income-tax") return `L’impôt prélevé est ${line.amount < 0 ? "supérieur" : "inférieur"} de ${amount} à celui attendu.`;
  if (line.key === "one-off") return `${line.title} : ${line.detail}, soit ${amount}${net ? " brut" : ""}.`;
  const label = LINE_LABELS[line.key] ?? line.title;
  return found !== undefined && expected !== undefined
    ? `${label} : ${euros(found)} sur le bulletin, ${euros(expected)} attendus.`
    : `${line.title}, soit ${amount}.`;
}

function tableValue(line: PayslipGapRecordLine, value: number) {
  if (line.key === "sundays") return `${sundayCountLabel(value)} · ${euros(value * SUNDAY_ALLOWANCE.perSunday)}`;
  if (line.key === "pas-rate") return `${value.toLocaleString("fr-FR")} %`;
  return euros(value);
}

export function payslipLetter(input: PayslipLetterInput): PayslipLetter {
  const { gap, year, month } = input;
  const net = gap.level === "net";
  const when = ofMonth(year, month);
  const expectedTotal = net ? gap.expected.net : gap.expected.gross;
  const actualTotal = net ? gap.actual.net : gap.actual.gross;
  const opening = expectedTotal !== undefined && actualTotal !== undefined
    ? net
      ? `Mon bulletin de paie ${when} m’a versé ${euros(actualTotal)} net, alors que ${euros(expectedTotal)} étaient attendus, soit un écart de ${euros(Math.abs(gap.gap))}${gap.gap > 0 ? " en ma faveur" : ""}.`
      : `Mon bulletin de paie ${when} porte un brut de ${euros(actualTotal)}, alors que ${euros(expectedTotal)} étaient attendus, soit un écart de ${euros(Math.abs(gap.gap))}.`
    : `Mon bulletin de paie ${when} présente un écart avec ce qui était attendu.`;
  const reasons = gap.lines.filter((line) => line.kind !== "follow");
  // Le brut et les nets ont leurs propres lignes, en bas du tableau.
  const compared = reasons.filter((line) => line.found !== undefined && line.expected !== undefined && LINE_LABELS[line.key]);
  const total = (label: string, key: "gross" | "netBeforeTax" | "net") => {
    const expected = gap.expected[key];
    const found = gap.actual[key];
    return expected !== undefined && found !== undefined ? [{ label, expected: euros(expected), found: euros(found) }] : [];
  };
  return {
    place: `Paris, le ${input.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
    recipient: input.recipient.trim() || DEFAULT_LETTER_RECIPIENT,
    subject: `Objet : écart sur mon bulletin de paie ${when}`,
    salutation: "Madame, Monsieur,",
    paragraphs: [
      opening,
      ...reasons.map((line) => sentence(line, net)),
      ...(input.message.trim() ? [input.message.trim()] : []),
    ],
    table: [
      ...compared.map((line) => ({
        label: LINE_LABELS[line.key] ?? line.title,
        expected: tableValue(line, line.expected as number),
        found: tableValue(line, line.found as number),
      })),
      ...total("Brut", "gross"),
      ...(net ? [...total("Net avant impôt", "netBeforeTax"), ...total("Net à payer", "net")] : []),
    ],
    request: `Je vous remercie de bien vouloir vérifier ${reasons.length > 1 ? "ces points" : "ce point"} et procéder à la régularisation sur une prochaine paie.`,
    closing: "Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.",
    signature: input.fullName.trim(),
  };
}

export function payslipLetterPdfName(year: number, month: number) {
  return `courrier-bulletin-${year}-${String(month + 1).padStart(2, "0")}.pdf`;
}

/** Le courrier en PDF A4, signé de l'image de signature quand elle existe. */
export async function createPayslipLetterPdf(letter: PayslipLetter, signatureImage?: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // jsPDF ne connaît pas l'espace fine insécable des montants.
  const clean = (value: string) => value.replace(/[  ]/g, " ");
  const left = 22;
  const width = 166;
  let y = 26;
  const write = (value: string, options: { bold?: boolean; size?: number; gap?: number; align?: "right" } = {}) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size ?? 11);
    const lines = doc.splitTextToSize(clean(value), width) as string[];
    if (y + lines.length * 5.4 > 278) {
      doc.addPage();
      y = 24;
    }
    doc.text(lines, options.align === "right" ? left + width : left, y, options.align ? { align: "right" } : undefined);
    y += lines.length * 5.4 + (options.gap ?? 4);
  };
  doc.setTextColor(30, 30, 30);
  // L'expéditeur à gauche, le destinataire puis la date à droite.
  if (letter.signature) write(letter.signature, { bold: true, gap: 6 });
  write(letter.recipient, { align: "right", gap: 2 });
  write(letter.place, { align: "right", gap: 10 });
  write(letter.subject, { bold: true, gap: 6 });
  write(letter.salutation);
  for (const paragraph of letter.paragraphs) write(paragraph);
  if (letter.table.length) {
    y += 1;
    const columns = [left, left + 88, left + width];
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Ligne", columns[0], y);
    doc.text("Attendu", columns[1], y, { align: "right" });
    doc.text("Bulletin", columns[2], y, { align: "right" });
    doc.setFont("helvetica", "normal");
    for (const row of letter.table) {
      y += 2;
      doc.setDrawColor(220, 214, 206);
      doc.line(left, y, left + width, y);
      y += 5;
      doc.text(clean(row.label), columns[0], y);
      doc.text(clean(row.expected), columns[1], y, { align: "right" });
      doc.text(clean(row.found), columns[2], y, { align: "right" });
    }
    y += 10;
  }
  write(letter.request);
  write(letter.closing, { gap: 8 });
  if (signatureImage?.startsWith("data:image/")) {
    const properties = doc.getImageProperties(signatureImage);
    const ratio = Math.min(42 / properties.width, 16 / properties.height);
    doc.addImage(signatureImage, signatureImage.startsWith("data:image/png") ? "PNG" : "JPEG", left + width - properties.width * ratio, y, properties.width * ratio, properties.height * ratio);
    y += properties.height * ratio + 4;
  }
  if (letter.signature) write(letter.signature, { align: "right" });
  return doc.output("blob");
}
