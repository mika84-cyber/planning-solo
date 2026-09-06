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
    expect(html).toContain("Besoin d’un mode d’emploi rapide");
    expect(html).not.toContain("Messages, compte et mises à jour");
  });

  it("présente les huit étapes essentielles du guide simplifié", () => {
    const html = renderToStaticMarkup(<UserGuideDialogs
      guidePromptOpen={false}
      guideOpen
      setGuideOpen={vi.fn()}
      skipGuidePrompt={vi.fn()}
      openGuideFromPrompt={vi.fn()}
    />);
    expect(html).toContain("Planning Solo, simplement");
    expect(html).toContain("8. Messages, compte et mises à jour");
    expect(html).toContain("Les rappels sont activés automatiquement");
    expect((html.match(/class="guide-section/g) || [])).toHaveLength(8);
  });
});
