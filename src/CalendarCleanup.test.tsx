import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarCleanupPanel, CalendarCleanupTrigger } from "./CalendarCleanup";

describe("nettoyage du planning", () => {
  it("affiche les absences avant les notes avec le bon compteur", () => {
    const html = renderToStaticMarkup(
      <CalendarCleanupPanel
        selectedCount={2}
        busy={false}
        onCancel={vi.fn()}
        onDeleteAbsences={vi.fn()}
        onDeleteNotes={vi.fn()}
      />,
    );

    expect(html).toContain("2 dates sélectionnées");
    expect(html.indexOf("Effacer les absences")).toBeLessThan(
      html.indexOf("Effacer les notes"),
    );
  });

  it("désactive les suppressions quand aucune date n’est choisie", () => {
    const html = renderToStaticMarkup(
      <CalendarCleanupPanel
        selectedCount={0}
        busy={false}
        onCancel={vi.fn()}
        onDeleteAbsences={vi.fn()}
        onDeleteNotes={vi.fn()}
      />,
    );

    expect((html.match(/disabled=""/g) || []).length).toBe(2);
  });

  it("conserve le libellé compact du déclencheur", () => {
    const html = renderToStaticMarkup(
      <CalendarCleanupTrigger className="test" onStart={vi.fn()} />,
    );

    expect(html).toContain("Effacer plusieurs dates ou notes");
  });
});
