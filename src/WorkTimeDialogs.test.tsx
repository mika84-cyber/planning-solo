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
        draft={{ date: "2026-08-21", start: "18:00", end: "20:00", disposition: "paid" }}
        setDraft={vi.fn()}
        saving={false}
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
        draft={{ date: "2026-08-21", start: "18:00", end: "20:00", disposition: "recovery" }}
        setDraft={vi.fn()}
        saving={false}
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
        draft={{ date: "2026-08-21", kind: "hours", hours: "2", minutes: "0", start: "" }}
        setDraft={vi.fn()}
        workDayMinutes={480}
        remainingMinutes={600}
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(overtime).toContain("Déclarer des heures supplémentaires");
    expect(overtime).toContain("À récupérer");
    expect(mecenat).toContain("Déclarer un mécénat");
    expect(mecenat).toContain("Total brut");
    expect(solidarity).toContain("Ajouter des heures manuellement");
    expect(recovery).toContain("Utiliser mes heures de récupération");
  });
});
