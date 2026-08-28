import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningCommandCenter } from "./PlanningCommandCenter";

const baseProps = {
  isHome: true,
  mode: "month" as const,
  view: new Date(2026, 8, 1),
  setView: vi.fn(),
  group: 2,
  onGroupChange: vi.fn(),
  workedDays: {
    month: { worked: 16, scheduled: 18, onLeave: 1, exceptionallyClosed: 1 },
    thirds: [{
      label: "3e tiers",
      range: "septembre à décembre",
      current: true,
      worked: 42,
      scheduled: 45,
      onLeave: 2,
      exceptionallyClosed: 1,
    }],
  },
  totals: { work: 16, training: 2, workedHoliday: 1 },
  recoveryRangeSelecting: false,
  recoveryDraft: {
    date: "2026-09-01",
    kind: "hours" as const,
    hours: "2",
    minutes: "0",
    start: "",
    durationMinutes: 120,
    trainingMinutes: 360 as const,
  },
  setRecoveryDraft: vi.fn(),
  recoveryRangeDates: [],
  savingOvertime: false,
  onCancelRecoveryRange: vi.fn(),
  onSaveRecoveryRange: vi.fn(),
  rangeSelecting: false,
  separatePeople: [],
  rangeLeaveType: "annual" as const,
  separateDates: [],
  savingRange: false,
  onCancelRange: vi.fn(),
  onSaveRange: vi.fn(),
  calendarDeleteMode: false,
  calendarDeleteDates: [],
  deletingMultipleDates: false,
  onCancelCleanup: vi.fn(),
  onDeleteAbsences: vi.fn(),
  onDeleteNotes: vi.fn(),
  onToday: vi.fn(),
  onStartCleanup: vi.fn(),
};

describe("PlanningCommandCenter", () => {
  it("regroupe les commandes mensuelles du planning", () => {
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    expect(html).toContain("Mon planning");
    expect(html).toContain("Année affichée");
    expect(html).toContain("Jours travaillés");
    expect(html).toContain("16 ce mois-ci");
    expect(html).toContain("Aujourd’hui");
    expect(html).toContain("Effacer plusieurs dates ou notes");
  });

  it("affiche le récapitulatif et le groupe dans la vue annuelle", () => {
    const html = renderToStaticMarkup(
      <PlanningCommandCenter {...baseProps} isHome={false} mode="year" />,
    );
    expect(html).toContain("Récapitulatif");
    expect(html).toContain("jours travaillés");
    expect(html).toContain("Sélectionner le groupe du planning annuel");
    expect(html).not.toContain("Jours travaillés</span>");
  });
});
