import { describe, expect, it } from "vitest";
import { buildAnnualPdfAbsences } from "./useAnnualPdfExport";

describe("buildAnnualPdfAbsences", () => {
  it("transmet toutes les absences et les récupérations au PDF annuel", () => {
    const periods = [
      { from: "2026-01-02", to: "2026-01-02", leaveType: "strike" as const },
      { from: "2026-01-03", to: "2026-01-03", leaveType: "cet" as const },
      { from: "2026-01-04", to: "2026-01-04", leaveType: "other" as const },
      {
        from: "2026-01-05",
        to: "2026-01-05",
        leaveType: "half" as const,
        halfMoment: "afternoon" as const,
      },
    ];
    const recoveryUses = [{ date: "2026-01-06" }];
    const legacyOtherDates = new Set(["2026-01-07"]);

    const { leaveTypes, halfMoments } = buildAnnualPdfAbsences(
      2026,
      periods,
      recoveryUses,
      legacyOtherDates,
    );

    expect(Object.fromEntries(leaveTypes)).toEqual({
      "2026-01-02": "strike",
      "2026-01-03": "cet",
      "2026-01-04": "other",
      "2026-01-05": "half",
      "2026-01-06": "recovery",
      "2026-01-07": "other",
    });
    expect(halfMoments.get("2026-01-05")).toBe("afternoon");
  });

  it("borne les périodes à l’année du document", () => {
    const { leaveTypes } = buildAnnualPdfAbsences(
      2026,
      [
        {
          from: "2025-12-31",
          to: "2026-01-02",
          leaveType: "annual",
        },
      ],
      [{ date: "2027-01-01" }],
    );

    expect([...leaveTypes.keys()]).toEqual(["2026-01-01", "2026-01-02"]);
  });
});
