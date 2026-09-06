import { getDayInfo, MONTHS } from "./planningLogic";
import type { SharedColleaguePlanning } from "./colleagueSharingApi";

export type ColleaguePlanningPdfDay = {
  day: number;
  weekday: number;
  weekdayLabel: string;
  status: "Travail" | "Repos" | "Absence";
  partial?: boolean;
  halfMoment?: "morning" | "afternoon";
};

const PDF_WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;
export const colleaguePlanningPdfMonthLabel = (month: number) => MONTHS[month] || "";
export function colleaguePlanningPdfFillColor(status: ColleaguePlanningPdfDay["status"]): [number, number, number] {
  return status === "Repos" ? [45, 48, 52] : status === "Absence" ? [242, 180, 189] : [255, 255, 255];
}

const safeOwnerName = (planning: SharedColleaguePlanning) => planning.owner.displayName
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/gi, "-")
  .replace(/^-|-$/g, "")
  .toLowerCase() || "collegue";

export function colleaguePlanningPdfDays(planning: SharedColleaguePlanning, view: Date): ColleaguePlanningPdfDay[] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month, index + 1, 12);
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    const shared = planning.days.find((item) => item.date === key);
    const info = getDayInfo(date, planning.group);
    const weekday = (date.getDay() + 6) % 7;
    return {
      day: index + 1,
      weekday,
      weekdayLabel: PDF_WEEKDAYS[weekday],
      status: shared?.status === "absence" || shared?.status === "partial" ? "Absence" : shared?.status === "rest" ? "Repos" : shared?.status === "work" || shared?.status === "training" ? "Travail" : info.kind === "off" ? "Repos" : "Travail",
      ...(shared?.status === "partial" ? { partial: true, halfMoment: shared.halfMoment } : {}),
    };
  });
}

type PdfDocument = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

function fillDay(pdf: PdfDocument, x: number, y: number, width: number, height: number, item: ColleaguePlanningPdfDay) {
  const isRest = item.status === "Repos";
  const isAbsent = item.status === "Absence";
  pdf.setFillColor(...colleaguePlanningPdfFillColor(item.status));
  pdf.setDrawColor(isAbsent ? 173 : 65, isAbsent ? 55 : 65, isAbsent ? 72 : 65);
  pdf.setLineWidth(0.25);
  pdf.rect(x, y, width, height, "FD");
  if (item.partial) {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(item.halfMoment === "afternoon" ? x : x + width / 2, y, width / 2, height, "F");
    pdf.rect(x, y, width, height, "S");
  }
  pdf.setTextColor(isRest ? 255 : 28, isRest ? 255 : 38, isRest ? 255 : 49);
}

function addLegend(pdf: PdfDocument, y: number) {
  const items: Array<[string, [number, number, number]]> = [
    ["Travail", colleaguePlanningPdfFillColor("Travail")],
    ["Repos", colleaguePlanningPdfFillColor("Repos")],
    ["Absence", colleaguePlanningPdfFillColor("Absence")],
  ];
  let x = 15;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  items.forEach(([label, color]) => {
    pdf.setFillColor(...color);
    pdf.setDrawColor(65, 65, 65);
    pdf.rect(x, y - 4, 5, 5, "FD");
    pdf.setTextColor(35, 45, 55);
    pdf.text(label, x + 7, y);
    x += 30;
  });
}

export async function downloadColleaguePlanningMonthPdf(planning: SharedColleaguePlanning, view: Date) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const days = colleaguePlanningPdfDays(planning, view);
  const left = 15;
  const top = 34;
  const cellWidth = 38;
  const cellHeight = 25;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(`Planning de ${planning.owner.displayName}`, left, 15);
  pdf.setFontSize(12);
  pdf.text(`${MONTHS[view.getMonth()]} ${view.getFullYear()}`, left, 23);
  PDF_WEEKDAYS.forEach((label, index) => {
    pdf.text(label, left + index * cellWidth + 3, top - 3);
  });
  const firstOffset = days[0]?.weekday || 0;
  days.forEach((item, index) => {
    const position = firstOffset + index;
    const x = left + (position % 7) * cellWidth;
    const y = top + Math.floor(position / 7) * cellHeight;
    fillDay(pdf, x, y, cellWidth - 2, cellHeight - 2, item);
    pdf.setFontSize(11);
    pdf.text(`${item.weekdayLabel} ${item.day}`, x + 3, y + 6);
    pdf.setFontSize(8);
    const statusLabel = item.partial
      ? `Demi-journée · ${item.halfMoment === "afternoon" ? "après-midi" : "matin"}`
      : item.status;
    pdf.text(statusLabel, x + 3, y + 18);
  });
  addLegend(pdf, 192);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Les absences sont affichées sans leur motif. Document généré par Planning Solo.", 112, 192);
  pdf.save(`planning-${safeOwnerName(planning)}-${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}.pdf`);
}

export async function downloadColleaguePlanningYearPdf(planning: SharedColleaguePlanning, year: number) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const left = 15;
  const top = 27;
  const cellWidth = 22;
  const headerHeight = 8;
  const dayHeight = 5.05;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(`Planning de ${planning.owner.displayName} — ${year}`, left, 15);
  for (let month = 0; month < 12; month += 1) {
    const x = left + month * cellWidth;
    pdf.setFillColor(234, 240, 247);
    pdf.setDrawColor(65, 65, 65);
    pdf.rect(x, top, cellWidth, headerHeight, "FD");
    pdf.setTextColor(25, 42, 58);
    pdf.setFontSize(7);
    pdf.text(colleaguePlanningPdfMonthLabel(month), x + cellWidth / 2, top + 5.2, { align: "center" });
    colleaguePlanningPdfDays(planning, new Date(year, month, 1, 12)).forEach((item) => {
      const y = top + headerHeight + (item.day - 1) * dayHeight;
      fillDay(pdf, x, y, cellWidth, dayHeight, item);
      pdf.setFontSize(6.5);
      pdf.text(`${item.weekdayLabel} ${item.day}`, x + 1.5, y + 3.5);
      pdf.text(item.partial ? (item.halfMoment === "afternoon" ? "½A" : "½M") : item.status.charAt(0), x + cellWidth - 4, y + 3.5);
    });
  }
  addLegend(pdf, 199);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text("T = Travail · R = Repos · A = Absence · ½M/½A = absence le matin/l’après-midi. Motifs non inclus.", 105, 199);
  pdf.save(`planning-${safeOwnerName(planning)}-${year}.pdf`);
}
