import { useState } from "react";
import {
  COUNTED_ONLY_TYPES,
  LEAVE_ALLOWANCES,
  addDays,
  dateKey,
  fromKey,
  getDayInfo,
  schoolVacationsForZone,
  wasPompidouHolidayWorked,
  type HalfMoment,
  type LeaveType,
} from "./planningLogic";

type PdfExportPeriod = {
  from: string;
  to: string;
  leaveType?: LeaveType | "";
  halfMoment?: HalfMoment | "";
};

export function useAnnualPdfExport(
  view: Date,
  group: number,
  periods: PdfExportPeriod[],
  wishDates: ReadonlySet<string>,
  notify: (text: string) => void,
) {
  const [pdfExporting, setPdfExporting] = useState<
    "selected" | "all" | "my-leaves" | null
  >(null);

  async function exportAnnualPlanning(
    scope: "selected" | "all" | "my-leaves",
    includeSchoolVacations = false,
  ) {
    if (pdfExporting) return;
    setPdfExporting(scope);
    try {
      const { createAnnualPlanningPdf } = await import("./planningPdf");
      const leaveTypes = new Map<string, Exclude<LeaveType, "other">>();
      const halfMoments = new Map<string, HalfMoment>();
      // Bornée à l'année affichée, comme le reste du PDF : une case déborde
      // volontairement de part et d'autre pour qu'une période à cheval sur
      // le 1er janvier affiche quand même son vrai repère de début ou de fin.
      let schoolVacationDates: Set<string> | undefined;
      let schoolVacationsByZone:
        | Record<"A" | "B" | "C", Array<{ name: string; from: string; to: string }>>
        | undefined;
      if (includeSchoolVacations) {
        const year = view.getFullYear();
        const first = `${year}-01-01`;
        const last = `${year}-12-31`;
        schoolVacationsByZone = { A: [], B: [], C: [] };
        schoolVacationDates = new Set();
        for (const zone of ["A", "B", "C"] as const) {
          for (const vacation of schoolVacationsForZone(zone)) {
            if (vacation.to < first || vacation.from > last) continue;
            schoolVacationsByZone[zone].push(vacation);
            for (
              let date = fromKey(vacation.from);
              dateKey(date) <= vacation.to;
              date = addDays(date, 1)
            )
              schoolVacationDates.add(dateKey(date));
          }
        }
      }
      if (scope === "my-leaves") {
        const year = view.getFullYear();
        const first = `${year}-01-01`;
        const last = `${year}-12-31`;
        for (const period of periods) {
          const leaveType = period.leaveType;
          if (
            !leaveType ||
            leaveType === "other" ||
            period.to < first ||
            period.from > last
          )
            continue;
          const from = period.from < first ? first : period.from;
          const to = period.to > last ? last : period.to;
          for (
            let date = fromKey(from);
            dateKey(date) <= to;
            date = addDays(date, 1)
          ) {
            const info = getDayInfo(date, group);
            const key = dateKey(date);
            if (!info.holiday && info.kind !== "off" && !leaveTypes.has(key)) {
              leaveTypes.set(key, leaveType);
              // La moitié suit le type : c'est elle qui décide du côté colorié.
              if (leaveType === "half" && period.halfMoment)
                halfMoments.set(key, period.halfMoment);
            }
          }
        }
      }
      const quotaDaysUsed = Array.from(leaveTypes.values()).reduce(
        (total, type) =>
          // Une récupération ne consomme aucun droit, comme les types
          // seulement comptés : elle reste hors du total.
          type === "recovery" ||
          COUNTED_ONLY_TYPES.includes(type as (typeof COUNTED_ONLY_TYPES)[number])
            ? total
            : total + (type === "half" ? 0.5 : 1),
        0,
      );
      const result = createAnnualPlanningPdf({
        year: view.getFullYear(),
        groups: scope === "all" ? [1, 2, 3] : [group],
        getDayInfo,
        wasPompidouHolidayWorked,
        leaveTypes: scope === "my-leaves" ? leaveTypes : undefined,
        halfMoments: scope === "my-leaves" ? halfMoments : undefined,
        leaveSummary:
          scope === "my-leaves"
            ? {
                // Maladie, garde d'enfant et jours exceptionnels apparaissent
                // sur le planning mais n'entament aucun droit : ils sont
                // affichés sans entrer dans ce décompte.
                used: quotaDaysUsed,
                remaining:
                  Object.values(LEAVE_ALLOWANCES).reduce(
                    (total, allowance) => total + allowance,
                    0,
                  ) - quotaDaysUsed,
              }
            : undefined,
        wishDates: scope === "my-leaves" ? wishDates : undefined,
        schoolVacationDates,
        schoolVacationsByZone,
        filenameLabel:
          scope === "my-leaves" ? `groupe-${group}-avec-conges` : undefined,
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      notify("Le PDF n’a pas pu être créé. Rechargez la page puis réessayez.");
    } finally {
      setPdfExporting(null);
    }
  }

  return { pdfExporting, exportAnnualPlanning };
}
