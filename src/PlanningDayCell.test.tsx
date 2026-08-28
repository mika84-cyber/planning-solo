import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningDayCell } from "./PlanningDayCell";

const baseProps = {
  date: new Date(2026, 8, 9),
  group: 2,
  cleanupSelected: false,
  today: false,
  recoveryEntries: [],
  showLeaves: true,
  showNotes: true,
  inPendingRange: false,
  rangeSelecting: false,
  recoveryRangeSelecting: false,
  noteSelecting: false,
  noteColor: "#d3943d",
  onClick: vi.fn(),
};

describe("PlanningDayCell", () => {
  it("conserve le tampon de fermeture et sa date accessible", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        exceptionalClosure={{ label: "Fermeture exceptionnelle" }}
      />,
    );
    expect(html).toContain("exceptional-closure-date");
    expect(html).toContain("exceptional-closure-icon.webp");
    expect(html).toContain("Fermeture exceptionnelle");
    expect(html).toContain(">9</span>");
  });

  it("rend le type de congé et la note sans modifier les données", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        entry={{
          noteText: "Réunion",
          noteColor: "#d3943d",
          noteUpdatedAt: "2026-09-01T10:00:00Z",
          noteGroupId: "",
          leave: false,
          wish: false,
          holidayPay: "",
          closureOverride: "",
          updatedAt: "2026-09-01T10:00:00Z",
        }}
        leavePeriod={{
          id: "leave-1",
          from: "2026-09-09",
          to: "2026-09-09",
          leaveType: "annual",
          updatedAt: "2026-09-01T10:00:00Z",
        }}
      />,
    );
    expect(html).toContain("leave-annual");
    expect(html).toContain("leave-calendar-marker-annual");
    expect(html).toContain("has-note");
    expect(html).toContain("Note enregistrée");
  });
});
