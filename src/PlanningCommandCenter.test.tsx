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
    year: 2026,
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
  it("garde les chiffres du mois, sans la période ni Aujourd’hui", () => {
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    expect(html).toContain("Mon planning");
    // Depuis le 9 novembre 2026, le mois, l'année et le retour à aujourd'hui
    // se changent en tête du calendrier (MonthNavigation) : la carte ne les
    // double plus.
    expect(html).not.toContain("Mois précédent");
    expect(html).not.toContain("Mois suivant");
    expect(html).not.toContain("Sélectionner le mois");
    expect(html).not.toContain("Sélectionner l’année");
    expect(html).not.toContain("Aujourd’hui");
    expect(html).not.toContain("calendar-toolbar");
    // Ni bascule vers une vue annuelle retirée, ni choix du groupe.
    expect(html).not.toContain("Modifier");
    expect(html).not.toContain("Année affichée");
    expect(html).not.toContain("Mode d’affichage");
    expect(html).not.toContain("Choix du groupe");
    expect(html).not.toContain("Effacer plusieurs dates ou notes");
  });

  it("pose trois chiffres à même la page, en premier, sans volet à déplier", () => {
    const html = renderToStaticMarkup(<PlanningCommandCenter {...baseProps} />);
    expect(html).toContain('<div class="planning-settings-body"><section class="controls" aria-label="Repères du mois"><ul class="worked-days">');
    // Les jours travaillés du mois affiché, ses jours d'absence (toutes les
    // absences posées, pas seulement les congés : `onLeave`), puis les jours
    // de travail restants dans l'année affichée : ce dernier compte vivait
    // dans un volet déplié sous une pilule jusqu'au 9 novembre 2026.
    expect(html).toContain('<li class="worked-days-month"><b>16</b><small>jours travaillés ce mois-ci</small></li>');
    expect(html).toContain('<li class="worked-days-leave"><b>1</b><small>jour d’absence ce mois-ci</small></li>');
    expect(html).toContain('<li class="worked-days-year"><b>51</b><small>jours de travail restants en 2026</small></li>');
    expect(html).not.toContain("de congé");
    expect(html).not.toContain("31 décembre");
    expect(html).not.toContain("worked-days-trigger");
    expect(html).not.toContain("worked-days-panel");
    expect(html).not.toContain("worked-days-remaining");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("planning-settings-disclosure");
  });

  it("accorde les libellés et garde les demi-journées", () => {
    const html = renderToStaticMarkup(
      <PlanningCommandCenter
        {...baseProps}
        workedDays={{
          month: { ...baseProps.workedDays.month, worked: 17.5, onLeave: 0 },
          remaining: { ...baseProps.workedDays.remaining, worked: 1 },
          year: 2027,
        }}
      />,
    );
    expect(html).toContain("<b>17,5</b><small>jours travaillés ce mois-ci</small>");
    expect(html).toContain("<b>0</b><small>jour d’absence ce mois-ci</small>");
    expect(html).toContain("<b>1</b><small>jour de travail restant en 2027</small>");
  });

  it("suit l’année choisie dans le calendrier : une année entière à venir, une année passée travaillée", () => {
    const render = (tense: "future" | "past", year: number, worked: number) => renderToStaticMarkup(
      <PlanningCommandCenter
        {...baseProps}
        workedDays={{ ...baseProps.workedDays, remaining: { ...baseProps.workedDays.remaining, worked }, year, tense }}
      />,
    );
    expect(render("future", 2027, 212)).toContain('<li class="worked-days-year"><b>212</b><small>jours de travail en 2027</small></li>');
    expect(render("past", 2025, 205.5)).toContain('<li class="worked-days-year"><b>205,5</b><small>jours travaillés en 2025</small></li>');
    expect(render("past", 2025, 1)).toContain("<small>jour travaillé en 2025</small>");
  });
});
