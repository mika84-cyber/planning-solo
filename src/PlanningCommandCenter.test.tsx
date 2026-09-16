import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningCommandCenter } from "./PlanningCommandCenter";

const baseProps = {
  isHome: true,
  view: new Date(2026, 8, 1),
  setView: vi.fn(),
  workedDays: {
    month: {
      worked: 16, scheduled: 18, onLeave: 1, exceptionallyClosed: 1,
      exchangedGiven: 1, exchangedReturned: 1,
    },
    thirds: [{
      label: "3e tiers",
      range: "septembre à décembre",
      current: true,
      worked: 42,
      scheduled: 45,
      onLeave: 2,
      exceptionallyClosed: 1,
      exchangedGiven: 1,
      exchangedReturned: 1,
    }],
  },
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
  showSchoolVacations: true,
  schoolZone: "C" as const,
  onShowSchoolVacationsChange: vi.fn(),
  onSchoolZoneChange: vi.fn(),
};

describe("PlanningCommandCenter", () => {
  it("regroupe les commandes mensuelles du planning", () => {
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    expect(html).toContain("Mon planning");
    // Tout est posé à même la page : le mois, les deux flèches, le retour au
    // mois courant et le compte réel des jours travaillés.
    expect(html).toContain('aria-label="Mois précédent"');
    expect(html).toContain('aria-label="Mois suivant"');
    expect(html).toContain("Sélectionner le mois");
    expect(html).toContain("Sélectionner l’année");
    expect(html).toContain("Aujourd’hui");
    expect(html).toContain("16 jours travaillés ce mois-ci");
    expect(html).toContain("Détail des jours travaillés");
    // Plus de volet à déplier, ni de bascule vers une vue annuelle retirée.
    expect(html).not.toContain("Modifier");
    expect(html).not.toContain("Année affichée");
    expect(html).not.toContain("Mode d’affichage");
    expect(html).not.toContain("Choix du groupe");
    expect(html).not.toContain("Effacer plusieurs dates ou notes");
  });

  it("pose les commandes du mois sans volet à déplier", () => {
    // Changer de mois est le geste le plus courant de cette rubrique : il ne
    // doit pas demander d'ouvrir quoi que ce soit d'abord.
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    expect(html).toContain("Mois précédent");
    expect(html).toContain("Mois suivant");
    expect(html).toContain("Sélectionner le mois");
    expect(html).toContain("Aujourd’hui");
    expect(html).toContain("jours travaillés ce mois-ci");
    expect(html).not.toContain("planning-settings-disclosure");
    expect(html).not.toContain("Mode d’affichage");
  });
});
