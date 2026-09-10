import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DataManagementDialog } from "./DataManagementDialog";

describe("fenêtre de gestion des données", () => {
  it("expose un dialogue nommé et des actions explicites", () => {
    const html = renderToStaticMarkup(
      <DataManagementDialog
        open
        busy={false}
        onClose={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="data-management-title"');
    expect(html).toContain("Tout est enregistré automatiquement");
    expect(html).toContain("Sauvegarder une copie");
    expect(html).toContain("Reprendre une copie");
    expect(html).toContain("Effacer mes données");
    expect(html).toContain("Tout effacer définitivement");
    expect(html).not.toContain("Ranger d’anciennes données");
    expect(html).not.toContain("JSON");
    expect(html).not.toContain("anciennes clés globales");
  });
});
