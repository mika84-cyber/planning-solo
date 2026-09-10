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

  it("remplace les rubriques par les actions du compte", () => {
    const html = renderToStaticMarkup(<MainMenu
      open
      userEmail="mika@example.fr"
      fullName="Mika"
      checkingAppUpdate={false}
      appUpdateAvailable={false}
      online
      syncStatus="idle"
      lastSavedAt=""
      showInstallAction
      canInstall={false}
      onClose={vi.fn()}
      onCheckForUpdate={vi.fn()}
      onOpenDataManagement={vi.fn()}
      onInstall={vi.fn()}
      onOpenFeedback={vi.fn()}
      isAdmin={false}
      unreadFeedbackCount={0}
    />);
    expect(html).toContain("Compte et réglages");
    expect(html).toContain("mika@example.fr");
    expect(html).toContain("Vérifier les mises à jour");
    expect(html).toContain("Mes données");
    expect(html).toContain("État de sauvegarde");
    expect(html).toContain("Sauvegarde automatique active");
    expect(html).toContain("Installer l’application");
    expect(html).toContain("Disponible après connexion");
    expect(html).toContain("Écrire à l’administrateur");
    expect(html).not.toContain("Congés et récupérations");
    expect(html).not.toContain("Planning des collègues");
    expect(html).not.toContain("Messagerie interne");
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

  it("réserve l’entrée de la messagerie à l’administrateur", () => {
    const html = renderToStaticMarkup(<MainMenu open userEmail="admin@example.fr" fullName="Administrateur" checkingAppUpdate={false} appUpdateAvailable={false} online syncStatus="idle" lastSavedAt="" showInstallAction={false} canInstall={false} onClose={vi.fn()} onCheckForUpdate={vi.fn()} onOpenDataManagement={vi.fn()} onInstall={vi.fn()} onOpenFeedback={vi.fn()} isAdmin unreadFeedbackCount={3} />);
    expect(html).toContain("Messagerie interne");
    expect(html).toContain("3 messages non lus");
  });
});
