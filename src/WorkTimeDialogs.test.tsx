import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MecenatDialog,
  OvertimeDialog,
  RecoveryUseDialog,
  SolidarityHoursDialog,
} from "./WorkTimeDialogs";

describe("fenêtres de temps de travail", () => {
  it("ne rend rien quand une fenêtre est fermée", () => {
    const html = renderToStaticMarkup(
      <OvertimeDialog
        open={false}
        draft={{ date: "2026-08-21", start: "18:00", end: "19:00", disposition: "paid" }}
        setDraft={vi.fn()}
        saving={false}
        group={2}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("conserve les quatre parcours et leurs libellés", () => {
    const overtime = renderToStaticMarkup(
      <OvertimeDialog
        open
        draft={{ date: "2026-08-21", start: "18:00", end: "19:00", disposition: "recovery" }}
        setDraft={vi.fn()}
        saving={false}
        group={2}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const mecenat = renderToStaticMarkup(
      <MecenatDialog
        open
        draft={{ date: "2026-08-21", start: "19:00", end: "00:00" }}
        setDraft={vi.fn()}
        calculation={{ dayMinutes: 180, nightMinutes: 120, grossAmountCents: 11140 }}
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const solidarity = renderToStaticMarkup(
      <SolidarityHoursDialog
        open
        draft={{ hours: "2", minutes: "30" }}
        setDraft={vi.fn()}
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const recovery = renderToStaticMarkup(
      <RecoveryUseDialog
        open
        draft={{ date: "2026-08-21", kind: "hours", hours: "2", minutes: "0", start: "", durationMinutes: 480, trainingMinutes: 360 }}
        setDraft={vi.fn()}
        group={2}
        showCalendar
        remainingMinutes={600}
        saving={false}
        onClose={vi.fn()}
        onSelectInCalendar={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const training = renderToStaticMarkup(
      <RecoveryUseDialog
        open
        draft={{ date: "2026-08-21", kind: "training", hours: "2", minutes: "0", start: "", durationMinutes: 480, trainingMinutes: 180 }}
        setDraft={vi.fn()}
        group={2}
        showCalendar={false}
        remainingMinutes={600}
        saving={false}
        onClose={vi.fn()}
        onSelectInCalendar={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const halfTraining = renderToStaticMarkup(
      <RecoveryUseDialog
        open
        draft={{ date: "2026-08-21", kind: "training", hours: "2", minutes: "0", start: "", durationMinutes: 480, trainingMinutes: 180 }}
        setDraft={vi.fn()}
        group={2}
        workQuota="half"
        showCalendar={false}
        remainingMinutes={600}
        saving={false}
        onClose={vi.fn()}
        onSelectInCalendar={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const recoveryFor = (kind: "day" | "half" | "holiday", workQuota: "full" | "three_quarters" | "half" = "full") => renderToStaticMarkup(
      <RecoveryUseDialog
        open
        draft={{ date: "2026-08-21", kind, hours: "2", minutes: "0", start: "", durationMinutes: kind === "half" ? 240 : 480, trainingMinutes: 360 }}
        setDraft={vi.fn()}
        group={2}
        showCalendar
        remainingMinutes={600}
        workQuota={workQuota}
        saving={false}
        onClose={vi.fn()}
        onSelectInCalendar={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const day = recoveryFor("day");
    const half = recoveryFor("half");
    const holiday = recoveryFor("holiday");
    const holidayThreeQuarters = recoveryFor("holiday", "three_quarters");
    const holidayHalf = recoveryFor("holiday", "half");
    const dayHalf = recoveryFor("day", "half");
    const halfDayHalf = recoveryFor("half", "half");

    expect(overtime).toContain("Déclarer des heures supplémentaires");
    expect(overtime.match(/min="09:00"/g)).toHaveLength(2);
    expect(overtime.match(/max="19:00"/g)).toHaveLength(2);
    expect(overtime.match(/step="900"/g)).toHaveLength(2);
    expect(overtime).toContain("À récupérer");
    expect(overtime).toContain("Le tarif dimanche/jour férié est appliqué automatiquement");
    expect(mecenat).toContain("Déclarer un mécénat");
    expect(mecenat.match(/step="900"/g)).toHaveLength(2);
    expect(mecenat).not.toContain('min="09:00"');
    expect(mecenat).not.toContain('max="19:00"');
    expect(mecenat).toContain("Total brut");
    expect(solidarity).toContain("Ajouter des heures manuellement");
    expect(recovery).toContain("Ajouter une récupération");
    expect(recovery).toContain("Heures à poser");
    expect(recovery).toContain('class="overtime-choice-field recovery-duration-field"');
    expect(recovery).toContain("Récupération sur une formation");
    expect(recovery).not.toContain("Récupération de formation");
    expect(recovery).toContain("Récupérations courantes");
    expect(recovery).not.toContain("Formation · 6 h");
    expect(recovery).toContain(">8 h</button>");
    expect(recovery).toContain(">6 h</button>");
    expect(recovery).toContain(">4 h</button>");
    expect(recovery).toContain(">3 h 45</button>");
    expect(recovery).toContain(">2 h</button>");
    expect(recovery).toContain("Sélectionner dans le calendrier");
    expect(recovery).not.toContain("Planning du groupe 2");
    expect(training).toContain("Journée · 6 h · 10 h–16 h");
    expect(training).toContain("Matin · 3 h · 10 h–13 h");
    expect(training).toContain("Après-midi · 3 h · 13 h–16 h");
    expect(halfTraining).not.toContain("Journée · 6 h");
    expect(halfTraining).toContain("Matin · 3 h · 10 h–13 h");
    expect(halfTraining).toContain("Après-midi · 3 h · 13 h–16 h");
    expect(training).not.toContain("Durée libre");
    expect(training).not.toContain("Choisir la date sur le planning");
    expect(training).toContain("Date déjà sélectionnée");
    expect(day.match(/>(8 h|Durée libre)<\/button>/g)).toEqual([">8 h</button>", ">Durée libre</button>"]);
    expect(half.match(/>(4 h|Durée libre)<\/button>/g)).toEqual([">4 h</button>", ">Durée libre</button>"]);
    expect(holiday).toContain(">8 h 15</button>");
    expect(holidayThreeQuarters).toContain(">6 h 15</button>");
    expect(holidayHalf).toContain(">3 h 45</button>");
    expect(dayHalf).toContain(">3 h 45</button>");
    expect(halfDayHalf).toContain(">3 h 45</button>");
    expect(holiday).not.toContain(">8 h</button>");
  });
});
