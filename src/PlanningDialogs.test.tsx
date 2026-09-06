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

    expect(time).toContain("Valider les horaires");
    expect(time.match(/min="09:00"/g)).toHaveLength(2);
    expect(time.match(/max="19:00"/g)).toHaveLength(2);
    expect(time.match(/step="900"/g)).toHaveLength(2);
    expect(time).toContain("Horaires habituels");
    expect(time).toContain("Matin · 9 h 15–13 h 30");
    expect(time).toContain("Après-midi · 13 h 30–17 h 30");
    expect(warning).toContain('role="alertdialog"');
    expect(warning).toContain("groupe 2");
    expect(deletion).toContain("Annuler cette période ?");
  });

  it("propose les deux demi-journées de formation à mi-temps", () => {
    const time = renderToStaticMarkup(
      <TimeSelectionDialog
        date="2026-08-21"
        activeType="recovery_training"
        workQuota="half"
        start="10:00"
        end="13:00"
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(time).toContain("Quelle demi-journée souhaitez-vous poser ?");
    expect(time).toContain("Matin · 3 h · 10 h–13 h");
    expect(time).toContain("Après-midi · 3 h · 13 h–16 h");
    expect(time).not.toContain("Horaires habituels");
  });

  it("propose 6 h ou 3 h de formation à temps plein", () => {
    const time = renderToStaticMarkup(
      <TimeSelectionDialog date="2026-08-21" activeType="recovery_training" workQuota="full" start="10:00" end="16:00" onStartChange={vi.fn()} onEndChange={vi.fn()} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(time).toContain("Journée · 6 h · 10 h–16 h");
    expect(time).toContain("Matin · 3 h · 10 h–13 h");
    expect(time).toContain("Après-midi · 3 h · 13 h–16 h");
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
