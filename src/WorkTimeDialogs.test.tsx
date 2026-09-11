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
        draft={{ hours: "2", minutes: "30", basis: "credited" }}
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
    expect(overtime).toContain("Heure de début");
    expect(overtime).toContain("Heure de fin");
    expect(overtime).not.toContain('min="09:00"');
    expect(overtime).not.toContain('max="19:00"');
    expect(overtime).toContain('aria-label="Heure de début — heures"');
    expect(overtime).toContain('aria-label="Heure de fin — minutes"');
    expect(overtime).not.toContain('type="time"');
    expect(overtime).toContain("À récupérer");
    expect(overtime).toContain("Jour ×1,25 · dimanche/férié ×1,66 · nuit ×2");
    expect(overtime).not.toContain("Ajoutées au solde heure pour heure");
    expect(overtime).toContain("Le tarif dimanche/jour férié est appliqué automatiquement");
    expect(mecenat).toContain("Déclarer un mécénat");
    expect(mecenat).toContain('aria-label="Heure de début — heures"');
    expect(mecenat).toContain('aria-label="Heure de fin — minutes"');
    expect(mecenat).not.toContain('min="09:00"');
    expect(mecenat).not.toContain('max="19:00"');
    expect(mecenat).toContain("Avant 22 h");
    expect(mecenat).toContain("Après 22 h");
    expect(mecenat).not.toContain("De 7 h à 22 h");
    expect(mecenat).toContain("Total brut");
    expect(solidarity).toContain("Ajouter des heures manuellement");
    expect(recovery).toContain("Ajouter une récupération");
    expect(recovery).toContain("Heures à poser");
    expect(recovery).toContain('class="overtime-choice-field recovery-duration-field"');
    expect(recovery).toContain("Récupération sur une formation");
    expect(recovery).not.toContain("Récupération de formation");
    expect(recovery).toContain("Type de récupération");
    expect(recovery).toContain("Récupération de jour férié");
    expect(recovery).toContain("Récupération sur une formation");
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
    expect(holidayThreeQuarters).toContain(">6 h 30</button>");
    expect(holidayHalf).toContain(">4 h</button>");
    expect(dayHalf).toContain(">3 h 45</button>");
    expect(halfDayHalf).toContain(">3 h 45</button>");
    expect(holiday).not.toContain(">8 h</button>");
  });
});

describe("l’annonce du crédit de récupération", () => {
  const dialog = (start: string, end: string, date = "2026-08-21") =>
    renderToStaticMarkup(
      <OvertimeDialog
        open
        draft={{ date, start, end, disposition: "recovery" }}
        setDraft={vi.fn()}
        saving={false}
        group={2}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

  it("annonce les heures faites et celles récupérées, avant d’enregistrer", () => {
    // 3 h de jour : la majoration porte le crédit à 3 h 45.
    const html = dialog("14:00", "17:00");
    expect(html).toContain("3 h de travail");
    expect(html).toContain("3 h 45 à récupérer");
  });

  it("dit de saisir ses heures réelles, pour qu’on ne majore pas soi-même", () => {
    // Le piège vécu : 3 h de travail saisies en 3 h 45, créditées 4 h 41.
    expect(dialog("14:00", "17:00")).toContain(
      "la majoration est ajoutée par l’application",
    );
  });

  it("compte double les heures d’après 22 h", () => {
    // 20 h → minuit : 2 h de jour majorées à 2 h 30, 2 h de nuit portées à 4 h.
    expect(dialog("20:00", "00:00")).toContain("6 h 30 à récupérer");
  });

  it("se tait pour des heures à payer : la majoration ne les concerne pas", () => {
    const html = renderToStaticMarkup(
      <OvertimeDialog
        open
        draft={{ date: "2026-08-21", start: "14:00", end: "17:00", disposition: "paid" }}
        setDraft={vi.fn()}
        saving={false}
        group={2}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(html).not.toContain("à récupérer</b>");
  });
});

describe("reprise du solde de récupération", () => {
  const solde = (basis: "credited" | "worked") =>
    renderToStaticMarkup(
      <SolidarityHoursDialog
        open
        draft={{ hours: "20", minutes: "0", basis }}
        setDraft={vi.fn()}
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

  it("laisse le choix entre un solde déjà calculé et des heures à majorer", () => {
    const html = solde("credited");
    expect(html).toContain("Un solde déjà calculé");
    expect(html).toContain("Des heures travaillées");
  });

  it("ne majore rien pour un solde déjà calculé", () => {
    // Ce solde vient des compteurs tenus avant l'application : il est déjà
    // majoré. Le remajorer le gonflerait.
    const html = solde("credited");
    expect(html).toContain("Aucune majoration n’est appliquée ici");
    expect(html).not.toContain("ajoutées au solde</b>");
  });

  it("annonce les deux durées quand on saisit des heures travaillées", () => {
    const html = solde("worked");
    expect(html).toContain("20 h de travail");
    expect(html).toContain("25 h ajoutées au solde");
    expect(html).not.toContain("Aucune majoration n’est appliquée ici");
  });
});
