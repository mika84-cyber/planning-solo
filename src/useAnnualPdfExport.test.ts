import { describe, expect, it } from "vitest";
import { buildAnnualPdfAbsences, buildAnnualPdfOverlays } from "./useAnnualPdfExport";

describe("buildAnnualPdfAbsences", () => {
  it("transmet toutes les absences et les récupérations au PDF annuel", () => {
    const periods = [
      { from: "2026-01-02", to: "2026-01-02", leaveType: "strike" as const },
      { from: "2026-01-03", to: "2026-01-03", leaveType: "cet" as const },
      { from: "2026-01-04", to: "2026-01-04", leaveType: "other" as const },
      { from: "2026-01-08", to: "2026-01-08", leaveType: "work_accident" as const },
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
      "2026-01-08": "work_accident",
    });
    expect(halfMoments.get("2026-01-05")).toBe("afternoon");
  });

  it("numérote chaque paire d’échange et transmet les fermetures", () => {
    const entry = (exchangeId: string, exchangeRole: "given" | "return", otherDate: string) => ({
      noteText: "", noteColor: "", noteUpdatedAt: "", noteGroupId: "", leave: false,
      wish: false, holidayPay: "" as const, closureOverride: "" as const,
      exchangeId, exchangeRole, exchangePartner: "Camille", exchangePartnerGroup: 1,
      exchangeOtherDate: otherDate, updatedAt: "v1",
    });
    const { closedDates, exchangeMarkers } = buildAnnualPdfOverlays(
      2026,
      {
        "2026-03-10": entry("second", "given", "2026-03-18"),
        "2026-03-18": entry("second", "return", "2026-03-10"),
        "2026-01-05": entry("first", "given", "2026-01-12"),
        "2026-01-12": entry("first", "return", "2026-01-05"),
      },
      (date) => date === "2026-09-09",
    );
    expect([...closedDates]).toEqual(["2026-09-09"]);
    expect(exchangeMarkers.get("2026-01-05")).toEqual({ number: 1, role: "given" });
    expect(exchangeMarkers.get("2026-01-12")).toEqual({ number: 1, role: "return" });
    expect(exchangeMarkers.get("2026-03-10")).toEqual({ number: 2, role: "given" });
    expect(exchangeMarkers.get("2026-03-18")).toEqual({ number: 2, role: "return" });
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
