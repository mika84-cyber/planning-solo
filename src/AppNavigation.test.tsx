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

  it("signale une mise à jour à effectuer sur l’initiale du compte", () => {
    const html = renderToStaticMarkup(<AppHeader
      homeSection="home"
      payScreen="overview"
      userEmail="mika@example.fr"
      fullName="Mika"
      accountMenuOpen={false}
      mainMenuOpen={false}
      checkingAppUpdate={false}
      appUpdateAvailable
      demoMode
      unreadFeedbackCount={0}
      notify={vi.fn()}
      accountMenuRef={createRef()}
      accountButtonRef={createRef()}
      onToggleAccount={vi.fn()}
      onDisconnect={vi.fn()}
      onOpenMainMenu={vi.fn()}
      onCheckForUpdate={vi.fn()}
    />);
    expect(html).toContain('aria-label="Compte — mise à jour disponible"');
    expect(html).toContain("account-update-dot");
    expect(html).toContain("Mise à jour à effectuer");
  });

  const menuBase = {
    open: true, onClose: vi.fn(), onNavigate: vi.fn(), currentSection: "home" as const,
    checkingAppUpdate: false, appUpdateAvailable: false, onCheckForUpdate: vi.fn(),
    showInstallAction: true, canInstall: false, onInstall: vi.fn(),
    onOpenFeedback: vi.fn(), isAdmin: false, unreadFeedbackCount: 0,
  };

  it("mène aux pages, au rafraîchissement, à l’installation et à la messagerie", () => {
    const html = renderToStaticMarkup(<MainMenu {...menuBase} />);
    expect(html).toContain("Navigation");
    expect(html).toContain("<h2>Menu principal</h2>");
    expect(html).toContain("main-menu-refresh");
    expect(html).toContain("Rafraîchir");
    expect(html).toContain("Vérifier les mises à jour");
    expect(html.indexOf("Vérifier les mises à jour")).toBeLessThan(html.indexOf("Rafraîchir"));
    expect(html.indexOf("main-menu-refresh")).toBeLessThan(html.indexOf("Accueil"));
    expect(html).toContain('aria-label="Les pages de l’application"');
    expect(html).toContain("Congés et récupérations");
    expect(html).toContain("Planning des collègues");
    expect(html).toContain("Programmation GP");
    expect(html).toContain("Documents et contacts");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Installer l’application");
    expect(html).toContain("Écrire à l’administrateur");
    expect(html).not.toContain("Mode d’emploi");
    expect(html).not.toContain("Compte et réglages");
    expect(html).not.toContain("Mes données");
  });

  it("ouvre la messagerie interne pour l’administrateur", () => {
    const html = renderToStaticMarkup(<MainMenu {...menuBase} isAdmin unreadFeedbackCount={3} />);
    expect(html).toContain("Messagerie interne");
    expect(html).toContain("3 messages non lus");
  });

  it("annonce la mise à jour prête dans le menu", () => {
    const html = renderToStaticMarkup(<MainMenu {...menuBase} appUpdateAvailable />);
    expect(html).toContain("Installer la mise à jour");
    expect(html).toContain("Une nouvelle version est prête");
    expect(html).toContain("update-available");
  });

  it("propose une navigation adaptative sans numéros et marque la rubrique active", () => {
    const html = renderToStaticMarkup(<AdaptiveNavigation homeSection="colleagues" onNavigate={vi.fn()} onMore={vi.fn()} unreadFeedbackCount={2} />);
    expect(html).toContain("mobile-bottom-navigation");
    expect(html).toContain("desktop-side-navigation");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Collègues");
    expect(html.indexOf(">Expos<")).toBeLessThan(html.indexOf("Collègues"));
    expect(html).toContain("Programme");
    expect(html).toContain("Ma paie");
    expect(html).toContain("Documents");
    expect(html).toContain("<svg");
    expect(html).not.toContain('aria-label="Plus"');
    expect(html).not.toContain('aria-hidden="true">+</span>');
    expect(html).not.toContain(">01<");
    expect(html).not.toContain("Mode d’emploi");
  });

});
