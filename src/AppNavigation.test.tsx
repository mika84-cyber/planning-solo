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

  it("signale la mise à jour par une seule pastille, sur l’icône ↻", () => {
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
    expect(html).not.toContain("account-update-dot");
    expect(html).toContain("header-update-dot");
  });

  const menuBase = {
    open: true, onClose: vi.fn(), onNavigate: vi.fn(), currentSection: "home" as const,
    showInstallAction: true, canInstall: false, onInstall: vi.fn(), onOpenDataManagement: vi.fn(),
    onOpenFeedback: vi.fn(), isAdmin: false, unreadFeedbackCount: 0,
  };

  it("mène aux pages puis aux outils, sans mise à jour dans le menu", () => {
    const html = renderToStaticMarkup(<MainMenu {...menuBase} />);
    expect(html).toContain("Planning Solo");
    expect(html).toContain("<h2>Menu principal</h2>");
    expect(html).not.toContain("main-menu-refresh");
    expect(html).not.toContain("Vérifier les mises à jour");
    expect(html.indexOf(">Pages<")).toBeLessThan(html.indexOf("Accueil"));
    expect(html.indexOf("Accueil")).toBeLessThan(html.indexOf(">Outils<"));
    expect(html.indexOf(">Outils<")).toBeLessThan(html.indexOf("Mes données"));
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
    expect(html).toContain("Mes données");
  });

  it("ouvre la messagerie interne pour l’administrateur", () => {
    const html = renderToStaticMarkup(<MainMenu {...menuBase} isAdmin unreadFeedbackCount={3} />);
    expect(html).toContain("Messagerie interne");
    expect(html).toContain("3 messages non lus");
  });

  it("place la mise à jour dans l’en-tête, avec une pastille quand une version attend", () => {
    const headerProps = {
      homeSection: "home" as const, payScreen: "overview" as const, userEmail: "mika@example.fr", fullName: "Mika",
      accountMenuOpen: false, mainMenuOpen: false, checkingAppUpdate: false, demoMode: true, unreadFeedbackCount: 0,
      notify: vi.fn(), accountMenuRef: createRef<HTMLDivElement>(), accountButtonRef: createRef<HTMLButtonElement>(),
      onToggleAccount: vi.fn(), onDisconnect: vi.fn(), onOpenMainMenu: vi.fn(), onCheckForUpdate: vi.fn(),
    };
    const idle = renderToStaticMarkup(<AppHeader {...headerProps} appUpdateAvailable={false} />);
    expect(idle).toContain('class="header-update-button"');
    expect(idle).toContain('aria-label="Vérifier les mises à jour"');
    expect(idle).not.toContain("header-update-dot");
    const ready = renderToStaticMarkup(<AppHeader {...headerProps} appUpdateAvailable />);
    expect(ready).toContain('aria-label="Installer la mise à jour"');
    expect(ready).toContain("header-update-dot");
    expect(ready.indexOf("header-update-button")).toBeLessThan(ready.indexOf("account-button"));
  });

  it("propose une navigation adaptative sans numéros et marque la rubrique active", () => {
    const html = renderToStaticMarkup(<AdaptiveNavigation homeSection="colleagues" onNavigate={vi.fn()} onMore={vi.fn()} unreadFeedbackCount={2} />);
    // Les six rubriques sont toujours dans le dock ; seule la rubrique en
    // cours porte aria-current.
    expect(html).toContain("section-dock");
    expect(html.match(/<button/g)).toHaveLength(6);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('class="active" aria-current="page" aria-label="Collègues"');
    expect(html).toContain('aria-label="Programme"');
    expect(html).toContain('aria-label="Documents"');
    expect(html).not.toContain("compass");
    expect(html).toContain("<svg");
    expect(html).not.toContain('aria-label="Plus"');
    expect(html).not.toContain('aria-hidden="true">+</span>');
    expect(html).not.toContain(">01<");
    expect(html).not.toContain("Mode d’emploi");
  });

});
