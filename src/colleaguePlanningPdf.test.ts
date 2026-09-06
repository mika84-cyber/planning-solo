import { describe, expect, it } from "vitest";
import { colleaguePlanningPdfDays, colleaguePlanningPdfFillColor, colleaguePlanningPdfMonthLabel } from "./colleaguePlanningPdf";

describe("PDF du planning partagé", () => {
  it("contient uniquement les jours du mois et masque les motifs", () => {
    const days = colleaguePlanningPdfDays({
      owner: { userId: "agnes", displayName: "Agnès" },
      group: 2,
      days: [
        { date: "2026-09-07", status: "absence" },
        { date: "2026-09-14", status: "partial", halfMoment: "morning" },
      ],
    }, new Date(2026, 8, 1, 12));
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ day: 1, weekday: 1, weekdayLabel: "Mar" });
    expect(days.slice(0, 7).map((day) => day.weekdayLabel)).toEqual(["Mar", "Mer", "Jeu", "Ven", "Sam", "Dim", "Lun"]);
    expect(days[6].status).toBe("Absence");
    expect(days[13]).toMatchObject({ status: "Absence", partial: true, halfMoment: "morning" });
    expect(new Set(days.map((day) => day.status))).toEqual(new Set(["Travail", "Repos", "Absence"]));
    expect(JSON.stringify(days)).not.toMatch(/congé|maladie|grève/i);
  });

  it("utilise une couleur d’absence plus soutenue", () => {
    expect(colleaguePlanningPdfFillColor("Absence")).toEqual([242, 180, 189]);
  });

  it("écrit les noms de mois en entier dans le planning annuel", () => {
    expect(Array.from({ length: 12 }, (_, month) => colleaguePlanningPdfMonthLabel(month))).toEqual([
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ]);
  });
});
