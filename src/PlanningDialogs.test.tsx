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
    expect(warning).toContain('role="alertdialog"');
    expect(warning).toContain("groupe 2");
    expect(deletion).toContain("Annuler cette période ?");
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
