import { renderToStaticMarkup } from "react-dom/server";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppHeader, MainMenu } from "./AppNavigation";

describe("navigation principale", () => {
  it("conserve le bouton de menu et le titre de la programmation GP", () => {
    const html = renderToStaticMarkup(<AppHeader
      homeSection="program"
      payScreen="overview"
      userEmail="mika@example.fr"
      fullName="Mika"
      accountMenuOpen={false}
      mainMenuOpen={false}
      checkingAppUpdate={false}
      appUpdateAvailable={false}
      accountMenuRef={createRef()}
      accountButtonRef={createRef()}
      onToggleAccount={vi.fn()}
      onOpenDataManagement={vi.fn()}
      onDisconnect={vi.fn()}
      onOpenMainMenu={vi.fn()}
      onCheckForUpdate={vi.fn()}
    />);
    expect(html).toContain("Programmation GP");
    expect(html).toContain('aria-label="Ouvrir le menu principal"');
    expect(html.match(/main-menu-button/g)).toHaveLength(1);
  });

  it("garde toutes les rubriques dans l’ordre", () => {
    const html = renderToStaticMarkup(<MainMenu
      open
      homeSection="home"
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      onOpenGuide={vi.fn()}
    />);
    const labels = ["Accueil", "Congés et récupérations", "Ma paie", "Télécharger les plannings", "Programmation GP", "Formulaires utiles", "Contacts utiles"];
    labels.slice(1).forEach((label, index) => {
      expect(html.indexOf(labels[index])).toBeLessThan(html.indexOf(label));
    });
  });
});
