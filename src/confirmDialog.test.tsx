import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirmDialog";

describe("ConfirmDialog", () => {
  it("pose la question dans un dialog natif, avec ses deux boutons nommés", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        request={{
          options: { title: "Supprimer ce mécénat ?", message: "Il disparaîtra de la paie.\nLe planning ne change pas.", confirmLabel: "Supprimer", tone: "danger" },
          resolve: vi.fn(),
        }}
        onAnswer={vi.fn()}
      />,
    );
    expect(html).toMatch(/^<dialog class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">/);
    expect(html).toContain('<h2 id="confirm-dialog-title">Supprimer ce mécénat ?</h2>');
    expect(html).toContain("<p>Il disparaîtra de la paie.</p><p>Le planning ne change pas.</p>");
    expect(html).toContain('<button class="secondary-button" type="button">Annuler</button>');
    expect(html).toContain('<button class="delete-confirm-button" type="button">Supprimer</button>');
    expect(html).toContain('aria-hidden="true">!</span>');
  });

  it("ne rend rien sans question", () => {
    expect(renderToStaticMarkup(<ConfirmDialog request={null} onAnswer={vi.fn()} />)).toBe("");
  });
});
