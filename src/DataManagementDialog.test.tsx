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
        onArchiveLegacy={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="data-management-title"');
    expect(html).toContain("Exporter une sauvegarde JSON");
    expect(html).toContain("Effacer toutes mes données");
  });
});
