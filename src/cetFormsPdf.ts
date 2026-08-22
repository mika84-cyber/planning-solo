import { jsPDF } from "jspdf";

export type CetFormIdentity = {
  lastName: string;
  firstName: string;
  service: string;
  groupCategory: string;
  date: string;
  signature?: string;
};

export type CetFundingFormData = CetFormIdentity & {
  year: number;
  annualBalance: number;
  rttBalance: number;
  depositDays: number;
  balanceBefore: number;
  keepDays: number;
  indemnifyDays: number;
};

const A4_WIDTH = 210;
const A4_HEIGHT = 297;

async function template(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Modèle CET indisponible");
  return new Uint8Array(await response.arrayBuffer());
}

function frenchDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function text(
  doc: jsPDF,
  value: string | number,
  x: number,
  y: number,
  size = 10,
  maxWidth?: number,
  coverBackground = true,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  const content = String(value);
  if (maxWidth) {
    while (doc.getTextWidth(content) > maxWidth && size > 7.5) {
      size -= 0.25;
      doc.setFontSize(size);
    }
  }
  if (coverBackground) {
    const width = doc.getTextWidth(content);
    const height = size * 0.3528;
    const horizontalPadding = 0.18;
    doc.setFillColor(255, 255, 255);
    doc.rect(
      x - horizontalPadding,
      y - height + 0.2,
      width + horizontalPadding * 2,
      height + 0.5,
      "F",
    );
  }
  doc.setTextColor(0, 0, 0);
  doc.text(content, x, y, { baseline: "alphabetic" });
}

function centeredText(doc: jsPDF, value: string | number, x: number, y: number, size = 11) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  doc.text(String(value), x, y, { align: "center", baseline: "alphabetic" });
}

function signature(
  doc: jsPDF,
  value: string | undefined,
  x: number,
  baseline: number,
  maxWidth = 38,
  maxHeight = 14,
) {
  if (!value?.startsWith("data:image/")) return;
  const format = value.startsWith("data:image/png") ? "PNG" : "JPEG";
  const properties = doc.getImageProperties(value);
  const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * ratio;
  const height = properties.height * ratio;
  doc.addImage(
    value,
    format,
    x,
    baseline - height + 1.5,
    width,
    height,
    undefined,
    "FAST",
  );
}

function result(doc: jsPDF, filename: string) {
  return { blob: doc.output("blob"), filename };
}

/** Remplit le formulaire officiel fourni par l'établissement sans en refaire
 * la mise en page : la page d'origine reste le fond intégral du PDF. */
export async function createCetOpeningPdf(data: CetFormIdentity) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addImage(await template("/cet/formulaire-ouverture-cet.png"), "PNG", 0, 0, A4_WIDTH, A4_HEIGHT, undefined, "FAST");
  text(doc, data.lastName, 37.5, 72.2, 11, 108);
  text(doc, data.firstName, 42, 82.1, 11, 103);
  text(doc, data.service, 86, 92.0, 10.2, 99);
  text(doc, data.groupCategory, 60.5, 101.9, 10.5, 82);
  text(doc, frenchDate(data.date), 37.5, 140.7, 10.5, 55);
  signature(doc, data.signature, 145, 142.6);
  return result(doc, "demande-ouverture-cet-perenne.pdf");
}

/** Remplit le formulaire officiel d'alimentation et de ventilation sans
 * modifier les millésimes, les titres ni la mise en page du modèle fourni. */
export async function createCetFundingPdf(data: CetFundingFormData) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addImage(await template("/cet/formulaire-alimentation-cet.png"), "PNG", 0, 0, A4_WIDTH, A4_HEIGHT, undefined, "FAST");

  // Les valeurs du bandeau supérieur reprennent exactement la ligne de base
  // des libellés imprimés. Elles commencent toutes 2,4 mm après leur
  // deux-points et ne reçoivent aucun aplat blanc : la ponctuation du modèle
  // officiel reste donc entière, sans trou ni décalage visible.
  text(doc, data.lastName, 37, 47.6, 10.5, 50, false);
  text(doc, data.firstName, 103.1, 47.6, 10.5, 45, false);
  text(doc, data.groupCategory, 176.2, 47.6, 10.5, 29.5, false);
  text(doc, data.service, 81.8, 56.6, 9.8, 124.2, false);

  const totalLeaveBalance = data.annualBalance + data.rttBalance;
  centeredText(doc, data.annualBalance, 173.8, 66.0, 11.5);
  centeredText(doc, data.rttBalance, 173.8, 75.0, 11.5);
  centeredText(doc, totalLeaveBalance, 173.8, 84.0, 11.5);
  centeredText(doc, data.depositDays, 173.8, 104.5, 11.5);
  centeredText(doc, data.balanceBefore, 173.8, 117.8, 11.5);
  centeredText(doc, data.balanceBefore + data.depositDays, 173.8, 127.5, 11.5);
  centeredText(doc, data.keepDays, 173.8, 206.0, 11.5);
  centeredText(doc, data.indemnifyDays, 173.8, 236.5, 11.5);
  text(doc, frenchDate(data.date), 37.5, 259.7, 10.5, 35);
  signature(doc, data.signature, 148, 260.5, 36, 8);
  return result(doc, `alimentation-et-indemnisation-cet-${data.year}.pdf`);
}
