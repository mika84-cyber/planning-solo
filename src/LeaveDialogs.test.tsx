import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManualAdjustmentsDialog, RangeLeaveDialog } from "./LeaveDialogs";

describe("fenêtres de congés", () => {
  it("conserve les reprises annuelles et les quatre périodes de dimanches", () => {
    const html = renderToStaticMarkup(
      <ManualAdjustmentsDialog
        open
        year={2026}
        draft={{
          annualUsed: "0",
          rttUsed: "0",
          fractionUsed: "0",
          sundayLeaveJanJun: "0",
          sundayLeaveJulSep: "0",
          sundayLeaveOctNov: "0",
          sundayLeaveDec: "0",
        }}
        setDraft={vi.fn()}
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Mes absences avant l’application");
    expect(html).toContain("Prime de juillet");
    expect(html).toContain("Prime d’octobre");
    expect(html).toContain("Prime de décembre");
    expect(html).toContain("Prime de janvier 2027");
  });

  it("conserve le choix manuel d’une période", () => {
    const html = renderToStaticMarkup(
      <RangeLeaveDialog
        open
        leaveType="annual"
        setLeaveType={vi.fn()}
        halfMoment="morning"
        setHalfMoment={vi.fn()}
        onClose={vi.fn()}
        onStartSelection={vi.fn()}
      />,
    );

    expect(html).toContain("Ajouter une période de congés");
    expect(html).toContain("Congés courants");
    expect(html).toContain("Sélectionner dans le calendrier");
  });
});
