import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  DeletePeriodDialog,
  MessageDialog,
  NonWorkingDayWarningDialog,
  SuccessToast,
  TimeSelectionDialog,
  UndoToast,
} from "./PlanningDialogs";

describe("fenêtres communes du planning", () => {
  it("conserve les messages et rôles accessibles", () => {
    const time = renderToStaticMarkup(
      <TimeSelectionDialog
        date="2026-08-21"
        activeType="recovery_hours"
        start="09:15"
        end="13:00"
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const warning = renderToStaticMarkup(
      <NonWorkingDayWarningDialog
        date="2026-08-23"
        group={2}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const deletion = renderToStaticMarkup(
      <DeletePeriodDialog
        period={{
          id: "period-1",
          from: "2026-08-21",
          to: "2026-08-22",
          leaveType: "annual",
          updatedAt: "2026-08-21T12:00:00.000Z",
        }}
        saving={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(time).toContain("Choisissez les horaires");
    expect(time).toContain('aria-label="Heure de début — heures"');
    expect(time).toContain('aria-label="Heure de fin — heures"');
    expect(time).toContain("Ces horaires seront repris automatiquement dans le formulaire.");
    expect(time).toContain("Valider les horaires");
    expect(time).not.toContain("Horaires habituels");
    expect(warning).toContain('role="alertdialog"');
    expect(warning).toContain("groupe 2");
    expect(deletion).toContain("Annuler cette période ?");
    expect(deletion).toContain("Toute la période (2 j)");
  });

  it("propose d’annuler un jour précis ou plusieurs sur une période de plusieurs jours", () => {
    const html = renderToStaticMarkup(
      <DeletePeriodDialog
        period={{
          id: "period-1",
          from: "2026-12-03",
          to: "2026-12-06",
          leaveType: "annual",
          updatedAt: "2026-12-03T12:00:00.000Z",
        }}
        focusDate="2026-12-04"
        monthPeriods={[
          {
            id: "period-1",
            from: "2026-12-03",
            to: "2026-12-06",
            leaveType: "annual",
            updatedAt: "2026-12-03T12:00:00.000Z",
          },
          {
            id: "period-2",
            from: "2026-12-15",
            to: "2026-12-16",
            leaveType: "rtt",
            updatedAt: "2026-12-15T12:00:00.000Z",
          },
        ]}
        saving={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("Tous vos congés posés en décembre 2026");
    expect(html).toContain("Ce jour uniquement");
    expect(html).toContain("Cette période (4 j)");
    expect(html).toContain("Tout le mois (6 j)");
    expect(html).toContain("Annuler 1 journée");
  });

  it("demande aussi les horaires pour une récupération sur formation", () => {
    const time = renderToStaticMarkup(
      <TimeSelectionDialog
        date="2026-08-21"
        activeType="recovery_training"
        start="09:15"
        end="15:15"
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(time).toContain("Choisissez les horaires");
    expect(time).toContain('<option value="9" selected="">9 h</option>');
    expect(time).toContain('<option value="15" selected="">15 h</option>');
    expect(time).toContain("Valider les horaires");
  });

  it("demande directement si la demi-journée est posée le matin ou l’après-midi", () => {
    const time = renderToStaticMarkup(
      <TimeSelectionDialog date="2026-08-21" activeType="half" start="09:15" end="13:30" onStartChange={vi.fn()} onEndChange={vi.fn()} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(time).toContain("Matin ou après-midi ?");
    expect(time).toContain("Quelle moitié de journée souhaitez-vous poser ?");
    expect(time).toContain("Le matin");
    expect(time).toContain("L’après-midi");
    expect(time).toContain('role="radiogroup"');
    expect(time).toContain("Valider la demi-journée");
    expect(time).not.toContain('type="time"');
  });

  it.each(["recovery_day", "recovery_half", "recovery_hours", "recovery_holiday", "recovery_training"] as const)("propose les horaires pour %s", (activeType) => {
    const time = renderToStaticMarkup(
      <TimeSelectionDialog date="2026-08-21" activeType={activeType} start="09:15" end="17:30" onStartChange={vi.fn()} onEndChange={vi.fn()} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(time).toContain("Choisissez les horaires");
    expect(time).toContain('aria-label="Heure de début — heures"');
    expect(time).toContain('aria-label="Heure de fin — heures"');
    expect(time).toContain("Ces horaires seront repris automatiquement dans le formulaire.");
    expect(time).not.toContain("Combien d’heures souhaitez-vous poser ?");
  });

  it("conserve l’erreur et la confirmation non bloquante", () => {
    const error = renderToStaticMarkup(
      <MessageDialog message="Erreur de test" onClose={vi.fn()} />,
    );
    const success = renderToStaticMarkup(
      <SuccessToast message="Enregistré" onClose={vi.fn()} />,
    );
    const undo = renderToStaticMarkup(
      <UndoToast message="Absence supprimée" onUndo={vi.fn()} onClose={vi.fn()} />,
    );

    expect(error).toContain("Impossible de continuer");
    expect(error).toContain("Erreur de test");
    expect(success).toContain('role="status"');
    expect(success).toContain("Enregistré");
    expect(undo).toContain("Absence supprimée");
    expect(undo).toContain("Annuler");
  });
});
