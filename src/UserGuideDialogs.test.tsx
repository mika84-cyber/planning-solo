import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UserGuideDialogs } from "./UserGuideDialogs";

describe("mode d’emploi", () => {
  it("affiche l’invitation sans charger le guide complet", () => {
    const html = renderToStaticMarkup(<UserGuideDialogs
      guidePromptOpen
      guideOpen={false}
      setGuideOpen={vi.fn()}
      skipGuidePrompt={vi.fn()}
      openGuideFromPrompt={vi.fn()}
    />);
    expect(html).toContain("Souhaitez-vous consulter le mode d’emploi");
    expect(html).not.toContain("Compte, données et mises à jour");
  });

  it("conserve les onze rubriques du guide", () => {
    const html = renderToStaticMarkup(<UserGuideDialogs
      guidePromptOpen={false}
      guideOpen
      setGuideOpen={vi.fn()}
      skipGuidePrompt={vi.fn()}
      openGuideFromPrompt={vi.fn()}
    />);
    expect(html).toContain("Bien démarrer avec Planning Solo");
    expect(html).toContain("11. Compte, données et mises à jour");
    expect((html.match(/class="guide-section/g) || [])).toHaveLength(11);
  });
});
