import { renderToStaticMarkup } from "react-dom/server";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AdaptiveNavigation, AppHeader, MainMenu } from "./AppNavigation";

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
      demoMode
      unreadFeedbackCount={2}
      notify={vi.fn()}
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
    expect(html).toContain("2 messages non lus");
    expect(html).not.toContain("notification-button");
  });

  it("garde toutes les rubriques dans l’ordre", () => {
    const html = renderToStaticMarkup(<MainMenu
      open
      homeSection="home"
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      onOpenFeedback={vi.fn()}
      isAdmin={false}
      unreadFeedbackCount={0}
    />);
    const labels = ["Accueil", "Congés et récupérations", "Ma paie", "Documents et contacts", "Programmation GP", "Planning des collègues"];
    labels.slice(1).forEach((label, index) => {
      expect(html.indexOf(labels[index])).toBeLessThan(html.indexOf(label));
    });
    expect(html).toContain("Plannings PDF, formulaires et annuaires");
    expect(html.match(/Documents et contacts/g)).toHaveLength(1);
    expect(html).toContain("Écrire à l’administratrice");
    expect(html).not.toContain("Mode d’emploi");
    expect(html).not.toContain("Messagerie interne");
  });

  it("propose une navigation adaptative sans numéros et marque la rubrique active", () => {
    const html = renderToStaticMarkup(<AdaptiveNavigation homeSection="colleagues" onNavigate={vi.fn()} onMore={vi.fn()} unreadFeedbackCount={2} />);
    expect(html).toContain("mobile-bottom-navigation");
    expect(html).toContain("desktop-side-navigation");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Collègues");
    expect(html.indexOf(">Prog<")).toBeLessThan(html.indexOf("Collègues"));
    expect(html).toContain("Programme");
    expect(html).toContain("Ma paie");
    expect(html).toContain("Documents");
    expect(html).toContain("<svg");
    expect(html).not.toContain('aria-label="Plus"');
    expect(html).not.toContain('aria-hidden="true">+</span>');
    expect(html).not.toContain(">01<");
  });

  it("réserve l’entrée de la messagerie à l’administrateur", () => {
    const html = renderToStaticMarkup(<MainMenu open homeSection="home" onClose={vi.fn()} onNavigate={vi.fn()} onOpenFeedback={vi.fn()} isAdmin unreadFeedbackCount={3} />);
    expect(html).toContain("Messagerie interne");
    expect(html).toContain("3 messages non lus");
  });
});
