import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StrikeContinuityDetails } from "./StrikeContinuityDetails";
import type { StrikePayEstimate } from "./strike";

const base: StrikePayEstimate = {
  days: ["2026-09-02", "2026-09-08"],
  dailyDeduction: 61.86,
  totalDeduction: 123.72,
  automaticAdditionalDays: [],
  potentialAdditionalDays: [],
  potentialAdditionalDeduction: 0,
  maximumDeductionIfContinuous: 123.72,
  sourcePeriod: "2026-09",
  exactMonthValues: true,
  continuityIntervals: [],
};

describe("détail de continuité de grève", () => {
  it("explique que les CA validés restent non concernés", () => {
    const html = renderToStaticMarkup(
      <StrikeContinuityDetails
        estimate={{
          ...base,
          continuityIntervals: [{
            fromStrike: "2026-09-02",
            toStrike: "2026-09-08",
            status: "protected-annual",
            days: ["03", "04", "05", "06", "07"].map((day) => ({
              date: `2026-09-${day}`,
              kind: "annual" as const,
              label: "CA validé",
            })),
          }],
        }}
      />,
    );
    expect(html).toContain("3–7 septembre 2026 : CA validés → non concernés");
    expect(html).toContain("Total retenue estimée sur 2 journées");
    expect(html).toContain("123,72");
  });

  it("inclut les repos noirs encadrés sans modifier leur nature", () => {
    const html = renderToStaticMarkup(
      <StrikeContinuityDetails
        estimate={{
          ...base,
          totalDeduction: 247.44,
          automaticAdditionalDays: ["2026-09-05", "2026-09-06"],
          maximumDeductionIfContinuous: 247.44,
          exactMonthValues: false,
          sourcePeriod: "2026-08",
          continuityIntervals: [{
            fromStrike: "2026-09-04",
            toStrike: "2026-09-07",
            status: "confirmed-cycle-rest",
            days: ["05", "06"].map((day) => ({
              date: `2026-09-${day}`,
              kind: "weekend-rest" as const,
              label: "Repos du cycle (week-end)",
            })),
          }],
        }}
      />,
    );
    expect(html).toContain("repos noirs inclus dans la retenue");
    expect(html).toContain("4 journées");
    expect(html).toContain("2 repos noirs compris dans la période continue");
    expect(html).toContain("−247,44");
    expect(html).toContain("reste « repos du cycle » dans le planning");
    expect(html).toContain("dernières valeurs connues (2026-08)");
  });
});
