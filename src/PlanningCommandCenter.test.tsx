import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningCommandCenter } from "./PlanningCommandCenter";

const baseProps = {
  isHome: true,
  workedDays: {
    month: {
      worked: 16, scheduled: 18, onLeave: 1, exceptionallyClosed: 1,
      exchangedGiven: 1, exchangedReturned: 1,
    },
    remaining: {
      worked: 51, scheduled: 56, onLeave: 4, exceptionallyClosed: 1,
      exchangedGiven: 1, exchangedReturned: 1,
    },
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
  showSchoolVacations: true,
  schoolZone: "C" as const,
  onShowSchoolVacationsChange: vi.fn(),
  onSchoolZoneChange: vi.fn(),
};

describe("PlanningCommandCenter", () => {
  it("garde le compte des jours travaillés, sans la période ni Aujourd’hui", () => {
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    expect(html).toContain("Mon planning");
    // Depuis le 9 novembre 2026, le mois, l'année et le retour à aujourd'hui
    // se changent en tête du calendrier (MonthNavigation) : la carte ne les
    // double plus, elle garde le compte réel des jours travaillés.
    expect(html).not.toContain("Mois précédent");
    expect(html).not.toContain("Mois suivant");
    expect(html).not.toContain("Sélectionner le mois");
    expect(html).not.toContain("Sélectionner l’année");
    expect(html).not.toContain("Aujourd’hui");
    expect(html).not.toContain("calendar-toolbar");
    expect(html).toContain("16 jours travaillés ce mois-ci");
    expect(html).toContain("Jours restant à travailler d’ici au 31 décembre");
    // Plus de volet à déplier, ni de bascule vers une vue annuelle retirée.
    expect(html).not.toContain("Modifier");
    expect(html).not.toContain("Année affichée");
    expect(html).not.toContain("Mode d’affichage");
    expect(html).not.toContain("Choix du groupe");
    expect(html).not.toContain("Effacer plusieurs dates ou notes");
  });

  it("pose le compteur à même la page, en premier, sans volet à déplier", () => {
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    expect(html).toContain('<div class="planning-settings-body"><section class="controls" aria-label="Choix du planning">');
    expect(html).toContain("jours travaillés ce mois-ci");
    expect(html).not.toContain("planning-settings-disclosure");
    expect(html).not.toContain("Mode d’affichage");
  });

  it("ouvre sur ce qu’il reste d’ici au 31 décembre, en trois chiffres", () => {
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    // Le volet est fermé au départ : la case garde le compte du mois affiché.
    expect(html).toContain("16 jours travaillés ce mois-ci");
    expect(html).not.toContain("worked-days-remaining");
  });
});

